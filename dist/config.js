/**
 * Configuration module — reads vision model settings from environment variables
 * or a .env file, or accepts them directly via CLI flags.
 *
 * Environment variables:
 *   VISION_MODEL       — Model identifier (e.g., "qwen3.5-omni-plus-2026-03-15")
 *   VISION_API_KEY     — API key
 *   VISION_BASE_URL    — API base URL (default: "https://api.openai.com/v1")
 *   VISION_PRIMITIVES  — "true" or "false" (default: "true")
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
/**
 * Read a .env file and populate process.env with its values.
 * Ignores comments and blank lines. Does not overwrite existing env vars.
 */
function loadDotEnv(dir) {
    const candidates = dir
        ? [join(dir, ".env")]
        : [join(process.cwd(), ".env")];
    for (const envPath of candidates) {
        try {
            const text = readFileSync(envPath, "utf-8");
            for (const line of text.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                const eq = trimmed.indexOf("=");
                if (eq === -1)
                    continue;
                const key = trimmed.slice(0, eq).trim();
                const val = trimmed.slice(eq + 1).trim();
                // Remove surrounding quotes
                const clean = (val.startsWith('"') && val.endsWith('"')) ||
                    (val.startsWith("'") && val.endsWith("'"))
                    ? val.slice(1, -1)
                    : val;
                // Don't overwrite existing env vars (CLI / shell takes priority)
                if (process.env[key] === undefined) {
                    process.env[key] = clean;
                }
            }
            return; // loaded first found
        }
        catch {
        }
    }
}
/**
 * Resolve the effective vision model config.
 *
 * Priority:
 * 1. Explicit values passed in (CLI flags)
 * 2. Environment variables (VISION_MODEL, VISION_API_KEY, VISION_BASE_URL, VISION_PRIMITIVES)
 * 3. .env file values (auto-loaded from CWD)
 *
 * Throws if no model or API key can be determined.
 */
export function resolveVisionConfig(explicit) {
    // Auto-load .env if not already done
    loadDotEnv();
    const model = explicit?.model ?? process.env.VISION_MODEL;
    if (!model) {
        throw new Error("No vision model specified. Set VISION_MODEL env var (or .env file) or pass --model.");
    }
    const apiKey = explicit?.apiKey ?? process.env.VISION_API_KEY;
    if (!apiKey) {
        throw new Error("No API key found. Set VISION_API_KEY env var (or .env file) or pass --api-key.");
    }
    const baseUrl = explicit?.baseUrl ??
        process.env.VISION_BASE_URL ??
        "https://api.openai.com/v1";
    const primitives = explicit?.primitives ??
        (process.env.VISION_PRIMITIVES === "false" ? false : true);
    return { model, apiKey, baseUrl, primitives };
}
//# sourceMappingURL=config.js.map