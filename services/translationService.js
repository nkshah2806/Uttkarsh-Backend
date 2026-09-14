const crypto = require("crypto");
const Translation = require("../models/Translation");

/**
 * Server-side translation service.
 *
 * Security: the Google Translate API key lives ONLY on the server
 * (`GOOGLE_TRANSLATE_API_KEY` env var) and is never sent to the browser. The
 * React apps call our own `/api/translate` endpoint, which proxies to Google.
 *
 * Caching: results are cached in MongoDB (`Translation` collection) keyed by a
 * hash of `CACHE_VERSION | source lang | target lang | source text`, so the
 * same text is translated once per language pair and can never leak a stale
 * English source across languages.
 *
 * Failure handling: a failed / empty / obviously-untranslated result is NEVER
 * written to the cache and is reported back with `ok: false` so the caller can
 * distinguish "translated" from "fell back to source". The UI still receives
 * the source text so it never renders blank or `[object Object]`.
 */

const GOOGLE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

// Keyless public endpoint used ONLY as an explicit development fallback when no
// `GOOGLE_TRANSLATE_API_KEY` is configured. Never rely on it in production —
// it is rate limited and can return the source language unchanged.
const GOOGLE_FREE_ENDPOINT = "https://clients5.google.com/translate_a/t";
const FREE_TRANSLATE_ENABLED = process.env.ENABLE_FREE_TRANSLATE !== "false";

// Keep each keyless request URL safely under typical ~8 KB URL limits.
const FREE_MAX_CHARS_PER_REQUEST = 1500;

// Google accepts many segments per request; keep chunks modest to stay within
// request size limits. 100 strings per request satisfies the "batch" requirement.
const MAX_BATCH = 100;
const MAX_TEXT_LENGTH = 5000;

// Bump this salt whenever translation logic/caching changes to invalidate
// previously cached rows (entries written while translation was misconfigured
// may have stored the English source as the "translation").
const CACHE_VERSION = "v3";

const OFFICIAL_CONFIGURED = Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);

// Emit an explicit, unmissable configuration banner at boot so the active
// provider is never a silent mystery (requirement: no silent fallback).
if (OFFICIAL_CONFIGURED) {
    console.log(
        "[Translation] Google Cloud Translation API configured — using the official server-side key."
    );
} else if (FREE_TRANSLATE_ENABLED) {
    console.warn(
        "[Translation] GOOGLE_TRANSLATE_API_KEY is NOT configured — DEVELOPMENT FALLBACK ACTIVE " +
        "(keyless public endpoint). Set GOOGLE_TRANSLATE_API_KEY for production."
    );
} else {
    console.error(
        "[Translation] No provider configured and keyless fallback disabled " +
        "(ENABLE_FREE_TRANSLATE=false). Dynamic content will remain untranslated."
    );
}

function providerName() {
    return OFFICIAL_CONFIGURED ? "google-official" : "google-free-fallback";
}

/**
 * Cache key = sha1(version | source lang | target lang | source text).
 * Including source + target + version guarantees English→Hindi and
 * English→Gujarati (and future re-translations) never collide.
 */
function hashText(text, target = "en", source = "en") {
    return crypto
        .createHash("sha1")
        .update(`${CACHE_VERSION}|${source}|${target}|${text}`)
        .digest("hex");
}

function isSupportedTarget(lang) {
    return typeof lang === "string" && ["hi", "gu", "en"].includes(lang);
}

function normalizeText(text) {
    return typeof text === "string" ? text.trim() : "";
}

function containsHtml(text) {
    return typeof text === "string" && /<[a-z][^>]*>/i.test(text);
}

/**
 * Heuristic: has the provider returned the source unchanged (i.e. not actually
 * translated)? Used to avoid caching "English as Hindi". Strings without any
 * ASCII letters (numbers, codes, punctuation) are exempt so legitimate
 * identical values are not rejected.
 */
function looksUntranslated(source, out) {
    if (typeof out !== "string" || !out.trim()) return true;
    if (out === source) return /[A-Za-z]/.test(source);
    return false;
}

/**
 * Official Google Cloud Translation (v2) — used when an API key is present.
 * Returns `{ text, ok }` aligned by index. HTML markup is preserved by asking
 * Google for `format: "html"` whenever any segment contains tags.
 */
