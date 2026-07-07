import { Parser } from "extended-markdown-adf-parser";

const parser = new Parser();

// Atlassian's ADF spec requires block content (e.g. paragraph) inside table cells/headers.
// The parser emits bare inline nodes (text) directly under tableCell/tableHeader, which
// Atlassian rejects with INVALID_INPUT. Wrap any non-block child in a paragraph.
function wrapTableCellChildren(node: any): any {
  if (!node || typeof node !== "object") return node;
  const blockTypes = new Set([
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "codeBlock",
    "mediaGroup",
    "mediaSingle",
    "blockquote",
    "panel",
    "table",
    "decisionList",
    "taskList",
    "nestedExpand",
  ]);
  const wrap = (n: any): any => {
    if (!n || !Array.isArray(n.content)) return n;
    n.content = n.content.map((child: any) => {
      if (child && typeof child === "object" && !blockTypes.has(child.type)) {
        return { type: "paragraph", content: [child] };
      }
      return child;
    });
    return n;
  };
  if (node.type === "tableCell" || node.type === "tableHeader") {
    return wrap(node);
  }
  if (Array.isArray(node.content)) {
    node.content = node.content.map(wrapTableCellChildren);
  }
  return node;
}

export function markdownToAdf(markdown: string): unknown {
  const adf = parser.markdownToAdf(markdown);
  return wrapTableCellChildren(adf);
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
