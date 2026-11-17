import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keelDigest } from "./keel-source-analysis.mjs";

const owners = Object.freeze({
  "csharp-nodejs": { file: "dist/provider/assembly/modules.js", export: "nodejsProviderModules", form: "value" },
  "rust-nodejs": { file: "dist/provider/assembly/modules.js", export: "nodejsProviderModules", form: "function" },
});

export function readKeelNodeModuleRegistry(workspace, repo) {
  const owner = owners[repo];
  if (owner === undefined) throw new Error("Unknown Node registry owner.");
  const root = resolve(workspace, repo);
  const file = resolve(root, owner.file);
  const require = createRequire(resolve(root, "package.json"));
  const selected = require(file)[owner.export];
  if (typeof selected !== (owner.form === "function" ? "function" : "object")) {
    throw new Error(`Built Node registry has no exact ${owner.form} export: ${repo}:${owner.export}.`);
  }
  const profiles = [false, true].map(jsEnabled => {
    const modules = owner.form === "function" ? selected(jsEnabled) : selected;
    if (!Array.isArray(modules)) throw new Error("The built Node module registry must return an array.");
    const specifiers = modules.map(module => module.moduleSpecifier);
    if (specifiers.some(specifier => typeof specifier !== "string" || !specifier.startsWith("node:")) ||
      new Set(specifiers).size !== specifiers.length) throw new Error("Invalid or duplicate public Node module registration.");
    return specifiers.toSorted();
  });
  if (JSON.stringify(profiles[0]) !== JSON.stringify(profiles[1])) {
    throw new Error("The two selected source profiles expose different canonical Node module registries.");
  }
  return Object.freeze({ modules: Object.freeze(profiles[0]),
    artifact: Object.freeze({ path: file, sha256: keelDigest(readFileSync(file)) }) });
}
