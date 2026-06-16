import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDotEnv } from "./config.js";

describe("parseDotEnv", () => {
	it("parses basic key=value", () => {
		assert.deepEqual(parseDotEnv("FOO=bar"), { FOO: "bar" });
	});

	it("strips export prefix", () => {
		assert.deepEqual(parseDotEnv("export FOO=bar"), { FOO: "bar" });
		assert.deepEqual(parseDotEnv("export   FOO=bar"), { FOO: "bar" });
	});

	it("strips inline comments on unquoted values", () => {
		assert.deepEqual(parseDotEnv("FOO=bar # a comment"), { FOO: "bar" });
	});

	it("preserves # inside quoted values", () => {
		assert.deepEqual(parseDotEnv('FOO="bar # baz"'), { FOO: "bar # baz" });
	});

	it("preserves # without a leading space (bar#baz)", () => {
		assert.deepEqual(parseDotEnv("FOO=bar#baz"), { FOO: "bar#baz" });
	});

	it("removes surrounding quotes", () => {
		assert.deepEqual(parseDotEnv('FOO="hello world"'), {
			FOO: "hello world",
		});
		assert.deepEqual(parseDotEnv("FOO='hello world'"), {
			FOO: "hello world",
		});
	});

	it("ignores blank lines and full-line comments", () => {
		assert.deepEqual(parseDotEnv("\n# comment\nFOO=bar\n\n"), { FOO: "bar" });
	});

	it("parses multiple entries", () => {
		assert.deepEqual(parseDotEnv("A=1\nB=2\nC=three"), {
			A: "1",
			B: "2",
			C: "three",
		});
	});
});
