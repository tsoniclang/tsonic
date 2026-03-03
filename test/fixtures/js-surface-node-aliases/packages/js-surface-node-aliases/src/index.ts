import { Console } from "@tsonic/dotnet/System.js";
import { crypto } from "node:crypto";
import { fs } from "node:fs";
import { os } from "node:os";
import { path } from "node:path";
import { process } from "node:process";

export function main(): void {
  const joined = path.join("a", "b");
  const exists = fs.existsSync(".");
  const cwd = process.cwd();
  const home = os.homedir();
  const id = crypto.randomUUID();

  Console.WriteLine(joined);
  Console.WriteLine(exists ? "exists" : "missing");
  Console.WriteLine(cwd.Length > 0 ? "cwd" : "nocwd");
  Console.WriteLine(home.Length > 0 ? "home" : "nohome");
  Console.WriteLine(id.Length > 0 ? "uuid" : "nouuid");
}
