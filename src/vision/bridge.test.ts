import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	createBBox,
	NORM_MAX,
	parseAnalysisResponse,
	formatVisionContext,
	stripMarkdownFences,
	mimeTypeForPath,
	buildDataUrl,
	primitivesAnalysisPrompt,
} from "./bridge.js";

describe("BBox", () => {
	it("accepts valid coordinates", () => {
		const b = createBBox(0, 0, 1000, 1000);
		assert.deepEqual(b, { x1: 0, y1: 0, x2: 1000, y2: 1000 });
	});

	it("rejects out-of-range coordinates", () => {
		assert.throws(() => createBBox(1001, 0, 1000, 1000));
		assert.throws(() => createBBox(-1, 0, 100, 100));
	});
});

describe("parseAnalysisResponse", () => {
	it("parses a full response with primitives", () => {
		const raw = JSON.stringify({
			image_overview: "A cat on a mat",
			visible_text: "Welcome",
			objects_and_layout: "One cat, center",
			visual_primitives: [
				{
					id: "v1",
					type: "box",
					ref: "cat",
					bbox_2d: [100, 200, 500, 600],
					confidence: 0.95,
				},
			],
		});
		const a = parseAnalysisResponse(raw);
		assert.equal(a.note.imageOverview, "A cat on a mat");
		assert.equal(a.primitives.length, 1);
		assert.equal(a.primitives[0].label, "cat");
		assert.deepEqual(a.primitives[0].box, {
			x1: 100,
			y1: 200,
			x2: 500,
			y2: 600,
		});
	});

	it("accepts alternative field names (box, bbox, box_2d)", () => {
		for (const field of ["box", "bbox", "bbox_2d", "box_2d"]) {
			const raw = JSON.stringify({
				image_overview: "T",
				visual_primitives: [
					{ id: "v1", [field]: [10, 20, 300, 400], confidence: 0.9 },
				],
			});
			const a = parseAnalysisResponse(raw);
			assert.equal(a.primitives.length, 1, `failed for field ${field}`);
			assert.deepEqual(a.primitives[0].box, {
				x1: 10,
				y1: 20,
				x2: 300,
				y2: 400,
			});
		}
	});

	it("accepts alternative array field names", () => {
		for (const field of [
			"visual_primitives",
			"visual_anchors",
			"anchors",
			"primitives",
		]) {
			const raw = JSON.stringify({
				image_overview: "T",
				[field]: [{ id: "p1", box: [0, 0, 100, 100] }],
			});
			const a = parseAnalysisResponse(raw);
			assert.equal(a.primitives.length, 1, `failed for field ${field}`);
		}
	});

	it("parses label from ref or label", () => {
		const raw = JSON.stringify({
			image_overview: "T",
			visual_primitives: [
				{ ref: "via ref", box: [0, 0, 10, 10] },
				{ label: "via label", box: [0, 0, 10, 10] },
			],
		});
		const a = parseAnalysisResponse(raw);
		assert.equal(a.primitives[0].label, "via ref");
		assert.equal(a.primitives[1].label, "via label");
	});

	it("parses fenced JSON", () => {
		const raw = '```json\n{"image_overview":"x","visible_text":"y"}\n```';
		const a = parseAnalysisResponse(raw);
		assert.equal(a.note.imageOverview, "x");
		assert.equal(a.primitives.length, 0);
	});

	it("returns empty primitives when none present", () => {
		const a = parseAnalysisResponse('{"image_overview":"Just text"}');
		assert.equal(a.note.imageOverview, "Just text");
		assert.equal(a.primitives.length, 0);
	});
});

describe("formatVisionContext", () => {
	it("formats with primitives", () => {
		const a = {
			note: {
				imageOverview: "Test.",
				objectsAndLayout: "One box.",
				visibleText: "",
			},
			primitives: [
				{
					id: "v1",
					type: "box",
					label: "Obj",
					box: createBBox(10, 20, 300, 400),
					confidence: 0.9,
				},
			],
		};
		const ctx = formatVisionContext(a);
		assert.ok(ctx.includes('<visual_primitives coord="norm-1000"'));
		assert.ok(ctx.includes("v1 | type: box | box: [10,20,300,400]"));
		assert.ok(ctx.includes("<evidence>") === false); // no evidence field set
		assert.ok(ctx.includes("<visible_text>") === false); // empty
	});

	it("shows unavailable when no primitives", () => {
		const a = {
			note: { imageOverview: "", visibleText: "", objectsAndLayout: "" },
			primitives: [],
		};
		assert.ok(formatVisionContext(a).includes("unavailable"));
	});
});

describe("stripMarkdownFences", () => {
	it("strips json fences", () => {
		assert.equal(stripMarkdownFences('{"a":1}'), '{"a":1}');
		assert.equal(stripMarkdownFences('```json\n{"a":1}\n```'), '{"a":1}');
	});
});

describe("mimeTypeForPath", () => {
	it("detects png", () => assert.equal(mimeTypeForPath("x.png"), "image/png"));
	it("detects jpg", () => assert.equal(mimeTypeForPath("x.jpg"), "image/jpeg"));
	it("detects jpeg case-insensitive", () =>
		assert.equal(mimeTypeForPath("x.JPEG"), "image/jpeg"));
	it("detects gif", () => assert.equal(mimeTypeForPath("x.gif"), "image/gif"));
	it("detects webp", () =>
		assert.equal(mimeTypeForPath("x.webp"), "image/webp"));
	it("returns undefined for unknown", () =>
		assert.equal(mimeTypeForPath("x.pdf"), undefined));
});

describe("buildDataUrl", () => {
	it("builds data URI", () => {
		const url = buildDataUrl("image/png", new Uint8Array([0x89, 0x50]));
		assert.ok(url.startsWith("data:image/png;base64,"));
	});
});

describe("primitivesAnalysisPrompt", () => {
	it("contains key instructions", () => {
		const p = primitivesAnalysisPrompt();
		assert.ok(p.includes("visual_primitives"));
		assert.ok(p.includes("bbox_2d"));
		assert.ok(p.includes("0-1000"));
	});
});
