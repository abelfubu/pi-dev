import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatIssue, formatIssueList } from "./format.js";

const ISSUE_VIEW_FIELDS =
  "number,title,url,state,author,createdAt,labels,body";

function getCwd(ctx?: { cwd?: string }): string {
  return ctx?.cwd ?? process.cwd();
}

function repoFlag(args: string[], repo?: string): void {
  if (repo) args.push("--repo", repo);
}

function success(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details: details ?? {} };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true as const, details: {} };
}

export default function registerIssueTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_issue_create",
    label: "GitHub Issue Create",
    description: "Create a GitHub issue",
    parameters: Type.Object({
      title: Type.String({ description: "Issue title" }),
      body: Type.Optional(Type.String({ description: "Markdown body" })),
      label: Type.Optional(
        Type.String({ description: "Labels to add (comma-separated for multiple)" }),
      ),
      assignee: Type.Optional(Type.String({ description: "Assignee login" })),
      milestone: Type.Optional(Type.String({ description: "Milestone name" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["issue", "create", "--title", params.title];

        if (params.body) args.push("--body", params.body);
        if (params.label) {
          for (const label of params.label.split(",").map((s) => s.trim()).filter(Boolean)) {
            args.push("--label", label);
          }
        }
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.milestone) args.push("--milestone", params.milestone);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        const url = result.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? result.stdout;

        return success(`Created issue: ${url}`, { url, stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_issue_list",
    label: "GitHub Issue List",
    description: "List issues in a repository",
    parameters: Type.Object({
      state: Type.Optional(
        Type.String({ description: "Filter by state: open, closed, all", default: "open" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of issues to return", default: 30 }),
      ),
      label: Type.Optional(Type.String({ description: "Filter by label" })),
      author: Type.Optional(Type.String({ description: "Filter by author login" })),
      assignee: Type.Optional(Type.String({ description: "Filter by assignee login" })),
      milestone: Type.Optional(Type.String({ description: "Filter by milestone" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["issue", "list", "--json", "number,title,state,author,createdAt"];

        args.push("--state", params.state ?? "open");
        args.push("--limit", String(params.limit ?? 30));
        if (params.label) args.push("--label", params.label);
        if (params.author) args.push("--author", params.author);
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.milestone) args.push("--milestone", params.milestone);
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatIssueList(data as any[]), { issues: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_issue_view",
    label: "GitHub Issue View",
    description: "View a GitHub issue by number",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "Issue number",
      }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["issue", "view", String(params.number), "--json", ISSUE_VIEW_FIELDS];
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatIssue(data), { issue: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_issue_comment",
    label: "GitHub Issue Comment",
    description: "Add a comment to a GitHub issue",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "Issue number",
      }),
      body: Type.String({ description: "Comment body (Markdown)" }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["issue", "comment", String(params.number), "--body", params.body];
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Commented on issue #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_issue_close",
    label: "GitHub Issue Close",
    description: "Close a GitHub issue",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "Issue number",
      }),
      reason: Type.Optional(
        Type.String({ description: "Close reason: completed, not_planned", default: "completed" }),
      ),
      comment: Type.Optional(Type.String({ description: "Optional closing comment" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["issue", "close", String(params.number), "--reason", params.reason ?? "completed"];
        if (params.comment) args.push("--comment", params.comment);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Closed issue #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_issue_reopen",
    label: "GitHub Issue Reopen",
    description: "Reopen a GitHub issue",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "Issue number",
      }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["issue", "reopen", String(params.number)];
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Reopened issue #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
