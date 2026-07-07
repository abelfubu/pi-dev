import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
	formatIssue,
	formatIssueList,
	formatProjects,
	formatTransitions,
	markdownToAdf,
} from "../lib/format.js";
import { runAcliJson } from "../lib/runner.js";

const JiraAction = Type.Union([
	Type.Literal("search"),
	Type.Literal("view"),
	Type.Literal("create"),
	Type.Literal("update"),
	Type.Literal("transition"),
	Type.Literal("transitions"),
	Type.Literal("comment"),
	Type.Literal("projects"),
]);

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "jira",
		label: "Jira",
		description: "Perform a Jira work item operation: search, view, create, update, transition, transitions, comment, or projects",
		parameters: Type.Object({
			action: JiraAction,
			jql: Type.Optional(Type.String({ description: "JQL query (search)" })),
			limit: Type.Optional(
				Type.Number({ description: "Max results (search)", default: 20 }),
			),
			fields: Type.Optional(
				Type.String({
					description: "Comma-separated fields to retrieve (search/view)",
					default: "key,summary,status,issuetype",
				}),
			),
			key: Type.Optional(
				Type.String({
					description: "Issue key, e.g. ITA-123 (view/update/transition/transitions/comment)",
				}),
			),
			comments: Type.Optional(
				Type.Boolean({
					description: "Include comments in the output (view)",
					default: false,
				}),
			),
			project: Type.Optional(
				Type.String({ description: "Project key, e.g. ITA (create)" }),
			),
			type: Type.Optional(
				Type.String({ description: "Issue type, e.g. Task, Story, Bug (create)" }),
			),
			summary: Type.Optional(
				Type.String({ description: "Issue summary (create/update)" }),
			),
			description: Type.Optional(
				Type.String({ description: "Markdown description (create)" }),
			),
			labels: Type.Optional(
				Type.Array(Type.String(), { description: "Labels to set (create/update)" }),
			),
			assignee: Type.Optional(
				Type.String({ description: "Assignee email or @me (create/update)" }),
			),
			parent: Type.Optional(
				Type.String({ description: "Parent issue key for subtasks (create)" }),
			),
			status: Type.Optional(
				Type.String({ description: "Target status name (transition)" }),
			),
			removeLabels: Type.Optional(
				Type.Array(Type.String(), { description: "Labels to remove (update)" }),
			),
			body: Type.Optional(
				Type.String({ description: "Markdown comment body (comment)" }),
			),
		}),
		async execute(_id, params, _signal, _onUpdate, _ctx) {
			try {
				const action = params.action as string;

				if (action === "search") {
					if (!params.jql) {
						return {
							content: [{ type: "text", text: "jql is required for search" }],
							isError: true,
							details: {},
						};
					}
					const output = await runAcliJson([
						"jira",
						"workitem",
						"search",
						"--jql",
						params.jql,
						"--limit",
						String(params.limit ?? 20),
						"--fields",
						params.fields ?? "key,summary,status,issuetype",
					]);
					const issues = (output as any).issues ?? [];
					return {
						content: [{ type: "text", text: formatIssueList(issues) }],
						details: { issues },
					};
				}

				if (action === "view") {
					if (!params.key) {
						return {
							content: [{ type: "text", text: "key is required for view" }],
							isError: true,
							details: {},
						};
					}
					let fields =
						params.fields ??
						"key,summary,status,issuetype,priority,assignee,reporter,description,created,updated";
					if (params.comments) {
						fields = fields
							.split(",")
							.map((f) => f.trim())
							.filter((f) => f && f !== "comment")
							.join(",");
						fields = fields ? `${fields},comment` : "comment";
					}
					const output = await runAcliJson([
						"jira",
						"workitem",
						"view",
						params.key,
						"--fields",
						fields,
					]);
					return {
						content: [{ type: "text", text: formatIssue(output) }],
						details: { issue: output },
					};
				}

				if (action === "create") {
					if (!params.project || !params.type || !params.summary) {
						return {
							content: [
								{
									type: "text",
									text: "project, type, and summary are required for create",
								},
							],
							isError: true,
							details: {},
						};
					}
					const args = [
						"jira",
						"workitem",
						"create",
						"--project",
						params.project,
						"--type",
						params.type,
						"--summary",
						params.summary,
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
					const output = await runAcliJson(args);
					const issueKey = (output as any).key ?? "?";
					return {
						content: [
							{ type: "text", text: `Created **${issueKey}**: ${params.summary}` },
						],
						details: output,
					};
				}

				if (action === "update") {
					if (!params.key) {
						return {
							content: [{ type: "text", text: "key is required for update" }],
							isError: true,
							details: {},
						};
					}
					const args = ["jira", "workitem", "edit", "--key", params.key, "--yes"];
					if (params.summary) args.push("--summary", params.summary);
					if (params.labels?.length) args.push("--labels", params.labels.join(","));
					if (params.assignee) args.push("--assignee", params.assignee);
					if (params.removeLabels?.length)
						args.push("--remove-labels", params.removeLabels.join(","));
					const output = await runAcliJson(args);
					return {
						content: [{ type: "text", text: `Updated **${params.key}**` }],
						details: output,
					};
				}

				if (action === "transition") {
					if (!params.key || !params.status) {
						return {
							content: [
								{ type: "text", text: "key and status are required for transition" },
							],
							isError: true,
							details: {},
						};
					}
					const output = await runAcliJson([
						"jira",
						"workitem",
						"transition",
						"--key",
						params.key,
						"--status",
						params.status,
						"--yes",
					]);
					return {
						content: [
							{ type: "text", text: `Transitioned **${params.key}** to *${params.status}*` },
						],
						details: output,
					};
				}

				if (action === "transitions") {
					if (!params.key) {
						return {
							content: [{ type: "text", text: "key is required for transitions" }],
							isError: true,
							details: {},
						};
					}
					const output = await runAcliJson([
						"jira",
						"workitem",
						"transitions",
						params.key,
					]);
					const transitions = (output as any).transitions ?? [];
					return {
						content: [{ type: "text", text: formatTransitions(transitions) }],
						details: { transitions },
					};
				}

				if (action === "comment") {
					if (!params.key || !params.body) {
						return {
							content: [
								{ type: "text", text: "key and body are required for comment" },
							],
							isError: true,
							details: {},
						};
					}
					const adf = JSON.stringify(markdownToAdf(params.body));
					const output = await runAcliJson([
						"jira",
						"workitem",
						"comment",
						"create",
						"--key",
						params.key,
						"--body",
						adf,
					]);
					return {
						content: [{ type: "text", text: `Commented on **${params.key}**` }],
						details: output,
					};
				}

				if (action === "projects") {
					const output = await runAcliJson(["jira", "project", "list"]);
					const projects = Array.isArray(output)
						? output
						: (output as any).projects ?? [];
					return {
						content: [{ type: "text", text: formatProjects(projects) }],
						details: { projects },
					};
				}

				return {
					content: [{ type: "text", text: `Unknown Jira action: ${action}` }],
					isError: true,
					details: {},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return { content: [{ type: "text", text: message }], isError: true, details: {} };
			}
		},
	});
}
