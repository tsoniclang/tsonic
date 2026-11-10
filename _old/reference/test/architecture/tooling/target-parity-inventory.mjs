import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { tsonicRoot, testWorkspaceRoot } from "../../scripts/workspace-layout.mjs";

export function readTargetParityInventory(name) {
  if (!["language-lanes", "javascript-node-lanes"].includes(name)) throw new Error(`Unknown target inventory: ${name}`);
  return JSON.parse(readFileSync(resolve(tsonicRoot, "test/fixtures/target-parity", `${name}.json`), "utf8"));
}

export function targetReferenceFindings(rows, workspace = testWorkspaceRoot) {
  const findings = [];
  for (const row of rows) {
    for (const target of ["csharp", "rust"]) {
      const path = row[`${target}Reference`];
      if (path === undefined) continue;
      if (typeof path !== "string" || isAbsolute(path) || path.includes("\\") || path.split("/").some(part => part === ".." || part === "." || part === "")) {
        findings.push(`${row.id}: invalid ${target} reference`);
      } else if (!existsSync(resolve(workspace, path))) {
        findings.push(`${row.id}: missing ${target} reference ${path}`);
      }
    }
  }
  return findings;
}
