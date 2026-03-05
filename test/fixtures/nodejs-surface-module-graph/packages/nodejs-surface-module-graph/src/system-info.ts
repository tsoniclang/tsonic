import * as os from "node:os";
import * as process from "node:process";

export function getSystemSummary(): string {
  return os.homedir() + "|" + process.cwd();
}
