import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerGhActionTool, type GhActionToolConfig } from "./tool.js";
import { formatPr, formatPrList, formatChecks } from "./format.js";

const DEFAULT_VIEW_FIELDS =
  "number,title,url,state,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,body";

const PrAction = Type.Union([
  Type.Literal("create"),
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("checks"),
  Type.Literal("merge"),
  Type.Literal("comment"),
  Type.Literal("close"),
  Type.Literal("reopen"),
  Type.Literal("review"),
  Type.Literal("diff"),
]);

interface PrParams extends Record<string, unknown> {
  action: string;
  repo?: string;
  number?: string | number;
  title?: string;
  body?: string;
  base?: string;
  head?: string;
  draft?: boolean;
  label?: string;
  assignee?: string;
  reviewer?: string;
  milestone?: string;
  method?: string;
  auto?: boolean;
  deleteBranch?: boolean;
  comment?: string;
  required?: boolean;
  fields?: string;
  reviewAction?: string;
  state?: string;
  author?: string;
  limit?: number;
}

export const prToolConfig: GhActionToolConfig<PrParams> = {
  name: "gh_pr",
  label: "GitHub Pull Request",
  description:
    "Perform a GitHub pull request operation: create, list, view, checks, merge, comment, close, reopen, review, or diff",
  parameters: Type.Object({
    action: PrAction,
    repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    number: Type.Optional(
      Type.Union([Type.String(), Type.Number()], {
        description: "PR number, branch name, or URL",
      }),
    ),
    title: Type.Optional(Type.String({ description: "PR title (for create)" })),
    body: Type.Optional(
      Type.String({ description: "Markdown body (for create, comment, or review)" }),
    ),
    base: Type.Optional(Type.String({ description: "Base branch to merge into (create)" })),
    head: Type.Optional(Type.String({ description: "Head branch with changes (create)" })),
    draft: Type.Optional(Type.Boolean({ description: "Create as draft", default: false })),
    label: Type.Optional(
      Type.String({ description: "Labels to add or filter, comma-separated (create/list)" }),
    ),
    assignee: Type.Optional(Type.String({ description: "Assignee login (create/list)" })),
    reviewer: Type.Optional(
      Type.String({ description: "Reviewer login, comma-separated (create)" }),
    ),
    milestone: Type.Optional(Type.String({ description: "Milestone name (create)" })),
    method: Type.Optional(
      Type.String({ description: "Merge method: merge, squash, rebase", default: "merge" }),
    ),
    auto: Type.Optional(
      Type.Boolean({ description: "Enable auto-merge (merge)", default: false }),
    ),
    deleteBranch: Type.Optional(
      Type.Boolean({ description: "Delete branch after merging (merge)", default: false }),
    ),
    comment: Type.Optional(
      Type.String({ description: "Optional closing comment (close)" }),
    ),
    required: Type.Optional(
      Type.Boolean({ description: "Only required checks (checks)", default: false }),
    ),
    fields: Type.Optional(
      Type.String({
        description: "Comma-separated JSON fields (view)",
        default: DEFAULT_VIEW_FIELDS,
      }),
    ),
    reviewAction: Type.Optional(
      Type.String({
        description: "Review action: approve, request-changes, comment (review)",
        default: "comment",
      }),
    ),
    state: Type.Optional(
      Type.String({
        description: "Filter by state: open, closed, merged, all (list)",
        default: "open",
      }),
    ),
    author: Type.Optional(Type.String({ description: "Filter by author login (list)" })),
    limit: Type.Optional(
      Type.Number({ description: "Maximum number of results (list)", default: 30 }),
    ),
  }),
  handlers: {
    create: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.title) {
          throw new Error("title is required for create");
        }
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
          for (const label of params.label
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)) {
            args.push("--label", label);
          }
        }
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.reviewer) {
          for (const reviewer of params.reviewer
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)) {
            args.push("--reviewer", reviewer);
          }
        }
        if (params.milestone) args.push("--milestone", params.milestone);
        return args;
      },
      format: (result) => {
        const { stdout } = result as { stdout: string };
        const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? stdout;
        return `Created pull request: ${url}`;
      },
    },
    list: {
      runType: "json",
      buildArgs: (params) => {
        const args = [
          "pr",
          "list",
          "--json",
          "number,title,state,author,isDraft,headRefName,baseRefName",
        ];
        args.push("--state", params.state ?? "open");
        args.push("--limit", String(params.limit ?? 30));
        if (params.label) args.push("--label", params.label);
        if (params.author) args.push("--author", params.author);
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.base) args.push("--base", params.base);
        if (params.head) args.push("--head", params.head);
        return args;
      },
      format: (result) => formatPrList(result as any[]),
    },
    view: {
      runType: "json",
      buildArgs: (params) => {
        const args = ["pr", "view"];
        if (params.number) args.push(String(params.number));
        args.push("--json", params.fields ?? DEFAULT_VIEW_FIELDS);
        return args;
      },
      format: (result) => formatPr(result),
    },
    checks: {
      runType: "text",
      buildArgs: (params) => {
        const args = ["pr", "checks"];
        if (params.number) args.push(String(params.number));
        if (params.required) args.push("--required");
        args.push("--json", "name,state,bucket,completedAt,link");
        return args;
      },
      format: (result) => {
        const { stdout, exitCode } = result as { stdout: string; exitCode: number };
        const checks = stdout ? JSON.parse(stdout) : [];
        return formatChecks(checks, exitCode);
      },
    },
    merge: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for merge");
        }
        const args = ["pr", "merge", String(params.number)];
        if (params.auto) {
          args.push("--auto");
          if (params.method) args.push(`--${params.method}`);
        } else {
          args.push(`--${params.method ?? "merge"}`);
        }
        if (params.deleteBranch) args.push("--delete-branch");
        if (params.body) args.push("--body", params.body);
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Merged PR #${params.number}.`;
      },
    },
    comment: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for comment");
        }
        if (!params.body) {
          throw new Error("body is required for comment");
        }
        return ["pr", "comment", String(params.number), "--body", params.body];
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Commented on PR #${params.number}.`;
      },
    },
    close: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for close");
        }
        const args = ["pr", "close", String(params.number)];
        if (params.comment) args.push("--comment", params.comment);
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Closed PR #${params.number}.`;
      },
    },
    reopen: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for reopen");
        }
        return ["pr", "reopen", String(params.number)];
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Reopened PR #${params.number}.`;
      },
    },
    review: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for review");
        }
        const args = ["pr", "review", String(params.number), `--${params.reviewAction ?? "comment"}`];
        if (params.body) args.push("--body", params.body);
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Reviewed PR #${params.number}.`;
      },
    },
    diff: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for diff");
        }
        return ["pr", "diff", String(params.number)];
      },
      format: (result) => {
        const { stdout } = result as { stdout: string };
        return stdout || "No diff output.";
      },
    },
  },
};

export default function registerPrTools(pi: ExtensionAPI) {
  registerGhActionTool<PrParams>(pi, prToolConfig);
}
