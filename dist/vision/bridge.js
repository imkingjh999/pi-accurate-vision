/**
 * Vision analysis bridge — coordinate-based region detection (0–1000 normalised).
 *
 * Faithful TypeScript port of DeepSeek-TUI's crates/tui/src/vision/bridge.rs.
 */
// ── Constants ────────────────────────────────────────────────────────
/** Bounding-box coordinates are normalised to `0..NORM_MAX`. */
export const NORM_MAX = 1000;
/** Create a BBox with validation. Throws if coordinates exceed 0–1000. */
export function createBBox(x1, y1, x2, y2) {
    if (x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0) {
        throw new Error(`coordinates must be >= 0, got (${x1},${y1},${x2},${y2})`);
    }
    if (x1 > NORM_MAX || y1 > NORM_MAX || x2 > NORM_MAX || y2 > NORM_MAX) {
        throw new Error(`coordinates must be 0..${NORM_MAX}, got (${x1},${y1},${x2},${y2})`);
    }
    return { x1, y1, x2, y2 };
}
// ── Prompt construction ──────────────────────────────────────────────
const NOTE_JSON_SHAPE = `
{
  "image_overview": "basic description of what the image is",
  "visible_text": ["important OCR or readable text"],
  "objects_and_layout": "important objects, positions, counts, and relationships",
  "charts_or_data": "chart/table/data details if present; otherwise none",
  "user_request": "restate the user request in one short sentence",
  "user_request_answer": "answer the user request using the image when possible",
  "evidence": "visual evidence supporting that answer",
  "uncertainty": "anything unclear, hidden, or guessed"
}`;
function noteOnlyPrompt() {
    return (`Analyze this image for another text-only model.\n` +
        `Return only one valid JSON object. Do not wrap it in Markdown.\n` +
        `Use this exact shape:${NOTE_JSON_SHAPE}\n` +
        `Do not mention that you are a tool or a separate model.`);
}
export function primitivesAnalysisPrompt() {
    return (`Analyze this image for another text-only model.\n` +
        `Return only one valid JSON object. Do not wrap it in Markdown.\n` +
        `Use this exact shape:${NOTE_JSON_SHAPE}\n` +
        `"visual_primitives": [\n` +
        `  {"id":"v1","type":"box","ref":"short label","bbox_2d":[x1,y1,x2,y2],"confidence":0.0}\n` +
        `]\n` +
        `}\n` +
        `IMPORTANT RULES:\n` +
        `- visual_primitives is REQUIRED. You MUST output one entry for EVERY distinguishable object.\n` +
        `- NEVER group multiple people or objects into a single box. Each person gets their own box.\n` +
        `- For UI screenshots: one box per clickable element, text block, image, and distinct region.\n` +
        `- bbox_2d uses [x1,y1,x2,y2] normalised to 0-1000, (0,0) top-left, (1000,1000) bottom-right.\n` +
        `- Each box must tightly enclose ONLY the single detected object.\n` +
        `- Do not mention that you are a tool or a separate model.`);
}
function analysisUserMessage(desc, question) {
    let msg = `Analyze this image: ${desc}`;
    if (question) {
        msg += `\n\nUser request:\n${question}`;
    }
    return msg;
}
// ── Response parsing ─────────────────────────────────────────────────
/**
 * Parse the vision model's JSON response into a VisionAnalysis.
 * Handles markdown fences and multiple field name conventions (from bridge.rs).
 */
