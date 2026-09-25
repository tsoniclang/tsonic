import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { writeImmutableJson } from "./records.mjs";
import { parseBankCounts } from "./counts.mjs";

const [kind, command, ...args] = process.argv.slice(2);
if (!["node", "cargo"].includes(kind) || command === undefined) throw new Error("Expected a test bank kind and command.");
const environment = { ...process.env };
delete environment.TSONIC_TEST_COUNT_DIRECTORY;
const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], env: environment });
const lines = [];
let pending = "";
child.stdout.on("data", bytes => {
  process.stdout.write(bytes);
  pending += bytes.toString("utf8");
  const complete = pending.split("\n");
  pending = complete.pop();
  for (const line of complete) {
    if (/^# (?:tests|pass|fail|skipped|todo|cancelled) \d+\s*$|^test result:/u.test(line)) lines.push(line);
  }
  if (pending.length > 1024 * 1024 || lines.length > 100_000) child.kill("SIGTERM");
});
child.stderr.pipe(process.stderr);
const status = await new Promise((resolveStatus, rejectStatus) => {
  child.once("error", rejectStatus);
  child.once("close", code => resolveStatus(code ?? 1));
});
const counts = parseBankCounts(kind, lines.join("\n"));
if (counts.length === 0) throw new Error(`${kind} did not report complete test counts.`);
if (process.env.TSONIC_TEST_COUNT_DIRECTORY !== undefined) {
  mkdirSync(process.env.TSONIC_TEST_COUNT_DIRECTORY, { recursive: true });
  writeImmutableJson(resolve(process.env.TSONIC_TEST_COUNT_DIRECTORY, `${kind}-${randomUUID()}.json`), {
    kind, command: [command, ...args], exitCode: status, counts,
  });
}
process.exitCode = status;
