import { relative } from "node:path";
import type { Diagnostic, LoweringTypeRefPlan } from "@tsonic/frontend";
import { createExternalBindingMetadataIndex } from "./rendering/external-bindings.js";
import {
  collectModuleStructuralTypes,
  emitModule,
  emitStructuralTypesModule,
  SHARED_STRUCTURAL_NAMESPACE,
} from "./rendering/module.js";
import { csharpRuntimeSupportFiles } from "./rendering/runtime-support.js";
import { typePlanKey } from "./rendering/types.js";
import type {
  CSharpLoweringModulePlan,
  EmitResult,
  EmitterOptions,
  ModuleEmitResult,
} from "./types.js";

export { emitModule };

const findCommonRoot = (paths: readonly string[]): string => {
  if (paths.length === 0) return "";
  const segments = paths.map((item) => item.split("/").slice(0, -1));
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

const structuralTypesForModules = (
  modules: readonly CSharpLoweringModulePlan[]
): ReadonlyMap<string, LoweringTypeRefPlan> => {
  const structuralTypes = new Map<string, LoweringTypeRefPlan>();
  for (const module of modules) {
    for (const type of collectModuleStructuralTypes(module)) {
      structuralTypes.set(typePlanKey(type), type);
    }
  }
  return structuralTypes;
};

const structuralTypesOutputPath = (): string =>
  `__tsonic_structural/${
    SHARED_STRUCTURAL_NAMESPACE.split(".").filter(Boolean).join("/")
  }.cs`;

export const emitCSharpFile = (
  module: CSharpLoweringModulePlan,
  options: Partial<EmitterOptions> = {}
): ModuleEmitResult =>
  emitModule(module, {
    ...options,
    externalBindingMetadata:
      options.externalBindingMetadata ??
      createExternalBindingMetadataIndex(
        options.bindingMetadataRoots ?? options.libraries
      ),
  });

export const emitCSharpFiles = (
  modules: readonly CSharpLoweringModulePlan[],
  options: Partial<EmitterOptions> = {}
): EmitResult => {
  const diagnostics = duplicateOutputDiagnostics(modules);
  if (diagnostics.length > 0) {
    return { ok: false, errors: diagnostics };
  }

  const commonRoot = findCommonRoot(modules.map((module) => module.identity.filePath));
  const externalBindingMetadata =
    options.externalBindingMetadata ??
    createExternalBindingMetadataIndex(
      options.bindingMetadataRoots ?? options.libraries
    );
  const structuralTypes = structuralTypesForModules(modules);
  const files = new Map<string, string>();
  for (const module of modules) {
    const moduleResult = emitCSharpFile(module, {
      ...options,
      externalBindingMetadata,
      includeStructuralDeclarations: false,
    });
    if (!moduleResult.ok) {
      return { ok: false, errors: moduleResult.errors };
    }
    files.set(outputPathForModule(module, commonRoot), moduleResult.code);
  }
  if (structuralTypes.size > 0) {
    const structuralResult = emitStructuralTypesModule(
      SHARED_STRUCTURAL_NAMESPACE,
      [...structuralTypes.values()],
      {
        ...options,
        externalBindingMetadata,
      }
    );
    if (!structuralResult.ok) {
      return { ok: false, errors: structuralResult.errors };
    }
    files.set(structuralTypesOutputPath(), structuralResult.code);
  }
  for (const [filePath, code] of csharpRuntimeSupportFiles(files)) {
    files.set(filePath, code);
  }
  return { ok: true, files };
};
