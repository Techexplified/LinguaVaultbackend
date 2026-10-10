import { Request, Response, Router } from "express";
import { openRouterService } from "../services/openRouterService.js";
import { TranslateRequest } from "../types.js";

export const translateRouter = Router();

// POST /api/translate - Main Translation Endpoint
translateRouter.post("/", async (req: Request<{}, {}, TranslateRequest>, res: Response) => {
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

    const result = await openRouterService.translate(texts, targetLanguage, sourceLanguage);
    if (!result.success) {
      return res.status(503).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error("[Translate Route] Error handling translation:", err);
    return res.status(503).json({
      success: false,
      error: "Server is busy. Please try again shortly.",
    });
  }
});

// GET /api/translate/languages - List supported languages
translateRouter.get("/languages", (_req: Request, res: Response) => {
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
