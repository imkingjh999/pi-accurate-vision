/**
 * pi-accurate-vision — Accurate spatial reasoning over images.
 *
 * Vision model extracts bounding boxes, LLM calculates exact distances.
 * Standalone extraction of DeepSeek-TUI's vision bridge.
 */
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI): void;
export { NORM_MAX, createBBox, buildDataUrl, mimeTypeForPath, runVisionAnalysis, parseAnalysisResponse, formatVisionContext, primitivesAnalysisPrompt, stripMarkdownFences, } from "./vision/bridge.js";
export type { BBox, VisualPrimitive, ImageNote, VisionAnalysis, VisionAnalysisParams, } from "./vision/bridge.js";
export { resolveVisionConfig } from "./config.js";
export type { VisionModelConfig } from "./config.js";
/**
 * Convenience: analyze an image file and return the formatted context string.
 *
 * @param imagePath - Absolute or relative path to the image
 * @param config - Vision model configuration
 * @param prompt - Optional user question / prompt
 */
export declare function analyzeImage(imagePath: string, config: import("./config.js").VisionModelConfig, prompt?: string): Promise<{
    analysis: string;
    model: string;
    primitivesCount: number;
}>;