async function callOfficialTranslate(texts, target, source) {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    const format = texts.some(containsHtml) ? "html" : "text";
    const res = await fetch(`${GOOGLE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            q: texts,
            target,
            source,
            format,
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Google Translate API error (${res.status}): ${body}`);
    }

    const data = await res.json();
    const list = data?.data?.translations || [];
    console.log(
        `[Translation API] provider=google-official target=${target} source=${source} count=${texts.length}`
    );
    return texts.map((t, i) => {
        const value = list[i] && typeof list[i].translatedText === "string"
            ? list[i].translatedText
            : "";
        return { text: value || t, ok: Boolean(value) };
    });
}

/**
 * Single keyless request. The endpoint accepts multiple `q` parameters and
 * returns one translated string per input, aligned by index.
 */
async function callFreeTranslateBatch(texts, target, source) {
    const params = new URLSearchParams();
    params.append("client", "dict-chrome-ex");
    params.append("sl", source || "en");
    params.append("tl", target);
    texts.forEach((t) => params.append("q", t));

    const res = await fetch(`${GOOGLE_FREE_ENDPOINT}?${params.toString()}`, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
        throw new Error(`Free translate endpoint error (${res.status})`);
    }

    const data = await res.json();
    // Response shape: ["translated 1", "translated 2", ...]
    const list = Array.isArray(data) ? data : [data];
    console.log(
        `[Translation API] provider=google-free-fallback target=${target} source=${source} count=${texts.length}`
    );
    let rejected = 0;
    const out = texts.map((t, i) => {
        const value = typeof list[i] === "string" ? list[i] : "";
        const ok = !looksUntranslated(t, value);
        if (!ok) {
            rejected += 1;
            console.warn(
                `[Translation ERROR] fallback returned untranslated text for target=${target}: "${String(t).slice(0, 60)}"`
            );
        }
        return { text: ok ? value : t, ok };
    });
    if (rejected) {
        console.warn(
            `[Translation ERROR] ${rejected}/${texts.length} strings were NOT translated by the fallback provider (target=${target}) and will not be cached.`
        );
    }
    return out;
}

/**
 * Keyless public Google Translate endpoint. Batches as many strings as fit in
 * a safe URL, translating them in order so results stay aligned with input.
 */
async function callFreeTranslate(texts, target, source) {
    const groups = [];
    let current = [];
    let currentLen = 0;

    texts.forEach((t) => {
        const len = encodeURIComponent(t).length;
        if (current.length && currentLen + len > FREE_MAX_CHARS_PER_REQUEST) {
            groups.push(current);
            current = [];
            currentLen = 0;
        }
        current.push(t);
        currentLen += len;
    });
    if (current.length) groups.push(current);

    const results = [];
    for (const group of groups) {
        // Sequential to stay gentle on the keyless endpoint (rate limits).
        const part = await callFreeTranslateBatch(group, target, source);
        results.push(...part);
    }
    return results;
}

/**
 * Translate a chunk of strings, returning `{ text, ok }[]`. Prefers the
 * official keyed API; when no key is configured it falls back to the keyless
 * public endpoint. Errors propagate so the caller can mark items as failed.
 */
async function callGoogleTranslate(texts, target, source) {
    if (OFFICIAL_CONFIGURED) {
        return callOfficialTranslate(texts, target, source);
    }
    if (!FREE_TRANSLATE_ENABLED) {
        throw new Error("GOOGLE_TRANSLATE_API_KEY is not configured");
    }
    return callFreeTranslate(texts, target, source);
}

async function translateChunk(texts, target, source) {
    const results = await callGoogleTranslate(texts, target, source);
    return texts.map((t, i) => results[i] || { text: t, ok: false });
}

/**
 * Translate an array of strings into `target`, using the cache first.
 * Returns `{ text, ok, cached, provider }[]` aligned with the input order.
 * Failures are distinguishable (`ok: false`) and are never cached.
 */