export function parseAnalysisResponse(raw) {
    const cleaned = stripMarkdownFences(raw);
    let json;
    try {
        json = JSON.parse(cleaned);
    }
    catch (e) {
        throw new Error(`parse VisionAnalysis: ${e}`);
    }
    return {
        note: parseNoteFromValue(json),
        primitives: parsePrimitivesFromValue(json),
    };
}
function parseNoteFromValue(json) {
    const root = json;
    // bridge.rs: `let o = json.get("note").unwrap_or(json);`
    const o = root.note ?? root;
    return {
        imageOverview: strField(o, ["image_overview", "description"]),
        visibleText: strField(o, ["visible_text", "ocr_text"]),
        objectsAndLayout: strField(o, ["objects_and_layout", "layout"]),
        chartsOrData: optStrField(o, ["charts_or_data"]),
        userRequest: optStrField(o, ["user_request"]),
        userRequestAnswer: optStrField(o, ["user_request_answer", "answer"]),
        evidence: optStrField(o, ["evidence"]),
        uncertainty: optStrField(o, ["uncertainty"]),
    };
}
function parsePrimitivesFromValue(json) {
    const root = json;
    const keys = ["visual_primitives", "visual_anchors", "anchors", "primitives"];
    let items;
    for (const k of keys) {
        const val = root[k];
        if (Array.isArray(val)) {
            items = val;
            break;
        }
    }
    if (!items)
        return [];
    return items
        .map((raw, i) => normalizePrimitive(raw, i))
        .filter((p) => p !== null);
}
function normalizePrimitive(raw, index) {
    if (typeof raw !== "object" || raw === null)
        return null;
    const obj = raw;
    const id = typeof obj.id === "string" && obj.id.length > 0 ? obj.id : `v${index + 1}`;
    const type_ = typeof obj.type === "string" ? obj.type : "box";
    const label = typeof obj.ref === "string"
        ? obj.ref
        : typeof obj.label === "string"
            ? obj.label
            : "";
    // bridge.rs BOX_KEYS: &["box", "bbox", "bbox_2d", "box_2d"]
    const boxKeys = ["box", "bbox", "bbox_2d", "box_2d"];
    let rawBox;
    for (const k of boxKeys) {
        const v = obj[k];
        if (Array.isArray(v) && v.length === 4) {
            rawBox = v;
            break;
        }
    }
    if (!rawBox)
        return null;
    const nums = rawBox.map((v) => (typeof v === "number" ? v : Number(v)));
    if (nums.some(isNaN))
        return null;
    const clamp = (v) => Math.max(0, Math.min(NORM_MAX, Math.round(v)));
    let box;
    try {
        box = createBBox(clamp(nums[0]), clamp(nums[1]), clamp(nums[2]), clamp(nums[3]));
    }
    catch {
        return null;
    }
    const confidence = typeof obj.confidence === "number" ? obj.confidence : 0.0;
    return { id, type: type_, label, box, confidence };
}
function strField(obj, names) {
    for (const n of names) {
        const v = obj[n];
        if (typeof v === "string")
            return v;
    }
    return "";
}
function optStrField(obj, names) {
    for (const n of names) {
        const v = obj[n];
        if (typeof v === "string" && v.length > 0)
            return v;
    }
    return undefined;
}
// ── Image helpers ────────────────────────────────────────────────────
/** Detect MIME type from file extension. Returns undefined for unsupported formats. */
export function mimeTypeForPath(path) {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "gif":
            return "image/gif";
        case "webp":
            return "image/webp";
        default:
            return undefined;
    }
}
/** Convert image bytes to a base64 data URI. */
export function buildDataUrl(mime, bytes) {
    const base64 = typeof Buffer !== "undefined"
        ? Buffer.from(bytes).toString("base64")
        : btoa(String.fromCharCode(...bytes));
    return `data:${mime};base64,${base64}`;
}
// ── HTTP Vision Analysis ─────────────────────────────────────────────
/**
 * Run vision analysis against an OpenAI-compatible vision model API.
 *
 * POST to `{baseUrl}/chat/completions` with the image as an `image_url` content part.
 * Returns a parsed VisionAnalysis, or falls back to raw text on parse failure.
 */
