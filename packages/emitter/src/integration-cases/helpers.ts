import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  buildIrModule,
  DotnetMetadataRegistry,
  createClrBindingsResolver,
  createBinding,
  createProgram,
  createProgramContext,
  loadBindings,
  runAnonymousTypeLoweringPass,
  runAttributeCollectionPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "../emitter.js";
import type { EmitterOptions } from "../types.js";

const require = createRequire(import.meta.url);
const helpersDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(helpersDir, "../../../../");
const workspaceNodeModulesRoot = path.join(repoRoot, "node_modules");
const readSourcePackageAmbientPaths = (
  packageRoot: string
): readonly string[] => {
  const manifestPath = path.join(packageRoot, "tsonic.package.json");
  if (!ts.sys.fileExists(manifestPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(ts.sys.readFile(manifestPath) ?? "") as {
      readonly kind?: unknown;
      readonly source?: { readonly ambient?: unknown };
    };
    if (parsed.kind !== "tsonic-source-package") {
      return [];
    }

    const ambientEntries = Array.isArray(parsed.source?.ambient)
      ? parsed.source.ambient.filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        )
      : [];

    return ambientEntries
      .map((entry) => path.resolve(packageRoot, entry))
      .filter((entry) => ts.sys.fileExists(entry));
  } catch {
    return [];
  }
};

const isNativeSourcePackageRoot = (packageRoot: string): boolean =>
  readSourcePackageAmbientPaths(packageRoot).length > 0 ||
  ts.sys.fileExists(path.join(packageRoot, "tsonic.package.json"));

