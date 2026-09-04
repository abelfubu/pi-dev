import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHeadlessArgs, runHeadlessSubagent, truncateUtf8 } from "./headless-runner.js";

const profile = {
	name: "scout",
	backend: "headless" as const,
	tools: ["read", "bash", "subagent_notify"],
	skills: ["skills/check"],
	promptTemplates: [],
};

describe("headless subagent arguments", () => {
	it("starts with a lean resource context and applies model and thinking", () => {
		const args = buildHeadlessArgs({
			cwd: "/repo",
			profile,
			model: "provider/model",
			thinking: "high",
			files: ["/repo/a.ts"],
			promptFile: "/tmp/prompt.md",
		});

		expect(args).toEqual([
			"--mode", "json", "-p", "--no-session", "--approve",
			"--no-extensions", "--no-skills", "--no-prompt-templates",
			"--model", "provider/model", "--thinking", "high",
			"--tools", "read,bash",
			"--skill", "/repo/skills/check",
			"@/repo/a.ts", "@/tmp/prompt.md",
		]);
	});
});

describe("headless subagent execution", () => {
	it("captures the final response and usage from JSON mode", async () => {
		const dir = await mkdtemp(join(tmpdir(), "headless-runner-test-"));
		const promptFile = join(dir, "prompt.md");
		await writeFile(promptFile, "hi", "utf8");
		const childScript = `
const messages = [
 {role:"assistant",content:[{type:"text",text:"working"}],usage:{input:10,output:2,cacheRead:3,cacheWrite:1,cost:{total:0.01},totalTokens:16},stopReason:"toolUse"},
 {role:"assistant",provider:"test",model:"small",content:[{type:"text",text:"final answer"}],usage:{input:20,output:4,cacheRead:5,cacheWrite:0,cost:{total:0.02},totalTokens:29},stopReason:"stop"}
];
for (const message of messages) console.log(JSON.stringify({type:"message_end",message}));`;
		try {
			const result = await runHeadlessSubagent({
				cwd: dir,
				profile,
				files: [],
				promptFile,
				maxConcurrency: 4,
				piCommand: { command: process.execPath, args: ["-e", childScript, "--"] },
			});

			expect(result.status).toBe("completed");
			expect(result.output).toBe("final answer");
			expect(result.model).toBe("test/small");
			expect(result.usage).toMatchObject({
				input: 30,
				output: 6,
				cacheRead: 8,
				cacheWrite: 1,
				cost: 0.03,
				turns: 2,
				contextTokens: 29,
			});
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("serializes writer profiles that share a working directory", async () => {
		const dir = await mkdtemp(join(tmpdir(), "headless-writer-test-"));
		const promptFile = join(dir, "prompt.md");
		const logFile = join(dir, "runs.log");
		await writeFile(promptFile, "work", "utf8");
		const childScript = `
const fs = require("node:fs");
fs.appendFileSync(${JSON.stringify(logFile)}, "start\\n");
setTimeout(() => {
 fs.appendFileSync(${JSON.stringify(logFile)}, "end\\n");
 console.log(JSON.stringify({type:"message_end",message:{role:"assistant",content:[{type:"text",text:"done"}],stopReason:"stop"}}));
}, 40);`;
		const writerProfile = { name: "coder", tools: ["read", "write"] };
		try {
			await Promise.all([1, 2].map(() => runHeadlessSubagent({
				cwd: dir,
				profile: writerProfile,
				files: [],
				promptFile,
				maxConcurrency: 4,
				piCommand: { command: process.execPath, args: ["-e", childScript, "--"] },
			})));
			expect(await readFile(logFile, "utf8")).toBe("start\nend\nstart\nend\n");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("aborts a running child and preserves its failure transcript", async () => {
		const dir = await mkdtemp(join(tmpdir(), "headless-abort-test-"));
		const promptFile = join(dir, "prompt.md");
		await writeFile(promptFile, "wait", "utf8");
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 30);
		const result = await runHeadlessSubagent({
			cwd: dir,
			profile,
			files: [],
			promptFile,
			maxConcurrency: 4,
			signal: controller.signal,
			piCommand: { command: process.execPath, args: ["-e", "setInterval(() => {}, 1000)", "--"] },
		});
		try {
			expect(result.status).toBe("aborted");
			expect(result.failureTranscript && existsSync(result.failureTranscript)).toBe(true);
		} finally {
			if (result.failureTranscript) await rm(result.failureTranscript, { force: true });
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("model-visible output", () => {
	it("caps UTF-8 output without splitting a character", () => {
		const output = truncateUtf8("🙂".repeat(30), 64);
		expect(Buffer.byteLength(output, "utf8")).toBeLessThanOrEqual(64);
		expect(output).toContain("Output truncated");
		expect(output).not.toContain("�");
	});
});
