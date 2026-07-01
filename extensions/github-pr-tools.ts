import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "../lib/github-pr/runner.js";
import { formatPr, formatChecks } from "../lib/github-pr/format.js";

const DEFAULT_VIEW_FIELDS =
  "number,title,url,state,headRefName,baseRefName,isDraft,mergeable,mergeStateStatus,body";

export default function (pi: ExtensionAPI) {
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
      repo: Type.Optional(
        Type.String({ description: "Repository as OWNER/NAME" }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const args = ["pr", "create", "--title", params.title];

        if (params.body) {
          args.push("--body", params.body);
        } else {
          args.push("--fill");
        }

        if (params.base) args.push("--base", params.base);
        if (params.head) args.push("--head", params.head);
        if (params.draft) args.push("--draft");
        if (params.repo) args.push("--repo", params.repo);

        const result = await runGh(args, cwd);
        const url =
          result.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ??
          result.stdout;

        return {
          content: [{ type: "text", text: `Created pull request: ${url}` }],
          details: { url, stdout: result.stdout },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
          details: {},
        };
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
        const cwd = ctx?.cwd ?? process.cwd();
        const args = ["pr", "view"];

        if (params.number) args.push(String(params.number));
        args.push("--json", params.fields ?? DEFAULT_VIEW_FIELDS);
        if (params.repo) args.push("--repo", params.repo);

        const data = await runGhJson(args, cwd);

        return {
          content: [{ type: "text", text: formatPr(data) }],
          details: data,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
          details: {},
        };
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
        const cwd = ctx?.cwd ?? process.cwd();
        const args = ["pr", "checks"];

        if (params.number) args.push(String(params.number));
        if (params.required) args.push("--required");
        args.push("--json", "name,state,bucket,completedAt,link");
        if (params.repo) args.push("--repo", params.repo);

        const result = await runGh(args, cwd);
        const checks = result.stdout ? JSON.parse(result.stdout) : [];

        return {
          content: [{ type: "text", text: formatChecks(checks, result.exitCode) }],
          details: { checks, exitCode: result.exitCode },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
          details: {},
        };
      }
    },
  });
}
