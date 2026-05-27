/**
 * pi-accurate-vision — Accurate spatial reasoning over images.
 *
 * Vision model extracts bounding boxes, LLM calculates exact distances.
 * Standalone extraction of DeepSeek-TUI's vision bridge.
 */

// Core types and analysis logic
export {
	NORM_MAX,
	createBBox,
	buildDataUrl,
	mimeTypeForPath,
	runVisionAnalysis,
	parseAnalysisResponse,
	formatVisionContext,
	primitivesAnalysisPrompt,
	stripMarkdownFences,
} from "./vision/bridge.js";

export type {
	BBox,
	VisualPrimitive,
	ImageNote,
	VisionAnalysis,
	VisionAnalysisParams,
} from "./vision/bridge.js";

// Config
export { resolveVisionConfig } from "./config.js";

export type { VisionModelConfig } from "./config.js";

/**
 * Convenience: analyze an image file and return the formatted context string.
 *
 * @param imagePath - Absolute or relative path to the image
 * @param config - Vision model configuration
 * @param prompt - Optional user question / prompt
 */
export async function analyzeImage(
	imagePath: string,
	config: import("./config.js").VisionModelConfig,
	prompt?: string,
): Promise<{ analysis: string; model: string; primitivesCount: number }> {
	const { readFileSync } = await import("node:fs");
	const { resolve } = await import("node:path");

	const {
		buildDataUrl,
		mimeTypeForPath,
		runVisionAnalysis,
		formatVisionContext,
	} = await import("./vision/bridge.js");

	const resolvedPath = resolve(imagePath);

	const mime = mimeTypeForPath(resolvedPath);
	if (!mime) {
		throw new Error(`Unsupported image format: ${resolvedPath}`);
	}

	const bytes = readFileSync(resolvedPath);
	const dataUrl = buildDataUrl(mime, new Uint8Array(bytes));

	const analysis = await runVisionAnalysis({
		apiKey: config.apiKey ?? "",
		baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
		model: config.model,
		maxTokens: 8192,
		temperature: 0.0,
		timeoutSecs: 120,
		imageDataUrl: dataUrl,
		userQuestion: prompt,
		primitives: config.primitives ?? true,
	});

	return {
		analysis: formatVisionContext(analysis),
		model: config.model,
		primitivesCount: analysis.primitives.length,
	};
}
