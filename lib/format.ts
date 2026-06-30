import { Parser } from "extended-markdown-adf-parser";

const parser = new Parser();

export function markdownToAdf(markdown: string): unknown {
  return parser.markdownToAdf(markdown);
}

export function adfToMarkdown(adf: unknown): string {
  if (!adf) return "";
  return parser.adfToMarkdown(adf as any);
}

export function formatIssueList(issues: any[]): string {
  if (issues.length === 0) return "No issues found.";
  return issues
    .map((issue) => {
      const key = issue.key ?? "?";
      const status = issue.fields?.status?.name ?? "?";
      const type = issue.fields?.issuetype?.name ?? "?";
      const summary = issue.fields?.summary ?? "";
      return `- **${key}** | ${status} | ${type} | ${summary}`;
    })
    .join("\n");
}

export function formatIssue(issue: any): string {
  const fields = issue.fields ?? {};
  const description = fields.description ? adfToMarkdown(fields.description) : "_No description_";
  const assignee = fields.assignee?.displayName ?? "Unassigned";
  const reporter = fields.reporter?.displayName ?? "?";
  const priority = fields.priority?.name ?? "?";
  return `**${issue.key}**: ${fields.summary}

- **Type:** ${fields.issuetype?.name ?? "?"}
- **Status:** ${fields.status?.name ?? "?"}
- **Priority:** ${priority}
- **Assignee:** ${assignee}
- **Reporter:** ${reporter}
- **Created:** ${fields.created}
- **Updated:** ${fields.updated}

**Description**
${description}`;
}

export function formatTransitions(transitions: any[]): string {
  if (transitions.length === 0) return "No transitions available.";
  return transitions.map((t) => `- ${t.id}: ${t.name}`).join("\n");
}

export function formatProjects(projects: any[]): string {
  if (projects.length === 0) return "No projects found.";
  return projects.map((p) => `- **${p.key}**: ${p.name}`).join("\n");
}
