import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import registerSubagentTools from "./subagent-tools.js";
import { buildHeadlessSubagentPrompt } from "../lib/subagent/prompt.js";
import * as headlessRunner from "../lib/subagent/headless-runner.js";

const tempDirs: string[] = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("subagent tool registration", () => {
	it("registers one narrow delegation tool outside Herdr", () => {
		const registerTool = vi.fn();
		registerSubagentTools({ registerTool, on: vi.fn() } as never);
		expect(registerTool).toHaveBeenCalledTimes(1);
		expect(registerTool.mock.calls[0][0].name).toBe("subagent");
	});

	it("returns immediately and delivers a headless result with the next user prompt", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "subagent-tool-test-"));
		tempDirs.push(cwd);
		let finish!: (result: headlessRunner.HeadlessSubagentResult) => void;
		const pending = new Promise<headlessRunner.HeadlessSubagentResult>((resolve) => { finish = resolve; });
		let promptFile = "";
		vi.spyOn(headlessRunner, "runHeadlessSubagent").mockImplementation(async (options) => {
			promptFile = options.promptFile;
			return pending;
		});
		const registerTool = vi.fn();
		const sendMessage = vi.fn();
		registerSubagentTools({ registerTool, sendMessage, on: vi.fn() } as never);
		const tool = registerTool.mock.calls[0][0];
		const notify = vi.fn();

		const launch = await tool.execute("call-1", { profile: "reviewer", task: "Review it", cwd }, undefined, undefined, { cwd, ui: { notify } });

		expect(launch.details).toMatchObject({ backend: "headless", profile: "reviewer", status: "running" });
		expect(launch.content[0].text).toContain("run in the background");
		expect(sendMessage).not.toHaveBeenCalled();
		expect(existsSync(promptFile)).toBe(true);

		finish({
			status: "completed",
			output: "review complete",
			model: "test/model",
			usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 1, contextTokens: 3 },
			exitCode: 0,
			messages: [],
		});
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
		expect(sendMessage.mock.calls[0][0]).toMatchObject({ customType: "subagent-result", display: true });
		expect(sendMessage.mock.calls[0][0].content).toContain("review complete");
		expect(sendMessage.mock.calls[0][1]).toEqual({ deliverAs: "nextTurn" });
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("completed"), "info");
		await vi.waitFor(() => expect(existsSync(promptFile)).toBe(false));
	});

	it("aborts active headless jobs on session shutdown without delivering them", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "subagent-shutdown-test-"));
		tempDirs.push(cwd);
		let runSignal: AbortSignal | undefined;
		let finish!: (result: headlessRunner.HeadlessSubagentResult) => void;
		vi.spyOn(headlessRunner, "runHeadlessSubagent").mockImplementation((options) => {
			runSignal = options.signal;
			return new Promise((resolve) => { finish = resolve; });
		});
		const registerTool = vi.fn();
		const sendMessage = vi.fn();
		let shutdown!: () => void;
		const on = vi.fn((event, handler) => { if (event === "session_shutdown") shutdown = handler; });
		registerSubagentTools({ registerTool, sendMessage, on } as never);
		const tool = registerTool.mock.calls[0][0];

		await tool.execute("call-2", { profile: "scout", task: "Inspect", cwd }, undefined, undefined, { cwd, ui: { notify: vi.fn() } });
		shutdown();

		expect(runSignal?.aborted).toBe(true);
		finish({
			status: "aborted",
			output: "",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0, contextTokens: 0 },
			exitCode: null,
			messages: [],
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sendMessage).not.toHaveBeenCalled();
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
