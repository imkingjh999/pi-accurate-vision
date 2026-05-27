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
/** Vision model configuration. */
export interface VisionModelConfig {
    /** Model identifier (e.g., "qwen3.5-omni-plus-2026-03-15"). Required. */
    model: string;
    /** API key. */
    apiKey?: string;
    /** Base URL for the OpenAI-compatible API. Defaults to "https://api.openai.com/v1". */
    baseUrl?: string;
    /** Whether to request bounding-box primitives. Defaults to true. */
    primitives?: boolean;
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
export declare function resolveVisionConfig(explicit?: Partial<VisionModelConfig>): VisionModelConfig;
