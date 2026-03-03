import { os } from "node:os";
import { process } from "node:process";

export function getSystemSummary(): string {
  return os.homedir() + "|" + process.cwd();
}
