import { describe, expect, it, vi } from "vitest";
import registerSubagentTools from "./subagent-tools.js";
import { buildHeadlessSubagentPrompt } from "../lib/subagent/prompt.js";

describe("subagent tool registration", () => {
	it("registers one narrow delegation tool outside Herdr", () => {
		const registerTool = vi.fn();
		registerSubagentTools({ registerTool } as never);
		expect(registerTool).toHaveBeenCalledTimes(1);
		expect(registerTool.mock.calls[0][0].name).toBe("subagent");
	});
});

describe("headless prompt", () => {
	it("renders the coder plan without a model-owned completion protocol", () => {
		const prompt = buildHeadlessSubagentPrompt({
			profile: "coder",
			task: "Implement it",
			implementationPlan: {
				intent: "Reduce context",
				modifications: ["extensions/subagent-tools.ts"],
				additions: [],
			},
		});
		expect(prompt.indexOf("## Implementation plan")).toBeLessThan(prompt.indexOf("## Task"));
		expect(prompt).toContain("Return the complete result in your final response.");
		expect(prompt).not.toContain("subagent_notify");
		expect(prompt).not.toContain("Result file");
	});
});
