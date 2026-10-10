"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const translate_js_1 = require("./routes/translate.js");
const openRouterService_js_1 = require("./services/openRouterService.js");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3001;
// Middlewares
app.use((0, cors_1.default)({ origin: "*", exposedHeaders: ["X-Cache", "Age"] }));
app.use(express_1.default.json({ limit: "5mb" }));
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
    const health = {
        status: isReady ? "ok" : "degraded",
        service: "LinguaVault Backend Translation API",
        version: "1.0.0",
        openrouter: {
            configured: openRouterService_js_1.openRouterService.isConfigured,
            model: openRouterService_js_1.openRouterService.model,
        },
        cacheEntries: openRouterService_js_1.openRouterService.cacheSize,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    };
    res.json(health);
});
// Translation API Routes
app.use("/api/translate", translate_js_1.translateRouter);
let server = null;
// Start Server
async function start() {
    server = app.listen(PORT, () => {
        console.log(`\n🚀 LinguaVault Translation Backend running on: http://localhost:${PORT}`);
        console.log(`📡 Health Check:     http://localhost:${PORT}/api/health`);
        console.log(`🌐 Translate API:    http://localhost:${PORT}/api/translate`);
        console.log(`\n🤖 OpenRouter AI Configuration:`);
        console.log(`   • Status:    ${openRouterService_js_1.openRouterService.isConfigured ? "✅ Live API Key Active" : "⚠️ Key Omitted (Local fallback mode)"}`);
        console.log(`   • Model:     ${openRouterService_js_1.openRouterService.model}`);
        console.log(`   • Base URL:  https://openrouter.ai/api/v1/chat/completions\n`);
    });
}
// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n${signal} received, shutting down LinguaVault server...`);
    if (server) {
        server.close(() => {
            process.exit(0);
        });
    }
    else {
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
exports.default = app;