const findNearestPackageRoot = (
  resolvedFilePath: string
): string | undefined => {
  let currentDir = path.dirname(resolvedFilePath);

  for (;;) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (ts.sys.fileExists(packageJsonPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
};

const resolveModuleFilePath = (
  resolvedFilePath: string,
  packageRoot: string
): string => {
  if (isNativeSourcePackageRoot(packageRoot)) {
    return resolvedFilePath;
  }

  if (resolvedFilePath.endsWith(".d.ts") || resolvedFilePath.endsWith(".ts")) {
    return resolvedFilePath;
  }

  if (resolvedFilePath.endsWith(".js")) {
    const declarationPath = resolvedFilePath.replace(/\.js$/, ".d.ts");
    if (ts.sys.fileExists(declarationPath)) {
      return declarationPath;
    }
  }

  return resolvedFilePath;
};

const scanDeclarationFiles = (dir: string): readonly string[] => {
  const ambientPaths = readSourcePackageAmbientPaths(dir);
  if (ambientPaths.length > 0) {
    return ambientPaths;
  }

  if (!ts.sys.directoryExists(dir)) {
    return [];
  }

  const results: string[] = [];
  for (const entry of ts.sys.readDirectory(dir, [".d.ts"], undefined, [
    "**/*.d.ts",
  ])) {
    const relativeEntry = path.relative(dir, path.resolve(entry));
    if (relativeEntry.startsWith("..")) {
      continue;
    }

    const relativeSegments = relativeEntry.split(path.sep);
    if (
      relativeSegments.includes("node_modules") ||
      entry.endsWith("/core-globals.d.ts")
    ) {
      continue;
    }
    results.push(path.resolve(entry));
  }
  return results;
};

const getModuleResolutionExtension = (
  resolvedFilePath: string
): ts.Extension => {
  if (resolvedFilePath.endsWith(".d.ts")) {
    return ts.Extension.Dts;
  }
  if (resolvedFilePath.endsWith(".ts")) {
    return ts.Extension.Ts;
  }
  return ts.Extension.Js;
};

const coreTypesResolvedPath = require.resolve("@tsonic/core/types.js");
const corePackageRoot =
  findNearestPackageRoot(coreTypesResolvedPath) ??
  path.dirname(coreTypesResolvedPath);
const coreTypesPath = path.join(corePackageRoot, "types.d.ts");
const coreLangPath = path.join(corePackageRoot, "lang.d.ts");

const resolveTsonicModule = (
  moduleName: string
):
  | {
      readonly filePath: string;
      readonly packageRoot: string;
      readonly extension: ts.Extension;
    }
  | undefined => {
  if (!moduleName.startsWith("@tsonic/")) {
    return undefined;
  }

  let resolvedFilePath: string;
  try {
    resolvedFilePath = require.resolve(moduleName);
  } catch {
    return undefined;
  }

  const packageRoot = findNearestPackageRoot(resolvedFilePath);
  if (!packageRoot) {
    return undefined;
  }

  const modulePath = resolveModuleFilePath(resolvedFilePath, packageRoot);

  return {
    filePath: modulePath,
    packageRoot,
    extension: getModuleResolutionExtension(modulePath),
  };
};

export const compileToCSharp = (
  source: string,
  fileName = "/test/test.ts",
  emitOptions: Partial<EmitterOptions> = {}
): string => {
  const resolvedPackageRoots = new Set<string>();
  resolvedPackageRoots.add(corePackageRoot);

  if (
    typeof emitOptions.surface === "string" &&
    emitOptions.surface.startsWith("@")
  ) {
    const surfaceEntry = resolveTsonicModule(`${emitOptions.surface}/index.js`);
    if (surfaceEntry) {
      resolvedPackageRoots.add(surfaceEntry.packageRoot);
    }
  }

  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    noLib: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  const originalResolveModuleNames = host.resolveModuleNames?.bind(host);
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) {
      return sourceFile;
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };
  host.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string,
    reusedNames?: string[],
    redirectedReference?: ts.ResolvedProjectReference,
    options?: ts.CompilerOptions
  ): (ts.ResolvedModule | undefined)[] => {
    const resolutionOptions = options ?? compilerOptions;
    return moduleNames.map((moduleName) => {
      const resolvedTsonicModule =
        moduleName === "@tsonic/core/types.js"
          ? {
              filePath: coreTypesPath,
              packageRoot: corePackageRoot,
              extension: ts.Extension.Dts,
            }
          : moduleName === "@tsonic/core/lang.js"
            ? {
                filePath: coreLangPath,
                packageRoot: corePackageRoot,
                extension: ts.Extension.Dts,
              }
            : resolveTsonicModule(moduleName);
      if (resolvedTsonicModule) {
        resolvedPackageRoots.add(resolvedTsonicModule.packageRoot);
        return {
          resolvedFileName: resolvedTsonicModule.filePath,
          extension: resolvedTsonicModule.extension,
          isExternalLibraryImport: true,
        };
      }
      return (
        originalResolveModuleNames?.(
          [moduleName],
          containingFile,
          reusedNames,
          redirectedReference,
          resolutionOptions
        )?.[0] ??
        ts.resolveModuleName(
          moduleName,
          containingFile,
          resolutionOptions,
          host
        ).resolvedModule
      );
    });
  };

  const declarationRootFiles = Array.from(
    new Set(
      Array.from(resolvedPackageRoots).flatMap((packageRoot) =>
        scanDeclarationFiles(packageRoot)
      )
    )
  );

  const tsProgram = ts.createProgram(
    [fileName, ...declarationRootFiles],
    compilerOptions,
    host
  );
  const checker = tsProgram.getTypeChecker();

  const programOptions = {
    projectRoot: "/test",
    sourceRoot: "/test",
    rootNamespace: "Test",
    ...(emitOptions.surface ? { surface: emitOptions.surface } : {}),
  };

  const tsonicProgram = {
    program: tsProgram,
    checker,
    binding: createBinding(checker),
    options: programOptions,
    sourceFiles: tsProgram
      .getSourceFiles()
      .filter((candidate) => !candidate.isDeclarationFile),
    declarationSourceFiles: tsProgram
      .getSourceFiles()
      .filter((sourceFile) => sourceFile.isDeclarationFile),
    metadata: new DotnetMetadataRegistry(),
    bindings: loadBindings(Array.from(resolvedPackageRoots)),
    clrResolver: createClrBindingsResolver("/test"),
  };

  const options = programOptions;
  const ctx = createProgramContext(tsonicProgram, options);
  const modules = tsonicProgram.sourceFiles.flatMap((candidateSourceFile) => {
    const irResult = buildIrModule(
      candidateSourceFile,
      tsonicProgram,
      options,
      ctx
    );
    if (!irResult.ok) {
      throw new Error(`IR build failed: ${irResult.error.message}`);
    }
    return [irResult.value];
  });

  const loweredModules = runAnonymousTypeLoweringPass(modules).modules;
  const proofResult = runNumericProofPass(loweredModules);
  if (!proofResult.ok) {
    throw new Error(
      `Numeric proof validation failed: ${proofResult.diagnostics.map((d) => d.message).join("; ")}`
    );
  }

  const refreshedCallResolutionResult = runCallResolutionRefreshPass(
    proofResult.modules,
    ctx
  );
  const reloweredAfterRefreshModules = runAnonymousTypeLoweringPass(
    refreshedCallResolutionResult.modules
  ).modules;

  const attributeResult = runAttributeCollectionPass(
    reloweredAfterRefreshModules
  );
  if (!attributeResult.ok) {
    throw new Error(
      `Attribute collection failed: ${attributeResult.diagnostics.map((d) => d.message).join("; ")}`
    );
  }

  const emitResult = emitCSharpFiles(attributeResult.modules, {
    rootNamespace: "Test",
    bindingRegistry: tsonicProgram.bindings,
    ...emitOptions,
  });
  if (!emitResult.ok) {
    throw new Error(
      `Emit failed: ${emitResult.errors.map((d) => d.message).join("; ")}`
    );
  }

  return [...emitResult.files.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, code]) => code)
    .join("\n\n");
};

