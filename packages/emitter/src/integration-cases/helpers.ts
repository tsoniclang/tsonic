import * as ts from "typescript";
import * as path from "node:path";
import { createRequire } from "node:module";
import {
  buildIrModule,
  DotnetMetadataRegistry,
  createClrBindingsResolver,
  createBinding,
  createProgramContext,
  loadBindings,
  runAnonymousTypeLoweringPass,
  runAttributeCollectionPass,
  runNumericProofPass,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "../emitter.js";
import type { EmitterOptions } from "../types.js";

const require = createRequire(import.meta.url);
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

const resolveDeclarationFilePath = (resolvedFilePath: string): string => {
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
  if (!ts.sys.directoryExists(dir)) {
    return [];
  }

  const results: string[] = [];
  for (const entry of ts.sys.readDirectory(dir, [".d.ts"], undefined, [
    "**/*.d.ts",
  ])) {
    if (entry.includes("/node_modules/") || entry.endsWith("/core-globals.d.ts")) {
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

  const declarationPath = resolveDeclarationFilePath(resolvedFilePath);

  return {
    filePath: declarationPath,
    packageRoot,
    extension: getModuleResolutionExtension(declarationPath),
  };
};

export const compileToCSharp = (
  source: string,
  fileName = "/test/test.ts",
  emitOptions: Partial<EmitterOptions> = {}
): string => {
  const resolvedPackageRoots = new Set<string>();
  resolvedPackageRoots.add(corePackageRoot);

  if (typeof emitOptions.surface === "string" && emitOptions.surface.startsWith("@")) {
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
    sourceFiles: [sourceFile],
    declarationSourceFiles: tsProgram
      .getSourceFiles()
      .filter((sourceFile) => sourceFile.isDeclarationFile),
    metadata: new DotnetMetadataRegistry(),
    bindings: loadBindings(Array.from(resolvedPackageRoots)),
    clrResolver: createClrBindingsResolver("/test"),
  };

  const options = programOptions;
  const ctx = createProgramContext(tsonicProgram, options);
  const irResult = buildIrModule(sourceFile, tsonicProgram, options, ctx);
  if (!irResult.ok) {
    throw new Error(`IR build failed: ${irResult.error.message}`);
  }

  const loweredModules = runAnonymousTypeLoweringPass([irResult.value]).modules;
  const proofResult = runNumericProofPass(loweredModules);
  if (!proofResult.ok) {
    throw new Error(
      `Numeric proof validation failed: ${proofResult.diagnostics.map((d) => d.message).join("; ")}`
    );
  }

  const attributeResult = runAttributeCollectionPass(proofResult.modules);
  if (!attributeResult.ok) {
    throw new Error(
      `Attribute collection failed: ${attributeResult.diagnostics.map((d) => d.message).join("; ")}`
    );
  }

  const emitResult = emitCSharpFiles(attributeResult.modules, {
    rootNamespace: "Test",
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
