/**
 * Dependency graph builder - Multi-file compilation
 * Traverses local imports through Tsonic/TSTS-owned module resolution.
 */

import { relative, resolve } from "path";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import type { BackendTargetId, EmittableIrModule } from "../ir/types.js";
import { buildIr } from "../ir/builder/orchestrator.js";
import { createProgram } from "./creation.js";
import type { CompilerOptions } from "./types.js";
import type { BindingRegistry, TypeBinding } from "./bindings.js";
import { discoverAndLoadExternalBindings } from "./external-bindings-discovery.js";
import { validateProgram } from "../validation/orchestrator.js";
import {
  resolveSurfaceCapabilities,
  type SurfaceCapabilities,
} from "../surface/profiles.js";
import { runIrProcessingPipeline } from "./ir-processing-pipeline.js";
import {
  buildWorkspaceGraphSnapshot,
  type WorkspaceGraphSnapshot,
} from "./workspace-fingerprint.js";
import { getProgramTargetSurfaceArtifacts } from "./queries.js";
import type { TargetRenderTable } from "../symbols/index.js";
import { discoverProgramInputs } from "./program-input-discovery.js";

export type ModuleDependencyGraphResult<
  Target extends BackendTargetId = BackendTargetId,
> = {
  readonly modules: readonly EmittableIrModule<Target>[];
  readonly entryModule: EmittableIrModule<Target>;
  readonly surfaceCapabilities: SurfaceCapabilities;
  /** Type bindings loaded from external packages (for emitter bindingsRegistry) */
  readonly bindings: ReadonlyMap<string, TypeBinding>;
  /** Full binding registry for exact global/module/source binding lookups during emission. */
  readonly bindingRegistry: BindingRegistry;
  /** Target render table keyed by neutral frontend symbol IDs. */
  readonly targetRenderTable?: TargetRenderTable;
  /** Deterministic source/config/surface graph used for invalidation and cache keys. */
  readonly workspaceGraph: WorkspaceGraphSnapshot;
};

const tryConvertProgramBuildExceptionToDiagnostics = (
  err: unknown
): readonly Diagnostic[] | undefined => {
  if (!(err instanceof Error)) {
    return undefined;
  }

  const invalidNativeMetadataPrefix =
    "Invalid native source package metadata at ";
  if (err.message.startsWith(invalidNativeMetadataPrefix)) {
    const manifestPath = err.message
      .slice(invalidNativeMetadataPrefix.length)
      .replace(/\.$/, "");
    return [
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "Native source packages must declare valid source metadata in tsonic.package.json, including source.namespace and source.exports."
      ),
    ];
  }

  const missingPackageMetadataPrefix = "Installed source package at ";
  if (
    err.message.startsWith(missingPackageMetadataPrefix) &&
    err.message.endsWith(" is missing valid package metadata.")
  ) {
    const packageRoot = err.message.slice(
      missingPackageMetadataPrefix.length,
      -" is missing valid package metadata.".length
    );
    return [
      createDiagnostic(
        "TSN1004",
        "error",
        `Installed source package at ${packageRoot} is missing valid package metadata.`,
        undefined,
        "Native source packages must include package.json name plus valid source.namespace and source.exports in tsonic.package.json."
      ),
    ];
  }

  if (
    err.message.startsWith(missingPackageMetadataPrefix) &&
    err.message.endsWith(" is missing package.json name.")
  ) {
    const packageRoot = err.message.slice(
      missingPackageMetadataPrefix.length,
      -" is missing package.json name.".length
    );
    return [
      createDiagnostic(
        "TSN1004",
        "error",
        `Installed source package at ${packageRoot} is missing package.json name.`,
        undefined,
        "Native source packages must include a package.json with a valid name."
      ),
    ];
  }

  return undefined;
};

const dedupeModulesBySourceIdentity = <
  Target extends BackendTargetId = BackendTargetId,
>(
  modules: readonly EmittableIrModule<Target>[]
): readonly EmittableIrModule<Target>[] => {
  const deduped: EmittableIrModule<Target>[] = [];
  const seenModuleIds = new Set<string>();

  for (const module of modules) {
    const moduleId = `${module.namespace}\0${module.className}\0${module.filePath}`;
    if (seenModuleIds.has(moduleId)) {
      continue;
    }
    seenModuleIds.add(moduleId);
    deduped.push(module);
  }

  return deduped;
};

/**
 * Build complete module dependency graph from entry point
 * Traverses all local imports and builds IR for all discovered modules
 * Uses Tsonic/TSTS-owned module resolution; no TypeScript compiler bridge.
 */
export const buildModuleDependencyGraph = <
  Target extends BackendTargetId = BackendTargetId,
