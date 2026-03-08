import { statSync } from "node:fs";

export function main(): void {
  const maybeDate: Date | undefined = undefined;
  const resolved = maybeDate ?? statSync("tsonic.workspace.json").mtime;
  console.log(resolved.toISOString().length.toString());
}
