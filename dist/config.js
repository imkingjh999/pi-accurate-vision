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
 * Parse .env text into a key->value map (pure function, no side effects).
 *
 * Handles:
 * - `export KEY=val` prefixes (the `export ` is stripped from the key)
 * - inline ` #...` comments on unquoted values (quoted values keep their #)
 * - surrounding single/double quotes (removed)
 * - blank lines and full-line `#` comments (ignored)
 */
export function parseDotEnv(text) {
    const result = {};
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1)
            continue;
        const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
        const raw = trimmed.slice(eq + 1).trim();
        const quoted = raw.length >= 2 &&
            ((raw.startsWith('"') && raw.endsWith('"')) ||
                (raw.startsWith("'") && raw.endsWith("'")));
        const val = quoted ? raw.slice(1, -1) : stripInlineComment(raw);
        if (key) {
            result[key] = val;
        }
    }
    return result;
}
/** Strip an inline ` # comment` from an unquoted env value (keeps `bar#baz`). */
function stripInlineComment(val) {
    const idx = val.indexOf(" #");
    return idx === -1 ? val : val.slice(0, idx).trim();
}
let dotEnvLoaded = false;
/**
 * Read a .env file and populate process.env with its values.
 * Ignores comments and blank lines. Does not overwrite existing env vars.
 * Memoised: only reads from disk once per process.
 */
function loadDotEnv(dir) {
    if (dotEnvLoaded)
        return;
    const envPath = dir ? join(dir, ".env") : join(process.cwd(), ".env");
    try {
        const text = readFileSync(envPath, "utf-8");
        for (const [key, val] of Object.entries(parseDotEnv(text))) {
            // Don't overwrite existing env vars (CLI / shell takes priority)
            if (process.env[key] === undefined) {
                process.env[key] = val;
            }
        }
    }
    catch {
        // No .env file found - continue silently; env vars / CLI flags still work.
    }
    dotEnvLoaded = true;
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