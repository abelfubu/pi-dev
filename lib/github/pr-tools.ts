import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatPr, formatPrList, formatChecks } from "./format.js";

const DEFAULT_VIEW_FIELDS =
  "number,title,url,state,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,body";

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

export default function registerPrTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_pr_create",
    label: "GitHub PR Create",
    description: "Create a GitHub pull request for the current branch",
    parameters: Type.Object({
      title: Type.String({ description: "PR title" }),
      body: Type.Optional(Type.String({ description: "Markdown body" })),
      base: Type.Optional(Type.String({ description: "Base branch to merge into" })),
      head: Type.Optional(Type.String({ description: "Head branch with changes" })),
      draft: Type.Optional(
        Type.Boolean({ description: "Create as draft", default: false }),
      ),
      label: Type.Optional(
        Type.String({ description: "Labels to add (comma-separated for multiple)" }),
      ),
      assignee: Type.Optional(Type.String({ description: "Assignee login" })),
      reviewer: Type.Optional(Type.String({ description: "Reviewer login (comma-separated for multiple)" })),
      milestone: Type.Optional(Type.String({ description: "Milestone name" })),
      repo: Type.Optional(
        Type.String({ description: "Repository as OWNER/NAME" }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "create", "--title", params.title];

        if (params.body) {
          args.push("--body", params.body);
        } else {
          args.push("--fill");
        }

        if (params.base) args.push("--base", params.base);
        if (params.head) args.push("--head", params.head);
        if (params.draft) args.push("--draft");
        if (params.label) {
          for (const label of params.label.split(",").map((s) => s.trim()).filter(Boolean)) {
            args.push("--label", label);
          }
        }
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.reviewer) {
          for (const reviewer of params.reviewer.split(",").map((s) => s.trim()).filter(Boolean)) {
            args.push("--reviewer", reviewer);
          }
        }
        if (params.milestone) args.push("--milestone", params.milestone);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        const url =
          result.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ??
          result.stdout;

        return success(`Created pull request: ${url}`, { url, stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_list",
    label: "GitHub PR List",
    description: "List open pull requests in a repository",
    parameters: Type.Object({
      state: Type.Optional(
        Type.String({ description: "Filter by state: open, closed, merged, all", default: "open" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of PRs to return", default: 30 }),
      ),
      label: Type.Optional(Type.String({ description: "Filter by label" })),
      author: Type.Optional(Type.String({ description: "Filter by author login" })),
      assignee: Type.Optional(Type.String({ description: "Filter by assignee login" })),
      base: Type.Optional(Type.String({ description: "Filter by base branch" })),
      head: Type.Optional(Type.String({ description: "Filter by head branch" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "list", "--json", "number,title,state,author,isDraft,headRefName,baseRefName"];

        args.push("--state", params.state ?? "open");
        args.push("--limit", String(params.limit ?? 30));
        if (params.label) args.push("--label", params.label);
        if (params.author) args.push("--author", params.author);
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.base) args.push("--base", params.base);
        if (params.head) args.push("--head", params.head);
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatPrList(data as any[]), { prs: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_view",
    label: "GitHub PR View",
    description: "View a GitHub pull request by number, branch, or URL",
    parameters: Type.Object({
      number: Type.Optional(
        Type.Union([Type.String(), Type.Number()], {
          description: "PR number, branch name, or URL",
        }),
      ),
      repo: Type.Optional(
        Type.String({ description: "Repository as OWNER/NAME" }),
      ),
      fields: Type.Optional(
        Type.String({
          description: "Comma-separated JSON fields",
          default: DEFAULT_VIEW_FIELDS,
        }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "view"];

        if (params.number) args.push(String(params.number));
        args.push("--json", params.fields ?? DEFAULT_VIEW_FIELDS);
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);

        return success(formatPr(data), { pr: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_checks",
    label: "GitHub PR Checks",
    description: "Show CI status checks for a GitHub pull request",
    parameters: Type.Object({
      number: Type.Optional(
        Type.Union([Type.String(), Type.Number()], {
          description: "PR number, branch name, or URL",
        }),
      ),
      repo: Type.Optional(
        Type.String({ description: "Repository as OWNER/NAME" }),
      ),
      required: Type.Optional(
        Type.Boolean({
          description: "Only required checks",
          default: false,
        }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "checks"];

        if (params.number) args.push(String(params.number));
        if (params.required) args.push("--required");
        args.push("--json", "name,state,bucket,completedAt,link");
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        const checks = result.stdout ? JSON.parse(result.stdout) : [];

        return success(formatChecks(checks, result.exitCode), { checks, exitCode: result.exitCode });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_merge",
    label: "GitHub PR Merge",
    description: "Merge a GitHub pull request",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
      method: Type.Optional(
        Type.String({
          description: "Merge method: merge, squash, rebase",
          default: "merge",
        }),
      ),
      auto: Type.Optional(
        Type.Boolean({
          description: "Enable auto-merge",
          default: false,
        }),
      ),
      deleteBranch: Type.Optional(
        Type.Boolean({
          description: "Delete branch after merging",
          default: false,
        }),
      ),
      body: Type.Optional(Type.String({ description: "Merge body text" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "merge", String(params.number)];

        if (params.auto) {
          args.push("--auto");
          if (params.method) args.push(`--${params.method}`);
        } else {
          args.push(`--${params.method ?? "merge"}`);
        }
        if (params.deleteBranch) args.push("--delete-branch");
        if (params.body) args.push("--body", params.body);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Merged PR #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_comment",
    label: "GitHub PR Comment",
    description: "Add a comment to a GitHub pull request",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
      body: Type.String({ description: "Comment body (Markdown)" }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "comment", String(params.number), "--body", params.body];
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Commented on PR #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_close",
    label: "GitHub PR Close",
    description: "Close a GitHub pull request",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
      comment: Type.Optional(Type.String({ description: "Optional closing comment" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "close", String(params.number)];
        if (params.comment) args.push("--comment", params.comment);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Closed PR #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_reopen",
    label: "GitHub PR Reopen",
    description: "Reopen a GitHub pull request",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "reopen", String(params.number)];
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Reopened PR #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_review",
    label: "GitHub PR Review",
    description: "Submit a review on a GitHub pull request",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
      action: Type.String({
        description: "Review action: approve, request-changes, comment",
        default: "comment",
      }),
      body: Type.Optional(Type.String({ description: "Review comment body" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "review", String(params.number), `--${params.action}`];
        if (params.body) args.push("--body", params.body);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Reviewed PR #${params.number}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_pr_diff",
    label: "GitHub PR Diff",
    description: "Show the diff of a GitHub pull request",
    parameters: Type.Object({
      number: Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["pr", "diff", String(params.number)];
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || "No diff output.", { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
