import { relative } from "node:path";
import type { Diagnostic } from "@tsonic/frontend";
import { emitModule } from "./rendering/module.js";
import type { CSharpLoweringModulePlan, EmitResult, EmitterOptions } from "./types.js";

export { emitModule };

const findCommonRoot = (paths: readonly string[]): string => {
  if (paths.length === 0) return "";
  const segments = paths.map((item) => item.split("/"));
  const first = segments[0] ?? [];
  const max = Math.min(...segments.map((item) => item.length));
  let common = 0;
  for (let index = 0; index < max; index += 1) {
    const segment = first[index];
    if (segment && segments.every((item) => item[index] === segment)) {
      common = index + 1;
      continue;
    }
    break;
  }
  return first.slice(0, common).join("/");
};

const outputPathForModule = (
  module: CSharpLoweringModulePlan,
  commonRoot: string
): string => {
  const relativePath =
    commonRoot.length > 0
      ? relative(commonRoot, module.identity.filePath).replace(/\\/g, "/")
      : module.identity.filePath;
  return relativePath.replace(/\.tsx?$/u, ".cs");
};

const duplicateOutputDiagnostics = (
  modules: readonly CSharpLoweringModulePlan[]
): readonly Diagnostic[] => {
  const byOutput = new Map<string, string>();
  const diagnostics: Diagnostic[] = [];
  const commonRoot = findCommonRoot(modules.map((module) => module.identity.filePath));
  for (const module of modules) {
    const outputPath = outputPathForModule(module, commonRoot);
    const existing = byOutput.get(outputPath);
    if (existing) {
      diagnostics.push({
        code: "TSN9001",
        severity: "error",
        message: `C# emitter output collision: '${existing}' and '${module.identity.filePath}' both map to '${outputPath}'.`,
      });
      continue;
    }
    byOutput.set(outputPath, module.identity.filePath);
  }
  return diagnostics;
};

export const emitCSharpFile = (
  module: CSharpLoweringModulePlan,
  options: Partial<EmitterOptions> = {}
): string => emitModule(module, options);

export const emitCSharpFiles = (
  modules: readonly CSharpLoweringModulePlan[],
  options: Partial<EmitterOptions> = {}
): EmitResult => {
  const diagnostics = duplicateOutputDiagnostics(modules);
  if (diagnostics.length > 0) {
    return { ok: false, errors: diagnostics };
  }

  const commonRoot = findCommonRoot(modules.map((module) => module.identity.filePath));
  const files = new Map<string, string>();
  for (const module of modules) {
    files.set(outputPathForModule(module, commonRoot), emitCSharpFile(module, options));
  }
  return { ok: true, files };
};