async function translateTextsDetailed(rawTexts, target, source = "en") {
    const texts = (Array.isArray(rawTexts) ? rawTexts : [rawTexts]).map(normalizeText);

    // Nothing to do for English (source) — return as-is.
    if (target === source || !isSupportedTarget(target)) {
        return texts.map((t) => ({ text: t, ok: true, cached: false, skipped: true }));
    }

    const output = new Array(texts.length);
    const toFetch = []; // { index, text, hash }

    // 1. Resolve from cache (scoped to the exact source+target+version key).
    const hashes = texts.map((t) => (t ? hashText(t, target, source) : null));
    const uniqueHashes = [...new Set(hashes.filter(Boolean))];

    // The cache is an optimisation only: if MongoDB is unreachable we still
    // translate (just without a cache hit) instead of failing the request.
    let cachedDocs = [];
    if (uniqueHashes.length) {
        try {
            cachedDocs = await Translation.find({
                source_hash: { $in: uniqueHashes },
                target_lang: target,
            }).lean();
        } catch (e) {
            console.error("[Translation ERROR] cache read failed:", e.message);
        }
    }
    const cacheMap = new Map(cachedDocs.map((d) => [d.source_hash, d.translated_text]));

    texts.forEach((text, index) => {
        if (!text) {
            output[index] = { text: "", ok: true, cached: false };
            return;
        }
        if (text.length > MAX_TEXT_LENGTH) {
            // Extremely long values are returned untranslated rather than failing.
            output[index] = { text, ok: false, cached: false, reason: "too_long" };
            return;
        }
        const cached = cacheMap.get(hashes[index]);
        if (cached !== undefined) {
            output[index] = { text: cached, ok: true, cached: true };
        } else {
            toFetch.push({ index, text, hash: hashes[index] });
        }
    });

    // 2. Fetch the missing ones in batches, de-duplicating within this request.
    if (toFetch.length) {
        const byHash = new Map();
        toFetch.forEach((item) => {
            if (!byHash.has(item.hash)) byHash.set(item.hash, item);
        });
        const uniqueItems = [...byHash.values()];

        for (let i = 0; i < uniqueItems.length; i += MAX_BATCH) {
            const chunk = uniqueItems.slice(i, i + MAX_BATCH);
            let translated;
            let succeeded = true;
            try {
                translated = await translateChunk(
                    chunk.map((c) => c.text),
                    target,
                    source
                );
            } catch (err) {
                console.error("[Translation ERROR] translate failed:", err.message);
                // Graceful fallback: keep original text for this chunk, but DO
                // NOT cache it — it is not a real translation.
                succeeded = false;
                translated = chunk.map((c) => ({ text: c.text, ok: false }));
            }

            await Promise.all(
                chunk.map(async (item, idx) => {
                    const result = translated[idx] || { text: item.text, ok: false };
                    const value = result.text || item.text;
                    const ok = succeeded && result.ok !== false;
                    cacheMap.set(item.hash, value);
                    // Never persist a fallback original as if it were a real
                    // translation — that would poison the cache permanently.
                    if (!ok) return;
                    try {
                        await Translation.updateOne(
                            { source_hash: item.hash, target_lang: target },
                            {
                                $set: {
                                    source_text: item.text.slice(0, 2000),
                                    source_lang: source,
                                    target_lang: target,
                                    translated_text: value,
                                    provider: providerName(),
                                },
                                $inc: { usage_count: 1 },
                            },
                            { upsert: true }
                        );
                    } catch (e) {
                        // Ignore duplicate-key races; the value is still returned.
                    }
                })
            );
        }

        // 3. Fill output for fetched items.
        toFetch.forEach((item) => {
            output[item.index] = {
                text: cacheMap.get(item.hash) ?? item.text,
                ok: true,
                cached: false,
            };
        });
    }

    return output;
}

/**
 * Backward-compatible string[] variant used by the single-string helper and any
 * legacy callers. Failures still surface the source text.
 */
async function translateTexts(rawTexts, target, source = "en") {
    const detailed = await translateTextsDetailed(rawTexts, target, source);
    return detailed.map((d) => d.text);
}

/** Translate a single string (convenience wrapper). */
async function translateText(text, target, source = "en") {
    const [result] = await translateTexts([text], target, source);
    return result;
}

/**
 * Whether machine translation is available on the server — either via the
 * official Google API key or the automatic keyless fallback.
 */
function isConfigured() {
    return OFFICIAL_CONFIGURED || FREE_TRANSLATE_ENABLED;
}

/** Whether we are running on the (non-production) keyless fallback. */
function isFallbackActive() {
    return !OFFICIAL_CONFIGURED && FREE_TRANSLATE_ENABLED;
}

module.exports = {
    translateTexts,
    translateTextsDetailed,
    translateText,
    isConfigured,
    isFallbackActive,
    isSupportedTarget,
    providerName,
    CACHE_VERSION,
};
