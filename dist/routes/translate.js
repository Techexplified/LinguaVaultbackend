"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateRouter = void 0;
const express_1 = require("express");
const openRouterService_js_1 = require("../services/openRouterService.js");
exports.translateRouter = (0, express_1.Router)();
// POST /api/translate - Main Translation Endpoint
exports.translateRouter.post("/", async (req, res) => {
    try {
        const { texts, targetLanguage, sourceLanguage = "Auto-detect" } = req.body;
        if (!texts || !Array.isArray(texts)) {
            return res.status(400).json({
                success: false,
                error: "Missing or invalid 'texts' field. Must be an array of strings or { id, text } objects.",
            });
        }
        if (!targetLanguage || typeof targetLanguage !== "string") {
            return res.status(400).json({
                success: false,
                error: "Missing or invalid 'targetLanguage' field. (e.g. 'French', 'Spanish', 'German').",
            });
        }
        const result = await openRouterService_js_1.openRouterService.translate(texts, targetLanguage, sourceLanguage);
        if (!result.success) {
            return res.status(503).json(result);
        }
        return res.json(result);
    }
    catch (err) {
        console.error("[Translate Route] Error handling translation:", err);
        return res.status(503).json({
            success: false,
            error: "Server is busy. Please try again shortly.",
        });
    }
});
// GET /api/translate/languages - List supported languages
exports.translateRouter.get("/languages", (_req, res) => {
    res.json({
        languages: [
            { code: "en", name: "English", badge: "EN" },
            { code: "es", name: "Spanish", badge: "ES" },
            { code: "pt-BR", name: "Brazilian Portuguese", badge: "PT" },
            { code: "ja", name: "Japanese", badge: "JA" },
            { code: "de", name: "German", badge: "DE" },
            { code: "fr", name: "French", badge: "FR" },
            { code: "ko", name: "Korean", badge: "KO" },
        ],
    });
});
