import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatIssue, formatIssueList } from "./format.js";

const ISSUE_VIEW_FIELDS = "number,title,url,state,author,createdAt,labels,body";

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

const IssueAction = Type.Union([
  Type.Literal("create"),
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("comment"),
  Type.Literal("close"),
  Type.Literal("reopen"),
]);

export default function registerIssueTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_issue",
    label: "GitHub Issue",
    description: "Perform a GitHub issue operation: create, list, view, comment, close, or reopen",
    parameters: Type.Object({
      action: IssueAction,
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
      number: Type.Optional(
        Type.Union([Type.String(), Type.Number()], { description: "Issue number" }),
      ),
      title: Type.Optional(Type.String({ description: "Issue title (create)" })),
      body: Type.Optional(Type.String({ description: "Markdown body (create/comment)" })),
      state: Type.Optional(
        Type.String({
          description: "Filter by state: open, closed, all (list)",
          default: "open",
        }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of issues (list)", default: 30 }),
      ),
      label: Type.Optional(
        Type.String({ description: "Label to add or filter, comma-separated (create/list)" }),
      ),
      assignee: Type.Optional(Type.String({ description: "Assignee login (create/list)" })),
      milestone: Type.Optional(Type.String({ description: "Milestone name (create/list)" })),
      author: Type.Optional(Type.String({ description: "Filter by author login (list)" })),
      reason: Type.Optional(
        Type.String({
          description: "Close reason: completed, not_planned (close)",
          default: "completed",
        }),
      ),
      comment: Type.Optional(
        Type.String({ description: "Optional closing comment (close)" }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const action = params.action as string;

        if (action === "create") {
          if (!params.title) {
            return errorResult(new Error("title is required for create"));
          }
          const args = ["issue", "create", "--title", params.title];
          if (params.body) args.push("--body", params.body);
          if (params.label) {
            for (const label of params.label
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)) {
              args.push("--label", label);
            }
          }
          if (params.assignee) args.push("--assignee", params.assignee);
          if (params.milestone) args.push("--milestone", params.milestone);
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          const url = result.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? result.stdout;

          return success(`Created issue: ${url}`, { url, stdout: result.stdout });
        }

        if (action === "list") {
          const args = ["issue", "list", "--json", "number,title,state,author,createdAt"];
          args.push("--state", (params.state as string) ?? "open");
          args.push("--limit", String((params.limit as number) ?? 30));
          if (params.label) args.push("--label", params.label);
          if (params.author) args.push("--author", params.author);
          if (params.assignee) args.push("--assignee", params.assignee);
          if (params.milestone) args.push("--milestone", params.milestone);
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatIssueList(data as any[]), { issues: data });
        }

        if (action === "view") {
          if (!params.number) {
            return errorResult(new Error("number is required for view"));
          }
          const args = ["issue", "view", String(params.number), "--json", ISSUE_VIEW_FIELDS];
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatIssue(data), { issue: data });
        }

        if (action === "comment") {
          if (!params.number) {
            return errorResult(new Error("number is required for comment"));
          }
          if (!params.body) {
            return errorResult(new Error("body is required for comment"));
          }
          const args = ["issue", "comment", String(params.number), "--body", params.body];
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Commented on issue #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "close") {
          if (!params.number) {
            return errorResult(new Error("number is required for close"));
          }
          const args = [
            "issue",
            "close",
            String(params.number),
            "--reason",
            (params.reason as string) ?? "completed",
          ];
          if (params.comment) args.push("--comment", params.comment);
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Closed issue #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        if (action === "reopen") {
          if (!params.number) {
            return errorResult(new Error("number is required for reopen"));
          }
          const args = ["issue", "reopen", String(params.number)];
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Reopened issue #${params.number}.`, {
            stdout: result.stdout,
          });
        }

        return errorResult(new Error(`Unknown issue action: ${action}`));
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
