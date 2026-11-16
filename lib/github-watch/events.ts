import type { Snapshot } from "./state.js";

type Row = Record<string, any>;
const rows = (value: unknown[]): Row[] => value as Row[];
const fingerprint = (row: Row) => JSON.stringify(row);
const identity = (row: Row) => String(row.id ?? row.html_url ?? row.url ?? fingerprint(row));

function changed(rowsBefore: unknown[], rowsAfter: unknown[], actionable: (row: Row) => boolean = () => true): Row[] {
  const previous = new Map(rows(rowsBefore).map(row => [identity(row), row]));
  return rows(rowsAfter).filter(row => {
    const old = previous.get(identity(row));
    return actionable(row) && (!old || fingerprint(old) !== fingerprint(row));
  });
}

function failureName(check: Row): string {
  return String(check.name ?? check.context ?? check.workflowName ?? "unnamed check");
}

function isFailure(check: Row): boolean {
  return ["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(String(check.conclusion).toUpperCase())
    || ["FAILURE", "ERROR"].includes(String(check.state).toUpperCase());
}

function isConflict(snapshot: Snapshot): boolean {
  return snapshot.mergeable === "CONFLICTING" || ["CONFLICTING", "DIRTY"].includes(String(snapshot.mergeStateStatus));
}

function checksPass(snapshot: Snapshot): boolean {
  return rows(snapshot.checks).every(check => {
    if (check.status !== undefined) return check.status === "COMPLETED" && check.conclusion === "SUCCESS";
    return check.state === "SUCCESS";
  });
}

function isReady(snapshot: Snapshot): boolean {
  return snapshot.state === "OPEN" && snapshot.isDraft === false && snapshot.reviewDecision === "APPROVED"
    && snapshot.mergeable === "MERGEABLE" && snapshot.mergeStateStatus === "CLEAN" && checksPass(snapshot);
}

/** Return a short delta only when a snapshot transition warrants an agent turn. */
export function actionableSummary(previous: Snapshot | undefined, current: Snapshot): string | undefined {
  if (!previous) return undefined;
  if (current.state === "MERGED" && previous.state !== "MERGED") return "PR merged.";

  const reasons: string[] = [];
  const comments = changed(previous.comments, current.comments).length;
  const reviews = changed(previous.reviews, current.reviews, review => review.state === "CHANGES_REQUESTED"
    || (review.state === "COMMENTED" && Boolean(String(review.body ?? "").trim()))).length;
  const threads = changed(previous.threads, current.threads, thread => !thread.isResolved && !thread.isOutdated).length;
  const feedback = [
    comments ? `${comments} comment${comments === 1 ? "" : "s"}` : "",
    reviews ? `${reviews} review${reviews === 1 ? "" : "s"}` : "",
    threads ? `${threads} unresolved thread${threads === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
  if (feedback) reasons.push(`New or updated feedback: ${feedback}.`);

  const oldFailures = new Set(previous.headSha === current.headSha
    ? rows(previous.checks).filter(isFailure).map(failureName)
    : []);
  const failures = [...new Set(rows(current.checks).filter(isFailure).map(failureName).filter(name => !oldFailures.has(name)))];
  if (failures.length) reasons.push(`CI failed: ${failures.slice(0, 3).join(", ")}${failures.length > 3 ? ` +${failures.length - 3} more` : ""}.`);

  if (isConflict(current) && !isConflict(previous)) reasons.push("PR has merge conflicts.");
  if (isReady(current) && (!isReady(previous) || previous.headSha !== current.headSha)) reasons.push("PR may be ready to merge; verify live approval, checks, and mergeability.");

  return reasons.length ? reasons.join(" ") : undefined;
}
