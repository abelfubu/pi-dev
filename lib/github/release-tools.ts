import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatRelease, formatReleaseList } from "./format.js";

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

export default function registerReleaseTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_release_list",
    label: "GitHub Release List",
    description: "List GitHub releases",
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "Maximum number of releases", default: 10 })),
      excludeDrafts: Type.Optional(Type.Boolean({ description: "Exclude draft releases", default: false })),
      excludePreReleases: Type.Optional(
        Type.Boolean({ description: "Exclude pre-releases", default: false }),
      ),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = [
          "release",
          "list",
          "--json",
          "tagName,name,isDraft,isPrerelease,publishedAt",
          "--limit",
          String(params.limit ?? 10),
        ];
        if (params.excludeDrafts) args.push("--exclude-drafts");
        if (params.excludePreReleases) args.push("--exclude-pre-releases");
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatReleaseList(data as any[]), { releases: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_release_view",
    label: "GitHub Release View",
    description: "View a GitHub release by tag",
    parameters: Type.Object({
      tag: Type.String({ description: "Release tag" }),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = [
          "release",
          "view",
          params.tag,
          "--json",
          "tagName,name,publishedAt,author,isDraft,isPrerelease,body",
        ];
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatRelease(data), { release: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_release_create",
    label: "GitHub Release Create",
    description: "Create a GitHub release",
    parameters: Type.Object({
      tag: Type.String({ description: "Release tag" }),
      title: Type.Optional(Type.String({ description: "Release title" })),
      notes: Type.Optional(Type.String({ description: "Release notes (Markdown)" })),
      draft: Type.Optional(Type.Boolean({ description: "Create as draft", default: false })),
      prerelease: Type.Optional(Type.Boolean({ description: "Mark as pre-release", default: false })),
      generateNotes: Type.Optional(
        Type.Boolean({ description: "Auto-generate release notes", default: false }),
      ),
      target: Type.Optional(Type.String({ description: "Target branch or commit SHA" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["release", "create", params.tag];

        if (params.title) args.push("--title", params.title);
        if (params.notes) args.push("--notes", params.notes);
        if (params.draft) args.push("--draft");
        if (params.prerelease) args.push("--prerelease");
        if (params.generateNotes) args.push("--generate-notes");
        if (params.target) args.push("--target", params.target);
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        const url = result.stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? result.stdout;

        return success(`Created release: ${url}`, { url, stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
