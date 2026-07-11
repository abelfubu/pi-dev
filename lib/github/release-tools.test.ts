import { describe, it, expect } from "vitest";
import { releaseToolConfig } from "./release-tools.js";

const ctx = { cwd: "/tmp/repo" };

describe("releaseToolConfig", () => {
  it("has the expected tool metadata", () => {
    expect(releaseToolConfig.name).toBe("gh_release");
    expect(releaseToolConfig.label).toBe("GitHub Release");
  });

  describe("list", () => {
    const handler = releaseToolConfig.handlers.list;

    it("uses default limit", () => {
      const args = handler.buildArgs({ action: "list" } as any, ctx);
      expect(args).toEqual([
        "release",
        "list",
        "--json",
        "tagName,name,isDraft,isPrerelease,publishedAt",
        "--limit",
        "10",
      ]);
    });

    it("applies exclude flags", () => {
      const args = handler.buildArgs(
        { action: "list", excludeDrafts: true, excludePreReleases: true, limit: 5 } as any,
        ctx,
      );
      expect(args).toEqual([
        "release",
        "list",
        "--json",
        "tagName,name,isDraft,isPrerelease,publishedAt",
        "--limit",
        "5",
        "--exclude-drafts",
        "--exclude-pre-releases",
      ]);
    });

    it("formats releases", () => {
      const text = handler.format(
        [{ tagName: "v1.0.0", name: "Version 1.0.0", isDraft: false, isPrerelease: false }] as any,
        { action: "list" } as any,
        ctx,
      );
      expect(text).toContain("v1.0.0");
    });
  });

  describe("view", () => {
    const handler = releaseToolConfig.handlers.view;

    it("throws when tag is missing", () => {
      expect(() => handler.buildArgs({ action: "view" } as any, ctx)).toThrow(
        "tag is required for view",
      );
    });

    it("builds args", () => {
      const args = handler.buildArgs({ action: "view", tag: "v1.0.0" } as any, ctx);
      expect(args).toEqual([
        "release",
        "view",
        "v1.0.0",
        "--json",
        "tagName,name,publishedAt,author,isDraft,isPrerelease,body",
      ]);
    });

    it("formats a release", () => {
      const text = handler.format(
        { tagName: "v1.0.0", name: "Release", publishedAt: "2024-01-01" } as any,
        { action: "view" } as any,
        ctx,
      );
      expect(text).toContain("v1.0.0");
      expect(text).toContain("Release");
    });
  });

  describe("create", () => {
    const handler = releaseToolConfig.handlers.create;

    it("throws when tag is missing", () => {
      expect(() => handler.buildArgs({ action: "create" } as any, ctx)).toThrow(
        "tag is required for create",
      );
    });

    it("builds minimal args", () => {
      const args = handler.buildArgs({ action: "create", tag: "v1.0.0" } as any, ctx);
      expect(args).toEqual(["release", "create", "v1.0.0"]);
    });

    it("builds full args", () => {
      const args = handler.buildArgs(
        {
          action: "create",
          tag: "v1.0.0",
          title: "Release",
          notes: "Notes",
          draft: true,
          prerelease: true,
          generateNotes: true,
          target: "main",
        } as any,
        ctx,
      );
      expect(args).toEqual([
        "release",
        "create",
        "v1.0.0",
        "--title",
        "Release",
        "--notes",
        "Notes",
        "--draft",
        "--prerelease",
        "--generate-notes",
        "--target",
        "main",
      ]);
    });

    it("formats stdout into a created URL", () => {
      const text = handler.format(
        { stdout: "https://github.com/owner/repo/releases/tag/v1.0.0", stderr: "", exitCode: 0 },
        { action: "create" } as any,
        ctx,
      );
      expect(text).toBe("Created release: https://github.com/owner/repo/releases/tag/v1.0.0");
    });
  });
});
