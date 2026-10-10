export interface TextItem {
  id?: string;
  text: string;
}

export interface TranslateRequest {
  texts: (string | TextItem)[];
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationItem {
  id?: string;
  original: string;
  translated: string;
}

export interface TranslateResponse {
  success: boolean;
  targetLanguage: string;
  sourceLanguage?: string;
  translations: Record<string, string>; // original text -> translated text
  items: TranslationItem[];
  modelUsed: string;
  source: "openrouter" | "cache" | "fallback";
  durationMs: number;
  error?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  openrouter: {
    configured: boolean;
    model: string;
  };
  cacheEntries: number;
  uptime: number;
  timestamp: string;
}
