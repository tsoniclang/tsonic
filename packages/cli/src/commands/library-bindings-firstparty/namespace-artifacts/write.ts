import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedConfig, Result } from "../../../types.js";
import { moduleNamespacePath } from "../module-paths.js";
import type { NamespacePlan } from "../types.js";
import { writeBindingsManifest } from "./bindings-manifest.js";
import {
  buildClrAliasLookup,
  writeNamespaceFacadeFiles,
  writeNamespaceInternalFile,
} from "./facade-files.js";
import { buildNamespaceArtifacts } from "./internal-artifacts.js";

export const writeNamespaceArtifacts = (
  config: ResolvedConfig,
  outDir: string,
  plan: NamespacePlan
): Result<void, string> => {
  const namespacePath = moduleNamespacePath(plan.namespace);
  const namespaceDir = join(outDir, namespacePath);
  const internalDir = join(namespaceDir, "internal");
  mkdirSync(internalDir, { recursive: true });

  const internalIndexPath = join(internalDir, "index.d.ts");
  const facadeDtsPath = join(outDir, `${namespacePath}.d.ts`);
  const facadeJsPath = join(outDir, `${namespacePath}.js`);
  const bindingsPath = join(namespaceDir, "bindings.json");

  const artifacts = buildNamespaceArtifacts(config, plan);

  writeNamespaceInternalFile({
    internalIndexPath,
    namespace: plan.namespace,
    outputName: config.outputName,
    internalBodyLines: artifacts.internalBodyLines,
    sourceAliasLines: artifacts.sourceAliasLines,
    internalTypeImports: plan.internalTypeImports,
    wrapperImports: plan.wrapperImports,
  });

  const valueBindings = writeNamespaceFacadeFiles({
    facadeDtsPath,
    facadeJsPath,
    namespace: plan.namespace,
    plan,
    sourceAliasLines: artifacts.sourceAliasLines,
    sourceAliasInternalImports: artifacts.sourceAliasInternalImports,
    anonymousStructuralAliases: artifacts.anonymousStructuralAliases,
  });

  writeBindingsManifest({
    bindingsPath,
    namespace: plan.namespace,
    outputName: config.outputName,
    typeBindings: artifacts.typeBindings,
    valueBindings,
    clrNamesByAlias: buildClrAliasLookup(artifacts.typeBindings),
  });

  return { ok: true, value: undefined };
};