>(
  entryFile: string,
  options: CompilerOptions<Target>
): Result<ModuleDependencyGraphResult<Target>, readonly Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  // Normalize entry file and source root to absolute paths
  const entryAbs = resolve(entryFile);
  const sourceRootAbs = resolve(options.sourceRoot);
  const surfaceCapabilities = resolveSurfaceCapabilities(options.surface, {
    projectRoot: options.projectRoot,
  });
  const discovery = discoverProgramInputs([entryAbs], {
    ...options,
    sourceRoot: sourceRootAbs,
  }, surfaceCapabilities);
  diagnostics.push(...discovery.diagnostics);
  const allDiscoveredFiles = [...discovery.allFiles];
  const ambientSupportFiles = [...discovery.ambientSupportFiles];
  const discoveryTypeRoots = [...discovery.typeRoots];
  const dependencyEdges = [...discovery.dependencyEdges];
  // If any diagnostics from discovery, fail the build
  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  // Ensure we discovered at least the entry file
  if (allDiscoveredFiles.length === 0) {
    return error([
      createDiagnostic(
        "TSN1002",
        "error",
        `No modules found starting from entry point '${entryFile}'`,
        {
          file: entryFile,
          line: 1,
          column: 1,
          length: 1,
        }
      ),
    ]);
  }

  // Second pass: create the TSTS-backed program from the user entry root.
  //
  // IMPORTANT: do not pass `allDiscoveredFiles` back as createProgram inputs.
  // `createProgram` performs its own discovery and treats its input files as
  // runtime-emittable roots. Passing the semantic support closure here would
  // promote ambient/support source packages into IR modules, defeating the
  // entrypoint-scoped architecture and making source-package fixtures compile
  // broad dependency surfaces they never imported.
  // Use absolute sourceRoot for consistency
  const programResult = createProgram([entryAbs], {
    ...options,
    sourceRoot: sourceRootAbs,
  });
  if (!programResult.ok) {
    return error(programResult.error.diagnostics);
  }

  const tsonicProgram = programResult.value;

  // Load external bindings before IR building
  // This scans all imports and loads their bindings upfront
  discoverAndLoadExternalBindings(tsonicProgram, options.verbose);
  // Run source-level validation (imports, exports, unsupported features, generics)
  const validationCollector = validateProgram(tsonicProgram);
  if (validationCollector.diagnostics.length > 0) {
    return error(validationCollector.diagnostics);
  }

  // Third pass: Build IR for all discovered modules
  // buildIr() creates a single ProgramContext for the entire program.
  // This ensures no global singleton state and enables parallel compilation safety
  let irResult: ReturnType<typeof buildIr>;
  try {
    irResult = buildIr(tsonicProgram, {
      sourceRoot: sourceRootAbs,
      rootNamespace: options.rootNamespace,
    });
  } catch (err) {
    const converted = tryConvertProgramBuildExceptionToDiagnostics(err);
    if (converted) {
      return error([...converted]);
    }
    throw err;
  }

  if (!irResult.ok) {
    return error(irResult.error);
  }

  const processedResult = runIrProcessingPipeline(
    [...irResult.value],
    tsonicProgram,
    {
      sourceRoot: sourceRootAbs,
      rootNamespace: options.rootNamespace,
      backendCapabilities: options.backendCapabilities,
      backendTargetId: options.backendTargetId,
    }
  );
  if (!processedResult.ok) {
    return error(processedResult.error);
  }

  const processedModules = [
    ...dedupeModulesBySourceIdentity(processedResult.value.modules),
  ];

  // Sort modules by relative path for deterministic output
  processedModules.sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Entry module is the first one (after sorting, it should be the entry file)
  // But let's find it by matching the entry file path
  const entryRelative = relative(sourceRootAbs, entryAbs).replace(/\\/g, "/");
  const foundEntryModule = processedModules.find(
    (m) => m.filePath === entryRelative
  );
  const entryModule = foundEntryModule ?? processedModules[0];
  if (entryModule === undefined) {
    return error([
      createDiagnostic("TSN1001", "error", "No modules found in the project", {
        file: entryAbs,
        line: 1,
        column: 1,
        length: 1,
      }),
    ]);
  }

  return ok({
    modules: processedModules,
    entryModule,
    surfaceCapabilities:
      tsonicProgram.surfaceCapabilities ?? surfaceCapabilities,
    bindings: tsonicProgram.bindings.getEmitterTypeMap(),
    bindingRegistry: tsonicProgram.bindings,
    targetRenderTable:
      getProgramTargetSurfaceArtifacts(tsonicProgram)?.renderTable,
    workspaceGraph: buildWorkspaceGraphSnapshot({
      projectRoot: options.projectRoot,
      sourceRoot: sourceRootAbs,
      sourceFiles: allDiscoveredFiles,
      ambientFiles: ambientSupportFiles,
      typeRoots: discoveryTypeRoots,
      edges: dependencyEdges,
      options,
      surfaceCapabilities:
        tsonicProgram.surfaceCapabilities ?? surfaceCapabilities,
    }),
  });
};
