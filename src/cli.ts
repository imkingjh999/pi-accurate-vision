#!/usr/bin/env node
/**
 * pi-accurate-vision CLI — Analyze an image using a vision model.
 *
 * Usage:
 *   npx tsx src/cli.ts <image_path> [prompt] [--model MODEL] [--api-key KEY] [--base-url URL] [--no-primitives]
 *   npx tsx src/cli.ts photo.png "What is in this image?"
 *   npx tsx src/cli.ts screenshot.png --no-primitives
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveVisionConfig } from "./config.js";
import {
	buildDataUrl,
	formatVisionContext,
	MAX_IMAGE_BYTES,
	mimeTypeForPath,
	runVisionAnalysis,
} from "./vision/bridge.js";

function printUsage(): never {
	console.error(
		`Usage: accurate-vision <image_path> [prompt] [options]

Options:
  --model <model>       Vision model ID (overrides env)
  --api-key <key>       API key (overrides env)
  --base-url <url>      API base URL (overrides env)
  --no-primitives       Disable bounding-box primitives
  --json                Output raw JSON instead of formatted context
  -h, --help            Show this help

Example:
  accurate-vision photo.png "Describe the objects"
  accurate-vision screenshot.png --no-primitives --json`,
	);
	process.exit(1);
}

function parseArgs(argv: string[]): {
	imagePath: string;
	prompt?: string;
	overrides: Record<string, string | boolean>;
} {
	const args = argv.slice(2);
	if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
		printUsage();
	}

	let imagePath = "";
	let prompt: string | undefined;
	const overrides: Record<string, string | boolean> = {};

	const VALUE_FLAGS = new Set(["--model", "--api-key", "--base-url"]);
	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		if (VALUE_FLAGS.has(arg)) {
			const val = args[++i];
			if (val === undefined) {
				console.error(`Error: ${arg} requires a value`);
				printUsage();
			}
			overrides[arg.slice(2).replace(/-/g, "_")] = val;
		} else if (arg === "--no-primitives") {
			overrides.primitives = false;
		} else if (arg === "--json") {
			overrides.json = true;
		} else if (!arg.startsWith("-")) {
			if (!imagePath) {
				imagePath = arg;
			} else if (!prompt) {
				prompt = arg;
			}
		} else {
			console.error(`Warning: unknown option ${arg}`);
		}
		i++;
	}

	if (!imagePath) {
		console.error("Error: image_path is required");
		printUsage();
	}

	return { imagePath, prompt, overrides };
}

async function main(): Promise<void> {
	const { imagePath, prompt, overrides } = parseArgs(process.argv);

	const config = resolveVisionConfig({
		model: typeof overrides.model === "string" ? overrides.model : undefined,
		apiKey:
			typeof overrides.api_key === "string" ? overrides.api_key : undefined,
		baseUrl:
			typeof overrides.base_url === "string" ? overrides.base_url : undefined,
		primitives: overrides.primitives === false ? false : undefined,
	});

	const resolvedPath = resolve(imagePath);

	// Read and validate image
	const mime = mimeTypeForPath(resolvedPath);
	if (!mime) {
		console.error(`Error: Unsupported image format: ${resolvedPath}`);
		process.exit(1);
	}

	let bytes: Uint8Array;
	try {
		bytes = new Uint8Array(readFileSync(resolvedPath));
	} catch (e) {
		console.error(
			`Error: Failed to read image: ${e instanceof Error ? e.message : e}`,
		);
		process.exit(1);
	}

	if (bytes.length > MAX_IMAGE_BYTES) {
		console.error(
			`Error: Image too large: ${bytes.length} bytes (limit ${MAX_IMAGE_BYTES}). Reduce the image dimensions or compress it.`,
		);
		process.exit(1);
	}

	const dataUrl = buildDataUrl(mime, bytes);

	console.error(
		`[accurate-vision] Analyzing ${resolvedPath} with ${config.model}...`,
	);

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

	if (overrides.json) {
		console.log(JSON.stringify(analysis, null, 2));
	} else {
		console.log(formatVisionContext(analysis));
	}
}

main().catch((e) => {
	console.error(`Error: ${e instanceof Error ? e.message : e}`);
	process.exit(1);
});
