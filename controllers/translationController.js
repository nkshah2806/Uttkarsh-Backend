const translationService = require("../services/translationService");

/**
 * POST /api/translate
 * Body: { texts: string[] | string, target: "hi"|"gu", source?: "en" }
 *
 * Secure proxy to Google Translate. The API key never leaves the server.
 * Returns: { success, target, source, translations, results, cached, provider, configured, fallback }
 *
 * This endpoint is reachable by both anonymous visitors (public website) and
 * authenticated users (admin/member panels). It only translates opaque text —
 * no direct database access — and enforces size limits to prevent abuse.
 */
const MAX_TEXTS = 200;

const translateHandler = async (req, res) => {
    try {
        const { texts, target, source = "en" } = req.body || {};

        if (!target || !translationService.isSupportedTarget(target)) {
            return res.status(400).json({
                success: false,
                message: "Unsupported or missing target language",
            });
        }

        let list = Array.isArray(texts) ? texts : texts != null ? [texts] : [];
        list = list.filter((t) => typeof t === "string");

        if (!list.length) {
            return res.json({
                success: true,
                target,
                source,
                translations: [],
                results: [],
                cached: true,
            });
        }

        if (list.length > MAX_TEXTS) {
            return res.status(413).json({
                success: false,
                message: `Too many texts in a single request (max ${MAX_TEXTS})`,
            });
        }

        const detailed = await translationService.translateTextsDetailed(list, target, source);
        const translations = detailed.map((d) => d.text);

        // `ok: true` means a genuine translation (or cached translation) was
        // produced. `ok: false` means we fell back to the source text — the
        // caller can log/handle the difference instead of silently assuming
        // English is the Hindi/Gujarati result.
        const allOk = detailed.every((d) => d.ok);
        const allCached = detailed.every((d) => d.cached || d.skipped);

        console.log(
            `[Translation] target=${target} source=${source} count=${list.length} ` +
            `provider=${translationService.providerName()} allOk=${allOk} allCached=${allCached}`
        );

        return res.json({
            success: true,
            target,
            source,
            translations,
            results: detailed.map((d) => ({ ok: d.ok, cached: Boolean(d.cached) })),
            cached: allCached,
            provider: translationService.providerName(),
            configured: translationService.isConfigured(),
            fallback: translationService.isFallbackActive(),
        });
    } catch (error) {
        console.error("[Translation ERROR] translationController:", error.message);
        return res.status(500).json({
            success: false,
            message: "Translation failed",
        });
    }
};

/**
 * GET /api/translate/status
 * Lightweight health/config probe used by the admin translation UI to show
 * whether automatic translation is available.
 */
const translationStatus = (req, res) => {
    res.json({
        success: true,
        configured: translationService.isConfigured(),
        fallback: translationService.isFallbackActive(),
        provider: translationService.providerName(),
        cacheVersion: translationService.CACHE_VERSION,
        supported: ["hi", "gu"],
        default: "en",
    });
};

module.exports = { translateHandler, translationStatus };