export const compileProjectToCSharp = (
  files: Readonly<Record<string, string>>,
  entryRelativePath: string,
  emitOptions: Partial<EmitterOptions> = {},
  projectOptions?: {
    readonly sourceRootRelativePath?: string;
    readonly rootNamespace?: string;
  }
): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-emitter-project-")
  );

  try {
    const usesCustomNodeModules = Object.keys(files).some((relativePath) =>
      relativePath.startsWith("node_modules/")
    );
    if (!usesCustomNodeModules && fs.existsSync(workspaceNodeModulesRoot)) {
      fs.symlinkSync(
        workspaceNodeModulesRoot,
        path.join(tempDir, "node_modules"),
        "dir"
      );
    }

    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, contents);
    }

    const packageJsonPath = path.join(tempDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(
          {
            name: "emitter-test-project",
            version: "1.0.0",
            type: "module",
          },
          null,
          2
        )
      );
    }

    const entryPath = path.join(tempDir, entryRelativePath);
    const sourceRoot = path.join(
      tempDir,
      projectOptions?.sourceRootRelativePath ?? "src"
    );
    const rootNamespace = projectOptions?.rootNamespace ?? "Test";
    const programOptions = {
      projectRoot: tempDir,
      sourceRoot,
      rootNamespace,
      ...(emitOptions.surface ? { surface: emitOptions.surface } : {}),
    };

    const programResult = createProgram([entryPath], programOptions);
    if (!programResult.ok) {
      throw new Error(
        `Program creation failed: ${programResult.error.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`
      );
    }

    const program = programResult.value;
    const ctx = createProgramContext(program, {
      sourceRoot,
      rootNamespace,
    });
    const modules = program.sourceFiles.flatMap((sourceFile) => {
      const result = buildIrModule(
        sourceFile,
        program,
        {
          sourceRoot,
          rootNamespace,
        },
        ctx
      );
      return result.ok ? [result.value] : [];
    });

    const loweredModules = runAnonymousTypeLoweringPass(modules).modules;
    const proofResult = runNumericProofPass(loweredModules);
    if (!proofResult.ok) {
      throw new Error(
        `Numeric proof validation failed: ${proofResult.diagnostics.map((d) => d.message).join("; ")}`
      );
    }

    const refreshedCallResolutionResult = runCallResolutionRefreshPass(
      proofResult.modules,
      ctx
    );
    const reloweredAfterRefreshModules = runAnonymousTypeLoweringPass(
      refreshedCallResolutionResult.modules
    ).modules;

    const attributeResult = runAttributeCollectionPass(
      reloweredAfterRefreshModules
    );
    if (!attributeResult.ok) {
      throw new Error(
        `Attribute collection failed: ${attributeResult.diagnostics.map((d) => d.message).join("; ")}`
      );
    }

    const emitResult = emitCSharpFiles(attributeResult.modules, {
      rootNamespace,
      bindingRegistry: program.bindings,
      ...emitOptions,
    });
    if (!emitResult.ok) {
      throw new Error(
        `Emit failed: ${emitResult.errors.map((d) => d.message).join("; ")}`
      );
    }

    return [...emitResult.files.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, code]) => code)
      .join("\n\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
