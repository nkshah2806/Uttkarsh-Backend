const mongoose = require("mongoose");

/**
 * Persistent translation cache.
 *
 * Every unique (source text + target language) pair is stored once so we never
 * call the Google Translate API twice for the same string. This dramatically
 * reduces API calls / cost / load (requirement: "Translation Caching").
 */
const translationSchema = new mongoose.Schema(
    {
        source_hash: {
            type: String,
            required: true,
            index: true,
        },
        source_text: {
            type: String,
            required: true,
        },
        source_lang: {
            type: String,
            default: "en",
            trim: true,
        },
        target_lang: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        translated_text: {
            type: String,
            required: true,
        },
        provider: {
            type: String,
            default: "google",
        },
        usage_count: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// One cached translation per (hash + target language).
translationSchema.index({ source_hash: 1, target_lang: 1 }, { unique: true });

module.exports = mongoose.model("Translation", translationSchema);
