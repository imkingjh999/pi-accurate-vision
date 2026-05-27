/**
 * Configuration module — reads vision model settings from ~/.deepseek/config.toml
 * or accepts them directly.
 */
/** Vision model configuration (mirrors DeepSeek-TUI's VisionModelConfig). */
export interface VisionModelConfig {
    /** Model identifier (e.g., "qwen3.5-omni-plus-2026-03-15"). Required. */
    model: string;
    /** API key. Falls back to the main provider key if not set. */
    apiKey?: string;
    /** Base URL for the OpenAI-compatible API. Defaults to "https://api.openai.com/v1". */
    baseUrl?: string;
    /** Whether to request bounding-box primitives. Defaults to true. */
    primitives?: boolean;
}
/** Raw TOML shape — keys are snake_case as in the file. */
interface RawTomlConfig {
    provider?: string;
    providers?: Record<string, {
        api_key?: string;
        base_url?: string;
        model?: string;
    }>;
    features?: {
        vision_model?: boolean;
    };
    vision_model?: {
        model?: string;
        api_key?: string;
        base_url?: string;
        primitives?: boolean;
    };
}
/** Default config file path. */
export declare const DEFAULT_CONFIG_PATH: string;
/**
 * Read and parse ~/.deepseek/config.toml.
 * Returns undefined if the file doesn't exist.
 */
export declare function readConfig(configPath?: string): RawTomlConfig | undefined;
/**
 * Resolve the effective vision model config.
 *
 * Priority:
 * 1. Explicit config passed in (from CLI flags, env vars, etc.)
 * 2. [vision_model] section in ~/.deepseek/config.toml
 * 3. Main provider config as fallback for apiKey/baseUrl
 *
 * Throws if no model can be determined.
 */
export declare function resolveVisionConfig(explicit?: Partial<VisionModelConfig>): VisionModelConfig;
export {};
