import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	assistantMessageText,
	buildPiArgs,
	buildSubagentLabel,
	buildSubagentPrompt,
	completionSummary,
	ensureResultArtifact,
	expandConfigPath,
	extractJiraIssueKey,
	folderName,
	isDuplicateCompletion,
	latestAssistantText,
	mergeProfiles,
	resolveSubagentModel,
	sanitizeLabel,
	taskHeadline,
} from "./herdr-tools.js";

describe("subagent completion", () => {
	it("includes the launch id in the prompt and notification instructions", () => {
		const prompt = buildSubagentPrompt({
			task: "Inspect the code",
			profile: "scout",
			parentPaneId: "parent-pane",
			resultFile: "/tmp/result.md",
			launchId: "launch-123",
		});

		expect(prompt).toContain("Launch ID: launch-123");
		expect(prompt).toContain("launch_id: launch-123");
	});

	it("extracts the latest assistant text from session entries", () => {
		const ctx = {
			sessionManager: {
				getBranch: () => [
					{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "older" }] } },
					{ type: "message", message: { role: "toolResult", content: [{ type: "text", text: "ignored" }] } },
					{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "final result" }] } },
				],
			},
		};

		expect(latestAssistantText(ctx)).toBe("final result");
		expect(assistantMessageText({ role: "user", content: "ignored" })).toBeUndefined();
	});

	it("writes a fallback artifact only when the result is missing or empty", async () => {
		const dir = await mkdtemp(join(tmpdir(), "herdr-tools-test-"));
		const resultFile = join(dir, "result.md");
		try {
			expect(await ensureResultArtifact(resultFile, "fallback result")).toBe(true);
			expect(await readFile(resultFile, "utf8")).toBe("fallback result\n");

			await writeFile(resultFile, "agent-authored result\n", "utf8");
			expect(await ensureResultArtifact(resultFile, "must not replace")).toBe(false);
			expect(await readFile(resultFile, "utf8")).toBe("agent-authored result\n");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("deduplicates completion messages by launch id", () => {
		const completed = new Set<string>();
		expect(isDuplicateCompletion("launch-123", completed)).toBe(false);
		expect(isDuplicateCompletion("launch-123", completed)).toBe(true);
		expect(isDuplicateCompletion(undefined, completed)).toBe(false);
	});

	it("uses the first response line as a bounded summary", () => {
		expect(completionSummary("Completed the task\nMore detail", "fallback")).toBe("Completed the task");
		expect(completionSummary(undefined, "fallback")).toBe("fallback");
	});
});

describe("resolveSubagentModel", () => {
	it("prefers a non-empty explicit model", () => {
		expect(resolveSubagentModel("openai-codex/gpt-5.6-sol", "kimi-coding/kimi-for-coding"))
			.toBe("openai-codex/gpt-5.6-sol");
	});

	it("falls back to the profile model for an empty explicit model", () => {
		expect(resolveSubagentModel("", "kimi-coding/kimi-for-coding"))
			.toBe("kimi-coding/kimi-for-coding");
		expect(resolveSubagentModel("   ", "kimi-coding/kimi-for-coding"))
			.toBe("kimi-coding/kimi-for-coding");
	});

	it("returns undefined when neither model is configured", () => {
		expect(resolveSubagentModel()).toBeUndefined();
	});
});

describe("sanitizeLabel", () => {
	it("trims whitespace and collapses runs of spaces", () => {
		expect(sanitizeLabel("  hello   world  ")).toBe("hello world");
	});

	it("truncates long labels to 32 characters with an ellipsis", () => {
		const long = "a".repeat(80);
		expect(sanitizeLabel(long)).toBe(`${"a".repeat(31)}…`);
	});
});

describe("extractJiraIssueKey", () => {
	it("finds the first Jira-style issue key", () => {
		expect(extractJiraIssueKey("Fix the bug in ITA-123 and TEST-99")).toBe("ITA-123");
	});

	it("returns undefined when no key is present", () => {
		expect(extractJiraIssueKey("Just a regular task description")).toBeUndefined();
	});

	it("ignores keys that start with a lowercase letter", () => {
		expect(extractJiraIssueKey("See abc-123 for details")).toBeUndefined();
	});
});

describe("taskHeadline", () => {
	it("takes the first non-empty line", () => {
		expect(taskHeadline("\n\nFirst line\nSecond line")).toBe("First line");
	});

	it("strips markdown heading markers", () => {
		expect(taskHeadline("## Fix the login bug")).toBe("Fix the login bug");
	});

	it("removes backticks", () => {
		expect(taskHeadline("Update `useAuth` hook")).toBe("Update useAuth hook");
	});

	it("truncates long lines with an ellipsis", () => {
		const long = "a".repeat(50);
		expect(taskHeadline(long)).toBe(`${"a".repeat(40)}…`);
	});
});

describe("folderName", () => {
	it("returns the basename when it differs from cwd", () => {
		vi.spyOn(process, "cwd").mockReturnValue("/home/user/project");
		expect(folderName("/home/user/project/src/auth")).toBe("auth");
	});

	it("returns undefined when the folder is the same as cwd", () => {
		vi.spyOn(process, "cwd").mockReturnValue("/home/user/project");
		expect(folderName("/home/user/project")).toBeUndefined();
	});
});

describe("mergeProfiles", () => {
	it("overrides fields field-by-field, keeping base values otherwise", () => {
		const merged = mergeProfiles(
			{ name: "coder", layout: "tab", tools: ["read", "bash"], skills: [] },
			{ model: "openai:gpt-4o" },
		);
		expect(merged).toEqual({
			name: "coder",
			layout: "tab",
			tools: ["read", "bash"],
			skills: [],
			model: "openai:gpt-4o",
		});
	});

	it("lets an override clear tools with an explicit allowlist", () => {
		const merged = mergeProfiles(
			{ name: "coder", tools: ["read", "bash"] },
			{ tools: ["read"] },
		);
		expect(merged.tools).toEqual(["read"]);
	});
});

describe("expandConfigPath", () => {
	it("expands a leading tilde", () => {
		expect(expandConfigPath("~/skills/check", "/repo")).toBe(`${process.env.HOME}/skills/check`);
	});

	it("resolves relative paths against the cwd", () => {
		expect(expandConfigPath("skills/check", "/repo")).toBe("/repo/skills/check");
	});

	it("keeps absolute paths", () => {
		expect(expandConfigPath("/opt/skills/x", "/repo")).toBe("/opt/skills/x");
	});
});

describe("buildPiArgs", () => {
	it("passes --tools with subagent_notify appended when missing", () => {
		const args = buildPiArgs({
			profile: { name: "scout", tools: ["read", "bash"], skills: [], promptTemplates: [] },
			files: [],
			promptFile: "/tmp/prompt.md",
			cwd: "/repo",
		});
		expect(args).toContain("--tools");
		expect(args[args.indexOf("--tools") + 1]).toBe("read,bash,subagent_notify");
		expect(args).toContain("--no-skills");
		expect(args).toContain("--no-prompt-templates");
		expect(args.at(-1)).toBe("@/tmp/prompt.md");
	});

	it("does not duplicate subagent_notify when already allowed", () => {
		const args = buildPiArgs({
			profile: { name: "coder", tools: ["bash", "subagent_notify"] },
			files: [],
			promptFile: "/tmp/prompt.md",
			cwd: "/repo",
		});
		expect(args[args.indexOf("--tools") + 1]).toBe("bash,subagent_notify");
	});

	it("passes explicit skills and prompt templates with resolved paths", () => {
		const args = buildPiArgs({
			profile: {
				name: "coder",
				skills: ["skills/check"],
				promptTemplates: ["~/prompts/tdd.md"],
			},
			files: [],
			promptFile: "/tmp/prompt.md",
			cwd: "/repo",
		});
		expect(args).toContain("--no-skills");
		expect(args).toContain("--skill");
		expect(args[args.indexOf("--skill") + 1]).toBe("/repo/skills/check");
		expect(args).toContain("--no-prompt-templates");
		expect(args).toContain("--prompt-template");
		expect(args[args.indexOf("--prompt-template") + 1]).toBe(`${process.env.HOME}/prompts/tdd.md`);
	});

	it("omits tool/skill flags when the profile leaves them undefined", () => {
		const args = buildPiArgs({
			profile: { name: "custom" },
			model: "openai:gpt-4o",
			files: ["/repo/a.ts"],
			promptFile: "/tmp/prompt.md",
			cwd: "/repo",
		});
		expect(args).toEqual(["--model", "openai:gpt-4o", "@/repo/a.ts", "@/tmp/prompt.md"]);
	});

	it("passes --exclude-tools when configured", () => {
		const args = buildPiArgs({
			profile: { name: "coder", excludeTools: ["write", "edit"] },
			files: [],
			promptFile: "/tmp/prompt.md",
			cwd: "/repo",
		});
		expect(args).toContain("--exclude-tools");
		expect(args[args.indexOf("--exclude-tools") + 1]).toBe("write,edit");
	});
});

describe("buildSubagentLabel", () => {
	it("uses an explicit title when provided", () => {
		expect(
			buildSubagentLabel({
				title: "Custom title",
				profile: "coder",
				task: "Ignored",
				cwd: "/repo",
			}),
		).toBe("Custom title");
	});

	it("caps explicit titles too", () => {
		expect(
			buildSubagentLabel({
				title: "a".repeat(80),
				profile: "coder",
				task: "Ignored",
				cwd: "/repo",
			}),
		).toBe(`${"a".repeat(31)}…`);
	});

	it("includes issue key, headline, profile, and folder", () => {
		vi.spyOn(process, "cwd").mockReturnValue("/repo");
		expect(
			buildSubagentLabel({
				profile: "coder",
				task: "ITA-123: fix the login bug",
				cwd: "/repo/src/auth",
			}),
		).toBe("ITA-123 fix the lo… [coder/auth]");
	});

	it("omits the issue key and folder when not present", () => {
		vi.spyOn(process, "cwd").mockReturnValue("/repo");
		expect(
			buildSubagentLabel({
				profile: "reviewer",
				task: "Review the auth refactor",
				cwd: "/repo",
			}),
		).toBe("Review the auth refa… [reviewer]");
	});
});
