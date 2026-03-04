import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";

export function main(): void {
  const joined = path.join("a", "b");
  const exists = fs.existsSync(".");
  const cwd = process.cwd();
  const home = os.homedir();
  const id = crypto.randomUUID();

  console.log(joined);
  console.log(exists ? "exists" : "missing");
  console.log(cwd.length > 0 ? "cwd" : "nocwd");
  console.log(home.length > 0 ? "home" : "nohome");
  console.log(id.length > 0 ? "uuid" : "nouuid");
}
