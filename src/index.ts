import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { translateRouter } from "./routes/translate.js";
import { openRouterService } from "./services/openRouterService.js";
import { HealthResponse } from "./types.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: "*", exposedHeaders: ["X-Cache", "Age"] }));
app.use(express.json({ limit: "5mb" }));

// Root Landing Endpoint
app.get("/", (_req, res) => {
  res.json({
    service: "LinguaVault Backend Translation API",
    status: "ok",
    version: "1.0.0",
    docs: {
      health: "/api/health",
      translate: "POST /api/translate",
      languages: "GET /api/translate/languages",
    },
  });
});

app.get("/health", (_req, res) => {
  res.redirect("/api/health");
});

// Health Check Endpoint
app.get("/api/health", (_req, res) => {
  const isReady = true;
  const health: HealthResponse = {
    status: isReady ? "ok" : "degraded",
    service: "LinguaVault Backend Translation API",
    version: "1.0.0",
    openrouter: {
      configured: openRouterService.isConfigured,
      model: openRouterService.model,
    },
    cacheEntries: openRouterService.cacheSize,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  res.json(health);
});

// Translation API Routes
app.use("/api/translate", translateRouter);

let server: ReturnType<typeof app.listen> | null = null;

// Start Server
async function start() {
  server = app.listen(PORT, () => {
    console.log(`\n🚀 LinguaVault Translation Backend running on: http://localhost:${PORT}`);
    console.log(`📡 Health Check:     http://localhost:${PORT}/api/health`);
    console.log(`🌐 Translate API:    http://localhost:${PORT}/api/translate`);
    console.log(`\n🤖 OpenRouter AI Configuration:`);
    console.log(`   • Status:    ${openRouterService.isConfigured ? "✅ Live API Key Active" : "⚠️ Key Omitted (Local fallback mode)"}`);
    console.log(`   • Model:     ${openRouterService.model}`);
    console.log(`   • Base URL:  https://openrouter.ai/api/v1/chat/completions\n`);
  });
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down LinguaVault server...`);
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

if (!process.env.VERCEL) {
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}

export { app };
export default app;
