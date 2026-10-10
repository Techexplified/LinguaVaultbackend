import { TextItem, TranslateResponse, TranslationItem } from "../types.js";

export class OpenRouterService {
  private cache: Map<string, string> = new Map();

  get isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== "");
  }

  get model(): string {
    return process.env.OPENROUTER_MODEL || "liquid/lfm-2.5-2.6b:free";
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  async translate(
    inputTexts: (string | TextItem)[],
    targetLanguage: string,
    sourceLanguage: string = "Auto-detect"
  ): Promise<TranslateResponse> {
    const startTime = Date.now();

    // Normalize inputs into array of { id, text }
    const items: { id?: string; text: string }[] = inputTexts.map((item, idx) => {
      if (typeof item === "string") {
        return { id: `item-${idx}`, text: item };
      }
      return { id: item.id || `item-${idx}`, text: item.text };
    });

    // Deduplicate non-empty strings
    const uniqueStrings = Array.from(new Set(items.map((i) => i.text.trim()))).filter(
      (s) => s.length > 0
    );

    if (uniqueStrings.length === 0) {
      return {
        success: true,
        targetLanguage,
        sourceLanguage,
        translations: {},
        items: [],
        modelUsed: this.model,
        source: "cache",
        durationMs: Date.now() - startTime,
      };
    }

    const translationsMap: Record<string, string> = {};
    const uncachedStrings: string[] = [];

    // Check in-memory cache first
    for (const str of uniqueStrings) {
      const cacheKey = `${targetLanguage}:${str}`;
      if (this.cache.has(cacheKey)) {
        translationsMap[str] = this.cache.get(cacheKey)!;
      } else {
        uncachedStrings.push(str);
      }
    }

    let sourceUsed: "openrouter" | "cache" | "fallback" = "cache";

    // Call translation API if there are uncached strings
    if (uncachedStrings.length > 0) {
      if (!this.isConfigured) {
        return {
          success: false,
          targetLanguage,
          sourceLanguage,
          translations: {},
          items: [],
          modelUsed: this.model,
          source: "openrouter",
          durationMs: Date.now() - startTime,
          error: "Server is busy. Please try again shortly.",
        };
      }

      try {
        const aiTranslations = await this.callOpenRouter(
          uncachedStrings,
          targetLanguage,
          sourceLanguage
        );
        sourceUsed = "openrouter";

        // Save to cache and response map
        for (const [orig, trans] of Object.entries(aiTranslations)) {
          translationsMap[orig] = trans;
          this.cache.set(`${targetLanguage}:${orig}`, trans);
        }

        // Check if any translations were returned
        if (Object.keys(translationsMap).length === 0) {
          return {
            success: false,
            targetLanguage,
            sourceLanguage,
            translations: {},
            items: [],
            modelUsed: this.model,
            source: "openrouter",
            durationMs: Date.now() - startTime,
            error: "Server is busy. Please try again shortly.",
          };
        }
      } catch (err: any) {
        console.warn("[OpenRouterService] Translation request failed:", err?.message || err);
        return {
          success: false,
          targetLanguage,
          sourceLanguage,
          translations: {},
          items: [],
          modelUsed: this.model,
          source: "openrouter",
          durationMs: Date.now() - startTime,
          error: "Server is busy. Please try again shortly.",
        };
      }
    }

    // Assemble final items array matching original order
    const resultItems: TranslationItem[] = items.map((i) => ({
      id: i.id,
      original: i.text,
      translated: translationsMap[i.text.trim()] || i.text,
    }));

    return {
      success: true,
      targetLanguage,
      sourceLanguage,
      translations: translationsMap,
      items: resultItems,
      modelUsed: this.model,
      source: sourceUsed,
      durationMs: Date.now() - startTime,
    };
  }

  private async callOpenRouter(
    texts: string[],
    targetLanguage: string,
    sourceLanguage: string
  ): Promise<Record<string, string>> {
    const apiKey = process.env.OPENROUTER_API_KEY!;
    const model = this.model;
    const siteUrl = process.env.SITE_URL || "http://localhost:3002";
    const siteName = process.env.SITE_NAME || "LinguaVault";

    const systemPrompt = `You are a professional software and UI localization engine.
Your task is to accurately translate an array of UI strings into ${targetLanguage}.
Rules:
1. Preserve UI context, brevity, and capitalization (e.g. Title Case vs sentence case).
2. For short actions (e.g. "Book now", "Save", "Cancel"), use standard UI terms in ${targetLanguage}.
3. Respond ONLY with a valid, clean JSON object where each key is the exact original text string and the value is the translated string.
Do not output markdown codeblocks, explanations, or additional text.`;

    const userPrompt = `Translate the following ${texts.length} UI strings from ${sourceLanguage} to ${targetLanguage}:\n${JSON.stringify(
      texts,
      null,
      2
    )}`;

    const candidateModels = [
      model,
      "liquid/lfm-2.5-2.6b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "google/gemma-4-26b-a4b-it:free",
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastError: Error | null = null;

    for (const currentModel of candidateModels) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000); // 22s per model for inference

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": siteUrl,
            "X-Title": siteName,
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter (${currentModel}) HTTP ${response.status}: ${errorText}`);
        }

        const json = (await response.json()) as any;
        const content = json.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error(`Empty response returned by OpenRouter model ${currentModel}`);
        }

        // Robust JSON extraction: match the JSON object {...}
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`Model response did not contain a JSON object: ${content.slice(0, 100)}...`);
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed !== "object" || parsed === null) {
          throw new Error("Model response is not a valid JSON object");
        }

        return parsed as Record<string, string>;
      } catch (err: any) {
        lastError = err;
        console.warn(`[OpenRouter] Model attempt (${currentModel}) failed:`, err?.message || err);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error("All candidate models failed");
  }
}

export const openRouterService = new OpenRouterService();
