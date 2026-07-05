function bucketEmoji(bucket?: string): string {
  switch (bucket) {
    case "pass":
      return "✅";
    case "fail":
      return "❌";
    case "pending":
      return "⏳";
    default:
      return "⚪";
  }
}

function stateEmoji(state?: string): string {
  const s = (state ?? "").toLowerCase();
  if (s === "open") return "🟢";
  if (s === "closed" || s === "merged") return "🔴";
  return "⚪";
}

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

export function formatPrList(prs: any[]): string {
  if (!Array.isArray(prs) || prs.length === 0) return "No PRs found.";

  const lines = prs.map((pr) => {
    const draft = pr.isDraft ? " [draft]" : "";
    return `${stateEmoji(pr.state)} **#${pr.number ?? "?"}**${draft}: ${pr.title ?? "?"} by ${pr.author?.login ?? "?"}`;
  });

  return lines.join("\n");
}

export function formatChecks(checks: any[], exitCode: number): string {
  if (!Array.isArray(checks) || checks.length === 0) {
    return exitCode === 8 ? "Checks are pending." : "No checks found.";
  }

  const lines = checks.map((check) => {
    return `${bucketEmoji(check.bucket)} **${check.name ?? "?"}**: ${check.state ?? "?"}`;
  });

  if (exitCode === 8) {
    lines.push("", "_Some checks are still pending._");
  }

  return lines.join("\n");
}

export function formatIssue(issue: any): string {
  if (!issue || typeof issue !== "object") return "No issue data.";

  const lines = [
    `**#${issue.number ?? "?"}**: ${issue.title ?? "?"}`,
    `- **URL:** ${issue.url ?? "?"}`,
    `- **State:** ${issue.state ?? "?"}`,
    `- **Author:** ${issue.author?.login ?? "?"}`,
    `- **Created:** ${issue.createdAt ?? "?"}`,
  ];

  if (issue.labels?.length) {
    const labels = issue.labels.map((l: any) => l.name).join(", ");
    lines.push(`- **Labels:** ${labels}`);
  }

  if (issue.body) {
    lines.push("", "**Body**", issue.body);
  }

  return lines.join("\n");
}

export function formatIssueList(issues: any[]): string {
  if (!Array.isArray(issues) || issues.length === 0) return "No issues found.";

  const lines = issues.map((issue) => {
    return `${stateEmoji(issue.state)} **#${issue.number ?? "?"}**: ${issue.title ?? "?"} by ${issue.author?.login ?? "?"}`;
  });

  return lines.join("\n");
}

export function formatRun(run: any): string {
  if (!run || typeof run !== "object") return "No run data.";

  const lines = [
    `**Run #${run.databaseId ?? "?"}**: ${run.displayTitle ?? "?"}`,
    `- **Workflow:** ${run.workflowName ?? "?"}`,
    `- **Branch:** ${run.headBranch ?? "?"}`,
    `- **Status:** ${run.status ?? "?"}`,
    `- **Conclusion:** ${run.conclusion ?? "?"}`,
    `- **Created:** ${run.createdAt ?? "?"}`,
  ];

  if (run.jobs?.length) {
    lines.push("", "**Jobs**");
    for (const job of run.jobs) {
      lines.push(`- ${job.name ?? "?"}: ${job.status ?? "?"} (${job.conclusion ?? "?"})`);
    }
  }

  return lines.join("\n");
}

export function formatRunList(runs: any[]): string {
  if (!Array.isArray(runs) || runs.length === 0) return "No runs found.";

  const lines = runs.map((run) => {
    const conclusion = run.conclusion ? ` (${run.conclusion})` : "";
    return `**#${run.databaseId ?? "?"}** ${run.displayTitle ?? "?"}: ${run.status ?? "?"}${conclusion} — ${run.workflowName ?? "?"}`;
  });

  return lines.join("\n");
}

export function formatWorkflowList(workflows: any[]): string {
  if (!Array.isArray(workflows) || workflows.length === 0) return "No workflows found.";

  const lines = workflows.map((wf) => {
    return `- **${wf.name ?? "?"}** (${wf.state ?? "?"}): ${wf.path ?? "?"}`;
  });

  return lines.join("\n");
}

export function formatRelease(release: any): string {
  if (!release || typeof release !== "object") return "No release data.";

  const lines = [
    `**${release.tagName ?? "?"}**: ${release.name ?? "?"}`,
    `- **Published:** ${release.publishedAt ?? "?"}`,
    `- **Draft:** ${release.isDraft ? "yes" : "no"}`,
    `- **Prerelease:** ${release.isPrerelease ? "yes" : "no"}`,
  ];

  if (release.body) {
    lines.push("", "**Notes**", release.body);
  }

  return lines.join("\n");
}

export function formatReleaseList(releases: any[]): string {
  if (!Array.isArray(releases) || releases.length === 0) return "No releases found.";

  const lines = releases.map((r) => {
    const tags = [r.isDraft ? "draft" : "", r.isPrerelease ? "prerelease" : ""]
      .filter(Boolean)
      .join(", ");
    const tagSuffix = tags ? ` [${tags}]` : "";
    return `**${r.tagName ?? "?"}**${tagSuffix}: ${r.name ?? "?"}`;
  });

  return lines.join("\n");
}
