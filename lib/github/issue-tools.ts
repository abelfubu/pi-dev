import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerGhActionTool, type GhActionToolConfig } from "./tool.js";
import { formatIssue, formatIssueList } from "./format.js";

const ISSUE_VIEW_FIELDS = "number,title,url,state,author,createdAt,labels,body";

const IssueAction = Type.Union([
  Type.Literal("create"),
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("comment"),
  Type.Literal("close"),
  Type.Literal("reopen"),
]);

interface IssueParams extends Record<string, unknown> {
  action: string;
  repo?: string;
  number?: string | number;
  title?: string;
  body?: string;
  state?: string;
  limit?: number;
  label?: string;
  assignee?: string;
  milestone?: string;
  author?: string;
  reason?: string;
  comment?: string;
}

export const issueToolConfig: GhActionToolConfig<IssueParams> = {
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
  handlers: {
    create: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.title) {
          throw new Error("title is required for create");
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
        return args;
      },
      format: (result) => {
        const { stdout } = result as { stdout: string };
        const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? stdout;
        return `Created issue: ${url}`;
      },
    },
    list: {
      runType: "json",
      buildArgs: (params) => {
        const args = ["issue", "list", "--json", "number,title,state,author,createdAt"];
        args.push("--state", params.state ?? "open");
        args.push("--limit", String(params.limit ?? 30));
        if (params.label) args.push("--label", params.label);
        if (params.author) args.push("--author", params.author);
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.milestone) args.push("--milestone", params.milestone);
        return args;
      },
      format: (result) => formatIssueList(result as any[]),
    },
    view: {
      runType: "json",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for view");
        }
        return ["issue", "view", String(params.number), "--json", ISSUE_VIEW_FIELDS];
      },
      format: (result) => formatIssue(result),
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
        return ["issue", "comment", String(params.number), "--body", params.body];
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Commented on issue #${params.number}.`;
      },
    },
    close: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for close");
        }
        const args = [
          "issue",
          "close",
          String(params.number),
          "--reason",
          params.reason ?? "completed",
        ];
        if (params.comment) args.push("--comment", params.comment);
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Closed issue #${params.number}.`;
      },
    },
    reopen: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.number) {
          throw new Error("number is required for reopen");
        }
        return ["issue", "reopen", String(params.number)];
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Reopened issue #${params.number}.`;
      },
    },
  },
};

export default function registerIssueTools(pi: ExtensionAPI) {
  registerGhActionTool<IssueParams>(pi, issueToolConfig);
}
