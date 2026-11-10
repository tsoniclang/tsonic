import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readSourceInventory } from "./file-inventory.mjs";
import { validPath } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";

export function readKeelDeclarations(workspace) {
  const declarationFiles = new Map();
  const modulePaths = {};
  const metadata = [];
  for (const [directory, representation] of [
    ["packages/target-api", "authored"], ["packages/source-core", "authored"],
    ["packages/js-source-profile", "authored"], ["packages/tsts", "distributed"],
  ]) {
    const root = resolve(workspace, "tsonic", directory);
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const virtualRoot = `external/tsonic/${directory}`;
    const config = representation === "authored" ? JSON.parse(readFileSync(resolve(root, "tsconfig.json"), "utf8")) : undefined;
    metadata.push([directory, manifest, config]);
    const sourceRoot = config?.compilerOptions?.rootDir?.replace(/^\.\//u, "");
    const outputRoot = config?.compilerOptions?.outDir?.replace(/^\.\//u, "");
    if (representation === "authored" && (!validPath(sourceRoot) || !validPath(outputRoot))) {
      throw new Error(`Architecture declaration projection needs exact rootDir/outDir for '${directory}'.`);
    }
    const ownedRoot = representation === "authored" ? sourceRoot : "dist";
    for (const [file, text] of readSourceInventory(resolve(root, ownedRoot), {
      extensions: representation === "authored" ? [".ts"] : [".d.ts"],
    })) declarationFiles.set(`${virtualRoot}/${ownedRoot}/${file}`, text);
    const exports = manifest.exports ?? { ".": { types: manifest.types } };
    for (const [subpath, entry] of Object.entries(exports)) {
      if (typeof entry !== "object" || typeof entry.types !== "string") continue;
      const declared = entry.types.replace(/^\.\//u, "");
      if (!validPath(declared) || !declared.endsWith(".d.ts")) throw new Error("Public architecture inputs need exact declaration exports.");
      let input = declared;
      if (representation === "authored") {
        if (!declared.startsWith(`${outputRoot}/`)) throw new Error("Public declaration export lies outside its compiler output root.");
        input = `${sourceRoot}/${declared.slice(outputRoot.length + 1, -5)}.ts`;
      }
      const virtual = `${virtualRoot}/${input}`;
      if (!declarationFiles.has(virtual)) throw new Error(`Public architecture declaration input does not exist: ${virtual}.`);
      const specifier = subpath === "." ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
      modulePaths[specifier] = [virtual];
    }
  }
  return { declarationFiles, modulePaths, inputDigest: keelDigest(JSON.stringify([
    metadata, modulePaths, [...declarationFiles].sort(([left], [right]) => left.localeCompare(right)),
  ])) };
}
