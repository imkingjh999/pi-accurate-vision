/**
 * Vision analysis bridge — coordinate-based region detection (0–1000 normalised).
 *
 * Faithful TypeScript port of DeepSeek-TUI's crates/tui/src/vision/bridge.rs.
 */
/** Bounding-box coordinates are normalised to `0..NORM_MAX`. */
export declare const NORM_MAX = 1000;
/** Normalised bounding box `[x1, y1, x2, y2]` in 0–1000 coordinate space. */
export interface BBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
/** Create a BBox with validation. Throws if coordinates exceed 0–1000. */
export declare function createBBox(x1: number, y1: number, x2: number, y2: number): BBox;
/** A detected visual primitive (object / region). */
export interface VisualPrimitive {
    id: string;
    type: string;
    label: string;
    box: BBox;
    confidence: number;
}
/** Structured image description (the "note" portion). */
export interface ImageNote {
    imageOverview: string;
    visibleText: string;
    objectsAndLayout: string;
    chartsOrData?: string;
    userRequest?: string;
    userRequestAnswer?: string;
    evidence?: string;
    uncertainty?: string;
}
/** Full analysis result: text note + optional primitives. */
export interface VisionAnalysis {
    note: ImageNote;
    primitives: VisualPrimitive[];
}
/** Parameters for the vision analysis HTTP call. */
export interface VisionAnalysisParams {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeoutSecs: number;
    imageDataUrl: string;
    userQuestion?: string;
    /** Whether to request bounding-box primitives. Defaults to true. */
    primitives: boolean;
}
export declare function primitivesAnalysisPrompt(): string;
/**
 * Parse the vision model's JSON response into a VisionAnalysis.
 * Handles markdown fences and multiple field name conventions (from bridge.rs).
 */
export declare function parseAnalysisResponse(raw: string): VisionAnalysis;
/** Detect MIME type from file extension. Returns undefined for unsupported formats. */
export declare function mimeTypeForPath(path: string): string | undefined;
/** Convert image bytes to a base64 data URI. */
export declare function buildDataUrl(mime: string, bytes: Uint8Array | Buffer): string;
/**
 * Run vision analysis against an OpenAI-compatible vision model API.
 *
 * POST to `{baseUrl}/chat/completions` with the image as an `image_url` content part.
 * Returns a parsed VisionAnalysis, or falls back to raw text on parse failure.
 */
export declare function runVisionAnalysis(params: VisionAnalysisParams): Promise<VisionAnalysis>;
/** Format a VisionAnalysis into structured XML-like text for downstream consumption. */
export declare function formatVisionContext(analysis: VisionAnalysis): string;
/** Strip ```json ... ``` markdown fences from a string. */
export declare function stripMarkdownFences(s: string): string;
