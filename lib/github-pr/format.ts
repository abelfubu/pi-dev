export function formatPr(pr: any): string {
  if (!pr || typeof pr !== "object") return "No PR data.";

  const lines = [
    `**#${pr.number ?? "?"}**: ${pr.title ?? "?"}`,
    `- **URL:** ${pr.url ?? "?"}`,
    `- **State:** ${pr.state ?? "?"}`,
    `- **Branch:** ${pr.headRefName ?? "?"} → ${pr.baseRefName ?? "?"}`,
    `- **Draft:** ${pr.isDraft ? "yes" : "no"}`,
    `- **Mergeable:** ${pr.mergeable ?? "?"}`,
    `- **Merge state:** ${pr.mergeStateStatus ?? "?"}`,
  ];

  if (pr.body) {
    lines.push("", "**Body**", pr.body);
  }

  return lines.join("\n");
}

export function formatChecks(checks: any[], exitCode: number): string {
  if (!Array.isArray(checks) || checks.length === 0) {
    return exitCode === 8 ? "Checks are pending." : "No checks found.";
  }

  const lines = checks.map((check) => {
    const bucket = check.bucket ?? "unknown";
    const emoji =
      bucket === "pass"
        ? "✅"
        : bucket === "fail"
          ? "❌"
          : bucket === "pending"
            ? "⏳"
            : "⚪";
    return `${emoji} **${check.name ?? "?"}**: ${check.state ?? "?"}`;
  });

  if (exitCode === 8) {
    lines.push("", "_Some checks are still pending._");
  }

  return lines.join("\n");
}
