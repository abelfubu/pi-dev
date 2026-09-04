import { describe, expect, it } from "vitest";
import { resolveSubagentExecution } from "./config.js";

describe("subagent execution configuration", () => {
	it("defaults to headless execution", () => {
		expect(resolveSubagentExecution({ name: "scout" }, {})).toEqual({
			backend: "headless",
			model: undefined,
			thinking: undefined,
		});
	});

	it("lets invocation values override profile values", () => {
		expect(resolveSubagentExecution(
			{ name: "reviewer", backend: "herdr", model: "profile/model", thinking: "low" },
			{ backend: "headless", model: "call/model", thinking: "high" },
		)).toEqual({ backend: "headless", model: "call/model", thinking: "high" });
	});
});
