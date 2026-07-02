import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { CustomEditor } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

/**
 * pi-glance-inspired status bar for pi.
 *
 * - No editor frame
 * - No footer
 * - One info line above the editor, colored from the active pi theme
 * - Segments: folder (cyan), git (green), cost (yellow), throughput (gray), context (cyan), model/thinking (purple)
 */
export default function (pi: ExtensionAPI) {
	let requestRender: (() => void) | undefined;
	let lastOutputBeforeTurn = 0;
	let turnStartTime = 0;
	let lastSpeed = "?";

	class FramelessEditor extends CustomEditor {
		render(width: number): string[] {
			const lines = super.render(width);
			const isBorder = (line: string) => {
				const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
				if (plain.length === 0) return false;
				return /^[─│┌┐└┘├┤┬┴┼ ↑↓0-9]+$/.test(plain);
			};
			const top = lines.findIndex(isBorder);
			let bottom = -1;
			for (let i = lines.length - 1; i >= 0; i--) {
				if (isBorder(lines[i] ?? "")) {
					bottom = i;
					break;
				}
			}
			if (top === -1 || bottom === -1 || bottom <= top) return lines;
			return [
				...lines.slice(0, top),
				...lines.slice(top + 1, bottom),
				...lines.slice(bottom + 1),
			];
		}
	}

	const token = (name: string): ThemeColor => {
		switch (name) {
			case "cyan":
				return "syntaxOperator";
			case "green":
				return "success";
			case "syntaxString":
				return "syntaxString";
			case "yellow":
				return "warning";
			case "gray":
				return "muted";
			case "syntaxComment":
				return "syntaxComment";
			case "purple":
				return "syntaxKeyword";
			default:
				return "muted";
		}
	};

	const styled = (theme: Theme, color: string, text: string) =>
		theme.fg(token(color), text);

	const fmtDir = (cwd: string) => {
		const home = homedir();
		if (cwd === home) return "~";
		if (cwd.startsWith(home + "/")) return "~" + cwd.slice(home.length);
		const parts = cwd.split("/");
		return parts[parts.length - 1] || cwd;
	};

	const ANSI_RE = /\x1b\[[0-9;]*m/g;
	const visibleWidth = (str: string) => str.replace(ANSI_RE, "").length;
	const truncateToWidth = (str: string, width: number): string => {
		const chars = Array.from(str);
		let visual = 0;
		let result = "";
		let i = 0;
		while (i < chars.length) {
			const ch = chars[i]!;
			if (ch === "\x1b" && chars[i + 1] === "[") {
				let j = i + 2;
				while (j < chars.length && chars[j] !== "m") j++;
				result += chars.slice(i, j + 1).join("");
				i = j + 1;
				continue;
			}
			if (visual >= width) break;
			result += ch;
			visual++;
			i++;
		}
		return result + "\x1b[0m";
	};

	const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

	const computeStats = (ctx: ExtensionContext) => {
		let input = 0;
		let output = 0;
		let cost = 0;
		for (const e of ctx.sessionManager.getBranch()) {
			if (e.type === "message" && e.message.role === "assistant") {
				const m = e.message as {
					usage: { input: number; output: number; cost: { total: number } };
				};
				input += m.usage.input || 0;
				output += m.usage.output || 0;
				cost += m.usage.cost.total || 0;
			}
		}
		return { input, output, cost };
	};

	const gitBranch = (cwd: string): string | null => {
		try {
			const out = execSync("git branch --show-current", {
				cwd,
				encoding: "utf8",
				timeout: 500,
			}).trim();
			return out || null;
		} catch {
			return null;
		}
	};

	const isGitDirty = (cwd: string) => {
		try {
			const out = execSync("git status --porcelain", {
				cwd,
				encoding: "utf8",
				timeout: 500,
			}).trim();
			return out.length > 0;
		} catch {
			return false;
		}
	};

	const renderBar = (width: number, theme: Theme, ctx: ExtensionContext) => {
		const stats = computeStats(ctx);
		const usage = ctx.getContextUsage();
		const branch = gitBranch(ctx.cwd);
		const model = ctx.model?.id || "no-model";
		const provider = ctx.model?.provider || "";
		const thinking = pi.getThinkingLevel();

		const leftMargin = " ";
		const rightMargin = " ";
		const folder = styled(theme, "cyan", fmtDir(ctx.cwd));

		const parts: string[] = [];
		if (branch) {
			const dirty = isGitDirty(ctx.cwd) ? styled(theme, "syntaxString", " ●") : "";
			parts.push(styled(theme, "syntaxString", `\uE725 ${branch}`) + dirty);
		}
		parts.push(styled(theme, "yellow", `󰈸 $${stats.cost.toFixed(3)}`));
		parts.push(styled(theme, "syntaxComment", `\uF427 ${lastSpeed}`));
		const ctxPercent = usage?.percent != null ? `${Math.round(usage.percent)}%` : "?";
		const ctxTokens = usage?.tokens != null ? fmt(usage.tokens) : "?";
		const ctxTotal = usage?.contextWindow != null ? fmt(usage.contextWindow) : "?";
		parts.push(styled(theme, "cyan", `󰔟 ${ctxPercent} ${ctxTokens}/${ctxTotal}`));
		const modelLabel = provider ? `${provider}/${model}` : model;
		parts.push(styled(theme, "purple", `󰚩 ${modelLabel} ${thinking}`));

		const right = parts.join(styled(theme, "syntaxComment", " \u00B7 "));

		const fixed =
			visibleWidth(leftMargin) +
			visibleWidth(folder) +
			2 + // two spaces around the fill
			visibleWidth(right) +
			visibleWidth(rightMargin);
		const fillCount = width - fixed;

		if (fillCount > 0) {
			const fill = " ".repeat(fillCount);
			return [leftMargin + folder + " " + fill + " " + right + rightMargin];
		}

		// Not enough room: drop the fill and truncate the right side
		const avail = width - visibleWidth(leftMargin) - visibleWidth(folder) - 1 - visibleWidth(rightMargin);
		return [leftMargin + folder + " " + truncateToWidth(right, avail) + rightMargin];
	};

	const apply = (ctx: ExtensionContext | ExtensionCommandContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setFooter(() => ({
			invalidate() { },
			render() { return [""]; },
			dispose() { },
		}));
		ctx.ui.setEditorComponent((_tui, _theme, keybindings) =>
			new FramelessEditor(_tui, _theme, keybindings),
		);
		ctx.ui.setWidget(
			"statusbar",
			(tui, theme) => {
				requestRender = () => tui.requestRender();
				return {
					invalidate() { },
					render(width: number) {
						return renderBar(width, theme, ctx);
					},
					dispose() {
						requestRender = undefined;
					},
				};
			},
			{ placement: "aboveEditor" },
		);
	};

	pi.on("session_start", async (_event, ctx) => {
		apply(ctx);
	});

	pi.on("turn_start", async (_event, ctx) => {
		const stats = computeStats(ctx);
		lastOutputBeforeTurn = stats.output;
		turnStartTime = Date.now();
	});

	pi.on("turn_end", async (_event, ctx) => {
		const stats = computeStats(ctx);
		const delta = stats.output - lastOutputBeforeTurn;
		const elapsed = Date.now() - turnStartTime;
		if (delta > 0 && elapsed > 0) {
			lastSpeed = `${Math.round(delta / (elapsed / 1000))} tok/s`;
		} else {
			lastSpeed = "?";
		}
		requestRender?.();
	});

	pi.on("model_select", async () => {
		requestRender?.();
	});
	pi.on("thinking_level_select", async () => {
		requestRender?.();
	});
}
