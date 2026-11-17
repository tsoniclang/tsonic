import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { emptyBanks } from "./required-banks.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const empty = emptyBanks(root);
if (empty.length > 0) {
  process.stderr.write(`Required test banks match no file: ${empty.join(", ")}\n`);
  process.exitCode = 1;
} else {
  const result = spawnSync("bash", ["scripts/build/all.sh"], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
