import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import {
  closeHerdrPane,
  createHerdrPane,
  runInPane,
  shellQuote,
  zoomHerdrPane,
} from "../lib/herdr.js";
import {
  listTuicrSessions,
  readTuicrComments,
  resolveReviewTarget,
  type ReviewTarget,
  type TuicrSession,
} from "../lib/tuicr.js";

interface ReviewState extends ReviewTarget {
  paneId: string;
  baselineSessions: Set<string>;
  session?: string;
}

interface TuicrToolDetails {
  reviewId: string;
  paneId?: string;
  repoDir?: string;
  baseSha?: string;
  headSha?: string;
  mergeBaseSha?: string;
  session?: string;
  comments?: unknown[];
}

function sessionSlugs(sessions: TuicrSession[]): string[] {
  return sessions.flatMap((session) =>
    typeof session.slug === "string" && session.slug ? [session.slug] : [],
  );
}

export function selectReviewSession(
  sessions: TuicrSession[],
  baselineSessions: Set<string>,
): string | undefined {
  const active = sessions.filter((session) => session.active === true);
  const activeSlugs = sessionSlugs(active);
  if (activeSlugs.length === 1) return activeSlugs[0];
  if (activeSlugs.length > 1) {
    throw new Error(`Multiple active tuicr sessions found: ${activeSlugs.join(", ")}`);
  }

  const newSlugs = sessionSlugs(sessions).filter((slug) => !baselineSessions.has(slug));
  if (newSlugs.length === 1) return newSlugs[0];
  if (newSlugs.length > 1) {
    throw new Error(`Multiple new tuicr sessions found: ${newSlugs.join(", ")}`);
  }

  const allSlugs = sessionSlugs(sessions);
  return allSlugs.length === 1 ? allSlugs[0] : undefined;
}

async function captureSession(state: ReviewState): Promise<string | undefined> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sessions = await listTuicrSessions(state.repoDir);
    const session = selectReviewSession(sessions, state.baselineSessions);
    if (session) return session;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  return undefined;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

export default function registerTuicrTools(pi: ExtensionAPI) {
  const reviews = new Map<string, ReviewState>();
  const parameters = Type.Object({
    action: Type.Union([
      Type.Literal("open"),
      Type.Literal("comments"),
      Type.Literal("close"),
    ]),
    repoDir: Type.Optional(
      Type.String({ description: "Absolute repository directory; required for open" }),
    ),
    baseRef: Type.Optional(
      Type.String({ description: "Fixed Git base ref; required for open" }),
    ),
    reviewId: Type.Optional(
      Type.String({ description: "Review ID returned by open; required for comments and close" }),
    ),
  });

  pi.registerTool<typeof parameters, TuicrToolDetails>({
    name: "tuicr_review",
    label: "tuicr Review",
    description:
      "Open an exact local diff in a focused Herdr tuicr pane, read its comments, or close the pane.",
    promptSnippet: "Open and manage deterministic local tuicr review sessions in Herdr",
    promptGuidelines: [
      "Use tuicr_review for the human review gate; explicit user approval is required even when comments are empty.",
    ],
    executionMode: "sequential",
    parameters,
    async execute(_id, params) {
      const action = params.action as "open" | "comments" | "close";

      if (action === "open") {
        const repoDir = requireString(params.repoDir, "repoDir");
        const baseRef = requireString(params.baseRef, "baseRef");
        const target = await resolveReviewTarget(repoDir, baseRef);
        const baseline = await listTuicrSessions(target.repoDir);
        const alreadyActive = sessionSlugs(baseline.filter((session) => session.active === true));
        if (alreadyActive.length > 0) {
          throw new Error(`A tuicr session is already active: ${alreadyActive.join(", ")}`);
        }

        const pane = await createHerdrPane("pane", "tuicr review", target.repoDir, undefined, true);
        if (!pane.paneId) throw new Error("Herdr did not return a pane ID.");

        try {
          await zoomHerdrPane(pane.paneId, true);
          const command = `tuicr -r ${shellQuote(target.revisions)} --no-update-check`;
          await runInPane(pane.paneId, command);
        } catch (error) {
          await closeHerdrPane(pane.paneId).catch(() => {});
          throw error;
        }

        const reviewId = randomUUID();
        const state: ReviewState = {
          ...target,
          paneId: pane.paneId,
          baselineSessions: new Set(sessionSlugs(baseline)),
        };
        reviews.set(reviewId, state);
        state.session = await captureSession(state);

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Opened tuicr review ${reviewId} in pane ${state.paneId}.`,
                `Pinned diff: ${state.mergeBaseSha}..${state.headSha}.`,
                state.session
                  ? `Session: ${state.session}.`
                  : "Session is still starting; comments will resolve it later.",
                "The review passes only after explicit user approval.",
              ].join("\n"),
            },
          ],
          details: {
            reviewId,
            paneId: state.paneId,
            repoDir: state.repoDir,
            baseSha: state.baseSha,
            headSha: state.headSha,
            mergeBaseSha: state.mergeBaseSha,
            session: state.session,
          },
        };
      }

      const reviewId = requireString(params.reviewId, "reviewId");
      const state = reviews.get(reviewId);
      if (!state) {
        throw new Error(`Unknown or expired tuicr review: ${reviewId}`);
      }

      if (action === "comments") {
        state.session ??= selectReviewSession(
          await listTuicrSessions(state.repoDir),
          state.baselineSessions,
        );
        if (!state.session) {
          throw new Error("Could not identify the tuicr session for this review.");
        }

        const comments = await readTuicrComments(state.repoDir, state.session);
        return {
          content: [
            {
              type: "text" as const,
              text:
                comments.length > 0
                  ? JSON.stringify(comments, null, 2)
                  : "No comments. This is not approval; ask the user explicitly.",
            },
          ],
          details: { reviewId, session: state.session, comments },
        };
      }

      if (action === "close") {
        await closeHerdrPane(state.paneId);
        reviews.delete(reviewId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Closed tuicr review ${reviewId} and pane ${state.paneId}.`,
            },
          ],
          details: { reviewId, paneId: state.paneId },
        };
      }

      throw new Error(`Unknown action: ${String(action)}`);
    },
  });
}
