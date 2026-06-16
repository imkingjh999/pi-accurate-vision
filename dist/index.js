/**
 * pi-accurate-vision — Accurate spatial reasoning over images.
 *
 * Vision model extracts bounding boxes, LLM calculates exact distances.
 * Standalone extraction of DeepSeek-TUI's vision bridge.
 */
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { resolveVisionConfig } from "./config.js";
import { buildDataUrl, formatVisionContext, MAX_IMAGE_BYTES, mimeTypeForPath, runVisionAnalysis, } from "./vision/bridge.js";
// ── Shared image-analysis core ───────────────────────────────────────
/**
 * Resolve a path, read + validate the image, and run vision analysis.
 *
 * Shared by the tool `execute` handler and the library `analyzeImage`
 * helper. Throws on any error (unsupported format, missing file, oversize,
 * or API failure); callers decide how to surface the error.
 */
async function analyzePath(imagePath, config, question) {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const resolvedPath = resolve(imagePath);
    const mime = mimeTypeForPath(resolvedPath);
    if (!mime) {
        throw new Error(`Unsupported image format: ${resolvedPath}`);
    }
    const bytes = new Uint8Array(readFileSync(resolvedPath));
    if (bytes.length > MAX_IMAGE_BYTES) {
        throw new Error(`Image too large: ${bytes.length} bytes (limit ${MAX_IMAGE_BYTES}). Reduce the image dimensions or compress it.`);
    }
    const dataUrl = buildDataUrl(mime, bytes);
    return runVisionAnalysis({
        apiKey: config.apiKey ?? "",
        baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
        model: config.model,
        maxTokens: 8192,
        temperature: 0.0,
        timeoutSecs: 120,
        imageDataUrl: dataUrl,
        userQuestion: question,
        primitives: config.primitives ?? true,
    });
}
// ── Pi extension factory ─────────────────────────────────────────────
const accurateVisionTool = defineTool({
    name: "accurate_vision",
    label: "Accurate Vision",
    description: "Analyze an image file with a vision model. Returns structured spatial context with bounding-box primitives (normalised 0–1000 coordinates). Use when you need precise object positions, distances, or layout info from an image.",
    parameters: Type.Object({
        image_path: Type.String({
            description: "Absolute or relative path to the image file",
        }),
        question: Type.Optional(Type.String({ description: "Optional question about the image" })),
    }),
    async execute(_id, params, _signal) {
        let config;
        try {
            config = resolveVisionConfig();
        }
        catch (e) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Vision config error: ${e instanceof Error ? e.message : e}`,
                    },
                ],
                details: { model: "", primitives: 0 },
            };
        }
        try {
            const analysis = await analyzePath(params.image_path, config, params.question);
            return {
                content: [
                    { type: "text", text: formatVisionContext(analysis) },
                ],
                details: {
                    model: config.model,
                    primitives: analysis.primitives.length,
                },
            };
        }
        catch (e) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Vision analysis failed: ${e instanceof Error ? e.message : e}`,
                    },
                ],
                details: { model: config.model, primitives: 0 },
            };
        }
    },
});
export default function (pi) {
    pi.registerTool(accurateVisionTool);
}
// ── Named exports (library usage) ────────────────────────────────────
// Core types and analysis logic
export { NORM_MAX, MAX_IMAGE_BYTES, createBBox, buildDataUrl, mimeTypeForPath, runVisionAnalysis, parseAnalysisResponse, formatVisionContext, primitivesAnalysisPrompt, stripMarkdownFences, normalizeContent, } from "./vision/bridge.js";
// Config
export { resolveVisionConfig, parseDotEnv } from "./config.js";
/**
 * Convenience: analyze an image file and return the formatted context string.
 *
 * @param imagePath - Absolute or relative path to the image
 * @param config - Vision model configuration
 * @param prompt - Optional user question / prompt
 */
export async function analyzeImage(imagePath, config, prompt) {
    const analysis = await analyzePath(imagePath, config, prompt);
    return {
        analysis: formatVisionContext(analysis),
        model: config.model,
        primitivesCount: analysis.primitives.length,
    };
}
//# sourceMappingURL=index.js.map