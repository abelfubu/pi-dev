import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerGhActionTool, type GhActionToolConfig } from "./tool.js";
import { formatRelease, formatReleaseList } from "./format.js";

const ReleaseAction = Type.Union([
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("create"),
]);

interface ReleaseParams extends Record<string, unknown> {
  action: string;
  repo?: string;
  tag?: string;
  title?: string;
  notes?: string;
  draft?: boolean;
  prerelease?: boolean;
  generateNotes?: boolean;
  target?: string;
  limit?: number;
  excludeDrafts?: boolean;
  excludePreReleases?: boolean;
}

export const releaseToolConfig: GhActionToolConfig<ReleaseParams> = {
  name: "gh_release",
  label: "GitHub Release",
  description: "Perform a GitHub release operation: list, view, or create",
  parameters: Type.Object({
    action: ReleaseAction,
    repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    tag: Type.Optional(Type.String({ description: "Release tag (view/create)" })),
    title: Type.Optional(Type.String({ description: "Release title (create)" })),
    notes: Type.Optional(Type.String({ description: "Release notes (Markdown) (create)" })),
    draft: Type.Optional(
      Type.Boolean({ description: "Create as draft (create/list)", default: false }),
    ),
    prerelease: Type.Optional(
      Type.Boolean({ description: "Mark as pre-release (create)", default: false }),
    ),
    generateNotes: Type.Optional(
      Type.Boolean({
        description: "Auto-generate release notes (create)",
        default: false,
      }),
    ),
    target: Type.Optional(
      Type.String({ description: "Target branch or commit SHA (create)" }),
    ),
    limit: Type.Optional(
      Type.Number({ description: "Maximum number of releases (list)", default: 10 }),
    ),
    excludeDrafts: Type.Optional(
      Type.Boolean({ description: "Exclude draft releases (list)", default: false }),
    ),
    excludePreReleases: Type.Optional(
      Type.Boolean({ description: "Exclude pre-releases (list)", default: false }),
    ),
  }),
  handlers: {
    list: {
      runType: "json",
      buildArgs: (params) => {
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
        return args;
      },
      format: (result) => formatReleaseList(result as any[]),
    },
    view: {
      runType: "json",
      buildArgs: (params) => {
        if (!params.tag) {
          throw new Error("tag is required for view");
        }
        return [
          "release",
          "view",
          params.tag,
          "--json",
          "tagName,name,publishedAt,author,isDraft,isPrerelease,body",
        ];
      },
      format: (result) => formatRelease(result),
    },
    create: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.tag) {
          throw new Error("tag is required for create");
        }
        const args = ["release", "create", params.tag];
        if (params.title) args.push("--title", params.title);
        if (params.notes) args.push("--notes", params.notes);
        if (params.draft) args.push("--draft");
        if (params.prerelease) args.push("--prerelease");
        if (params.generateNotes) args.push("--generate-notes");
        if (params.target) args.push("--target", params.target);
        return args;
      },
      format: (result) => {
        const { stdout } = result as { stdout: string };
        const url = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? stdout;
        return `Created release: ${url}`;
      },
    },
  },
};

export default function registerReleaseTools(pi: ExtensionAPI) {
  registerGhActionTool<ReleaseParams>(pi, releaseToolConfig);
}
