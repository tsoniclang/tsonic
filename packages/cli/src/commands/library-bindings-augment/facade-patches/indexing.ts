import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { FacadeInfo } from "../types.js";

export const indexFacadeFiles = (
  outDir: string
): ReadonlyMap<string, FacadeInfo> => {
  const result = new Map<string, FacadeInfo>();
  const entries = readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".d.ts"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of entries) {
    const facadeDtsPath = join(outDir, fileName);
    const content = readFileSync(facadeDtsPath, "utf-8");

    const namespaceMatch = content.match(/^\/\/ Namespace:\s*(.+)\s*$/m);
    if (!namespaceMatch) continue;
    const namespace = namespaceMatch[1]?.trim();
    if (!namespace) continue;

    const internalImportMatch = content.match(
      /^import\s+\*\s+as\s+Internal\s+from\s+['"](.+)['"];\s*$/m
    );
    if (!internalImportMatch) continue;

    const internalRelJs = internalImportMatch[1];
    if (!internalRelJs) continue;
    let internalRel = internalRelJs;
    if (internalRel.startsWith("./")) internalRel = internalRel.slice(2);
    const internalIndexDtsPath = join(
      outDir,
      internalRel.replace(/\.js$/, ".d.ts")
    );

    const moduleSpecifier = `./${basename(fileName, ".d.ts")}.js`;
    const facadeJsPath = join(outDir, `${basename(fileName, ".d.ts")}.js`);

    result.set(namespace, {
      namespace,
      facadeDtsPath,
      facadeJsPath,
      moduleSpecifier,
      internalIndexDtsPath,
    });
  }

  return result;
};
