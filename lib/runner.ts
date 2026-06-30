import { execFile } from "node:child_process";
import { getAclPath, type PiDevConfig } from "./config.js";

export async function runAcl(config: PiDevConfig, args: string[]): Promise<string> {
  const command = getAclPath(config);
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8" }, (err, stdout, stderr) => {
      if (err) {
        const detail = stderr.trim() || stdout.trim() || err.message;
        if (err.message.includes("ENOENT") || (err as NodeJS.ErrnoException).code === "ENOENT") {
          return reject(new Error(`acli not found at "${command}". Install it and run \`acli auth login\`.`));
        }
        return reject(new Error(`acli failed: ${detail}`));
      }
      resolve(stdout.trim());
    });
  });
}

export async function runAclJson(config: PiDevConfig, args: string[]): Promise<unknown> {
  const raw = await runAcl(config, [...args, "--json"]);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`acli returned non-JSON: ${raw.slice(0, 500)}`);
  }
}
