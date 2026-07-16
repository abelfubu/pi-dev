import { describe, expect, it, vi } from "vitest";
import {
	buildSubagentLabel,
	extractJiraIssueKey,
	folderName,
	sanitizeLabel,
	taskHeadline,
} from "./herdr-tools.js";

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