export async function runVisionAnalysis(params) {
    const systemPrompt = params.primitives
        ? primitivesAnalysisPrompt()
        : noteOnlyPrompt();
    const userText = `${systemPrompt}\n\n` +
        analysisUserMessage("see attached image", params.userQuestion);
    const body = {
        model: params.model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: userText },
                    { type: "image_url", image_url: { url: params.imageDataUrl } },
                ],
            },
        ],
    };
    if (params.maxTokens > 0) {
        body.max_tokens = params.maxTokens;
    }
    const temp = Math.round(params.temperature * 10) / 10;
    if (temp > 0) {
        body.temperature = temp;
    }
    const url = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutSecs * 1000);
    let responseText;
    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${params.apiKey}`,
                "Content-Type": "application/json",
                "User-Agent": "pi-accurate-vision/0.1.0 (+https://github.com/user/pi-accurate-vision)",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        responseText = await resp.text();
        if (!resp.ok) {
            throw new Error(`Vision API HTTP ${resp.status}: ${responseText}`);
        }
    }
    finally {
        clearTimeout(timeout);
    }
    // Extract content from the OpenAI-format response
    let content;
    try {
        const parsed = JSON.parse(responseText);
        content = parsed?.choices?.[0]?.message?.content ?? "";
    }
    catch {
        throw new Error(`Failed to parse vision API response: ${responseText.slice(0, 200)}`);
    }
    // Try structured parse; fall back to raw text
    try {
        const analysis = parseAnalysisResponse(content);
        return analysis;
    }
    catch {
        // Graceful fallback (matches bridge.rs behavior)
        const fallbackNote = {
            imageOverview: content.length > 0
                ? stripMarkdownFences(content)
                : "Image processed but vision model returned empty.",
            visibleText: "",
            objectsAndLayout: "",
        };
        return {
            note: fallbackNote,
            primitives: [],
        };
    }
}
// ── Context formatting ───────────────────────────────────────────────
/** Format a VisionAnalysis into structured XML-like text for downstream consumption. */
export function formatVisionContext(analysis) {
    const parts = [];
    parts.push(`<vision-context>\n<image_overview>\n${analysis.note.imageOverview}\n</image_overview>`);
    if (analysis.note.visibleText) {
        parts.push(`<visible_text>\n${analysis.note.visibleText}\n</visible_text>`);
    }
    if (analysis.note.objectsAndLayout) {
        parts.push(`<objects_and_layout>\n${analysis.note.objectsAndLayout}\n</objects_and_layout>`);
    }
    pushOptTag(parts, "charts_or_data", analysis.note.chartsOrData);
    pushOptTag(parts, "user_request", analysis.note.userRequest);
    pushOptTag(parts, "user_request_answer", analysis.note.userRequestAnswer);
    pushOptTag(parts, "evidence", analysis.note.evidence);
    parts.push(`<visual_primitives coord="norm-1000" box_order="xyxy">`);
    if (analysis.primitives.length === 0) {
        parts.push("- unavailable | reason: no valid coordinates");
    }
    else {
        for (const prim of analysis.primitives) {
            parts.push(`- ${prim.id} | type: ${prim.type} | box: [${prim.box.x1},${prim.box.y1},${prim.box.x2},${prim.box.y2}] | ref: ${prim.label} | confidence: ${prim.confidence.toFixed(2)}`);
        }
    }
    parts.push("</visual_primitives>");
    pushOptTag(parts, "uncertainty", analysis.note.uncertainty);
    parts.push("</vision-context>");
    return parts.join("\n");
}
function pushOptTag(parts, tag, val) {
    if (val && val.length > 0) {
        parts.push(`<${tag}>\n${val}\n</${tag}>`);
    }
}
// ── Helpers ──────────────────────────────────────────────────────────
/** Strip ```json ... ``` markdown fences from a string. */
export function stripMarkdownFences(s) {
    const t = s.trim();
    if (t.startsWith("```")) {
        let inner = t.replace(/^```(?:json)?\n?/, "");
        const endIdx = inner.lastIndexOf("```");
        if (endIdx !== -1) {
            inner = inner.slice(0, endIdx).trim();
        }
        return inner;
    }
    return t;
}
//# sourceMappingURL=bridge.js.map