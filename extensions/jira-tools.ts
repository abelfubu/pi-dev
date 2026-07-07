import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runAclJson } from "../lib/runner.js";
import {
  markdownToAdf,
  formatIssueList,
  formatIssue,
  formatTransitions,
  formatProjects,
} from "../lib/format.js";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "jira_search",
    label: "Jira Search",
    description: "Search Jira work items using JQL",
    parameters: Type.Object({
      jql: Type.String({ description: "JQL query" }),
      limit: Type.Optional(Type.Number({ description: "Max results", default: 20 })),
      fields: Type.Optional(Type.String({
        description: "Comma-separated fields to retrieve",
        default: "key,summary,status,issuetype",
      })),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const output = await runAclJson([
          "jira", "workitem", "search",
          "--jql", params.jql,
          "--limit", String(params.limit ?? 20),
          "--fields", params.fields ?? "key,summary,status,issuetype",
        ]);
        const issues = (output as any).issues ?? [];
        return {
          content: [{ type: "text", text: formatIssueList(issues) }],
          details: { issues },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_view",
    label: "Jira View",
    description: "View a Jira work item by key",
    parameters: Type.Object({
      key: Type.String({ description: "Issue key, e.g. ITA-123" }),
      fields: Type.Optional(Type.String({
        description: "Comma-separated fields",
        default: "key,summary,status,issuetype,priority,assignee,reporter,description,created,updated",
      })),
      comments: Type.Optional(Type.Boolean({
        description: "Include comments in the output", default: false })),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        let fields = params.fields ?? "key,summary,status,issuetype,priority,assignee,reporter,description,created,updated";
        if (params.comments) {
          fields = fields.split(",").map(f => f.trim()).filter(f => f && f !== "comment").join(",");
          fields = fields ? `${fields},comment` : "comment";
        }
        const output = await runAclJson([
          "jira", "workitem", "view", params.key,
          "--fields", fields,
        ]);
        return {
          content: [{ type: "text", text: formatIssue(output) }],
          details: { issue: output },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_create",
    label: "Jira Create",
    description: "Create a Jira work item",
    parameters: Type.Object({
      project: Type.String({ description: "Project key, e.g. ITA" }),
      type: Type.String({ description: "Issue type, e.g. Task, Story, Bug" }),
      summary: Type.String({ description: "Issue summary" }),
      description: Type.Optional(Type.String({ description: "Markdown description" })),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Labels" })),
      assignee: Type.Optional(Type.String({ description: "Assignee email or @me" })),
      parent: Type.Optional(Type.String({ description: "Parent issue key for subtasks" })),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const args = [
          "jira", "workitem", "create",
          "--project", params.project,
          "--type", params.type,
          "--summary", params.summary,
        ];
        if (params.description) {
          args.push("--description", JSON.stringify(markdownToAdf(params.description)));
        }
        if (params.labels?.length) {
          args.push("--label", params.labels.join(","));
        }
        if (params.assignee) {
          args.push("--assignee", params.assignee);
        }
        if (params.parent) {
          args.push("--parent", params.parent);
        }
        const output = await runAclJson(args);
        const key = (output as any).key ?? "?";
        return {
          content: [{ type: "text", text: `Created **${key}**: ${params.summary}` }],
          details: output,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_update",
    label: "Jira Update",
    description: "Edit a Jira work item",
    parameters: Type.Object({
      key: Type.String({ description: "Issue key" }),
      summary: Type.Optional(Type.String({ description: "New summary" })),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Labels to set" })),
      assignee: Type.Optional(Type.String({ description: "Assignee email or @me" })),
      removeLabels: Type.Optional(Type.Array(Type.String(), { description: "Labels to remove" })),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const args = ["jira", "workitem", "edit", "--key", params.key, "--yes"];
        if (params.summary) args.push("--summary", params.summary);
        if (params.labels?.length) args.push("--labels", params.labels.join(","));
        if (params.assignee) args.push("--assignee", params.assignee);
        if (params.removeLabels?.length) args.push("--remove-labels", params.removeLabels.join(","));
        const output = await runAclJson(args);
        return {
          content: [{ type: "text", text: `Updated **${params.key}**` }],
          details: output,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_transition",
    label: "Jira Transition",
    description: "Transition a Jira work item to a new status",
    parameters: Type.Object({
      key: Type.String({ description: "Issue key" }),
      status: Type.String({ description: "Target status name" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const output = await runAclJson([
          "jira", "workitem", "transition",
          "--key", params.key,
          "--status", params.status,
          "--yes",
        ]);
        return {
          content: [{ type: "text", text: `Transitioned **${params.key}** to *${params.status}*` }],
          details: output,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_transitions",
    label: "Jira Transitions",
    description: "List available transitions for a Jira work item",
    parameters: Type.Object({
      key: Type.String({ description: "Issue key" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const output = await runAclJson(["jira", "workitem", "transitions", params.key]);
        const transitions = (output as any).transitions ?? [];
        return {
          content: [{ type: "text", text: formatTransitions(transitions) }],
          details: { transitions },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_comment",
    label: "Jira Comment",
    description: "Add a comment to a Jira work item",
    parameters: Type.Object({
      key: Type.String({ description: "Issue key" }),
      body: Type.String({ description: "Markdown comment body" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const adf = JSON.stringify(markdownToAdf(params.body));
        const output = await runAclJson([
          "jira", "workitem", "comment", "create",
          "--key", params.key,
          "--body", adf,
        ]);
        return {
          content: [{ type: "text", text: `Commented on **${params.key}**` }],
          details: output,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "jira_projects",
    label: "Jira Projects",
    description: "List available Jira projects",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, _ctx) {
      try {
        const output = await runAclJson(["jira", "project", "list"]);
        const projects = Array.isArray(output) ? output : (output as any).projects ?? [];
        return {
          content: [{ type: "text", text: formatProjects(projects) }],
          details: { projects },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });
}
