/**
 * Configuration module — reads vision model settings from ~/.deepseek/config.toml
 * or accepts them directly.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";

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
	providers?: Record<
		string,
		{ api_key?: string; base_url?: string; model?: string }
	>;
	features?: { vision_model?: boolean };
	vision_model?: {
		model?: string;
		api_key?: string;
		base_url?: string;
		primitives?: boolean;
	};
}

/** Default config file path. */
export const DEFAULT_CONFIG_PATH = join(homedir(), ".deepseek", "config.toml");

/**
 * Read and parse ~/.deepseek/config.toml.
 * Returns undefined if the file doesn't exist.
 */
export function readConfig(configPath?: string): RawTomlConfig | undefined {
	const path = configPath ?? DEFAULT_CONFIG_PATH;
	try {
		const text = readFileSync(path, "utf-8");
		return parseToml(text) as unknown as RawTomlConfig;
	} catch (e: unknown) {
		if (
			e instanceof Error &&
			"code" in e &&
			(e as NodeJS.ErrnoException).code === "ENOENT"
		) {
			return undefined;
		}
		throw new Error(`Failed to read config at ${path}: ${e}`);
	}
}

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
export function resolveVisionConfig(
	explicit?: Partial<VisionModelConfig>,
): VisionModelConfig {
	const fileConfig = readConfig();

	const vmSection = fileConfig?.vision_model;
	const mainProvider = fileConfig?.provider;
	const providerSection = mainProvider
		? fileConfig?.providers?.[mainProvider]
		: undefined;

	// Merge: explicit > [vision_model] > main provider
	const model = explicit?.model ?? vmSection?.model;
	if (!model) {
		throw new Error(
			"No vision model specified. Set [vision_model] model in ~/.deepseek/config.toml or pass --model.",
		);
	}

	const apiKey =
		explicit?.apiKey ?? vmSection?.api_key ?? providerSection?.api_key;
	if (!apiKey) {
		throw new Error(
			"No API key found. Set [vision_model] api_key or [providers.*] api_key in config, or pass --api-key.",
		);
	}

	const baseUrl =
		explicit?.baseUrl ??
		vmSection?.base_url ??
		providerSection?.base_url ??
		"https://api.openai.com/v1";

	const primitives = explicit?.primitives ?? vmSection?.primitives ?? true;

	return { model, apiKey, baseUrl, primitives };
}
