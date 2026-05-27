/**
 * pi-accurate-vision — Accurate spatial reasoning over images.
 *
 * Vision model extracts bounding boxes, LLM calculates exact distances.
 * Standalone extraction of DeepSeek-TUI's vision bridge.
 */

import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolveVisionConfig } from "./config.js";
import {
	buildDataUrl,
	formatVisionContext,
	mimeTypeForPath,
	runVisionAnalysis,
} from "./vision/bridge.js";

// ── Pi extension factory ─────────────────────────────────────────────

const accurateVisionTool = defineTool({
	name: "accurate_vision",
	label: "Accurate Vision",
	description:
		"Analyze an image file with a vision model. Returns structured spatial context with bounding-box primitives (normalised 0–1000 coordinates). Use when you need precise object positions, distances, or layout info from an image.",
	parameters: Type.Object({
		image_path: Type.String({
			description: "Absolute or relative path to the image file",
		}),
		question: Type.Optional(
			Type.String({ description: "Optional question about the image" }),
		),
	}),
	async execute(_id, params, _signal) {
		const { readFileSync } = await import("node:fs");
		const { resolve } = await import("node:path");

		const resolvedPath = resolve(params.image_path);

		const mime = mimeTypeForPath(resolvedPath);
		if (!mime) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Unsupported image format: ${resolvedPath}`,
					},
				],
				details: { model: "", primitives: 0 },
			};
		}

		let config;
		try {
			config = resolveVisionConfig();
		} catch (e) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Vision config error: ${e instanceof Error ? e.message : e}`,
					},
				],
				details: { model: "", primitives: 0 },
			};
		}

		const bytes = new Uint8Array(readFileSync(resolvedPath));
		const dataUrl = buildDataUrl(mime, bytes);

		const analysis = await runVisionAnalysis({
			apiKey: config.apiKey ?? "",
			baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
			model: config.model,
			maxTokens: 8192,
			temperature: 0.0,
			timeoutSecs: 120,
			imageDataUrl: dataUrl,
			userQuestion: params.question,
			primitives: config.primitives ?? true,
		});

		return {
			content: [{ type: "text" as const, text: formatVisionContext(analysis) }],
			details: { model: config.model, primitives: analysis.primitives.length },
		};
	},
});

export default function (pi: ExtensionAPI) {
	pi.registerTool(accurateVisionTool);
}

// ── Named exports (library usage) ────────────────────────────────────

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
