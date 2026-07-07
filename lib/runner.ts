import { execFile } from "node:child_process";

export async function runAcl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("acli", args, { encoding: "utf8" }, (err, stdout, stderr) => {
      if (err) {
        const detail = stderr.trim() || stdout.trim() || err.message;
        if (err.message.includes("ENOENT") || (err as NodeJS.ErrnoException).code === "ENOENT") {
          return reject(new Error(`acli not found. Install it and run \`acli auth login\`.`));
        }
        return reject(new Error(`acli failed: ${detail}`));
      }
      resolve(stdout.trim());
    });
  });
}

export async function runAclJson(args: string[]): Promise<unknown> {
  const raw = await runAcl([...args, "--json"]);
  if (!raw) return {};
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`acli returned non-JSON: ${raw.slice(0, 500)}`);
  }
  // acli returns status:FAILURE / successCount:0 with exit code 0. Surface it as an error
  // so tools report isError instead of printing a misleading success message.
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const failures = results.filter((r: any) => r?.status === "FAILURE");
  if (failures.length > 0 || parsed?.successCount === 0) {
    const messages = failures.map((r: any) => r?.message).filter(Boolean);
    const detail = messages.length ? messages.join("; ") : "acli reported no successes";
    throw new Error(`acli failed: ${detail}`);
  }
  return parsed;
}
