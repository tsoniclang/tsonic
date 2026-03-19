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

const require = createRequire(import.meta.url);
const corePackageRoot = path.dirname(
  require.resolve("@tsonic/core/package.json")
);
const coreTypesPath = path.join(corePackageRoot, "types.d.ts");
const coreLangPath = path.join(corePackageRoot, "lang.d.ts");

const resolveTsonicModule = (
  moduleName: string
): { readonly filePath: string; readonly packageRoot: string } | undefined => {
  if (!moduleName.startsWith("@tsonic/")) {
    return undefined;
  }

  const parts = moduleName.split("/");
  if (parts.length < 2) {
    return undefined;
  }

  const packageName = parts.slice(0, 2).join("/");
  const packageRoot = path.dirname(
    require.resolve(`${packageName}/package.json`)
  );
  const subPath = moduleName.slice(packageName.length + 1);
  const declarationPath = path.join(
    packageRoot,
    subPath.replace(/\.js$/, ".d.ts")
  );

  return {
    filePath: declarationPath,
    packageRoot,
  };
};

export const compileToCSharp = (
  source: string,
  fileName = "/test/test.ts"
): string => {
  const resolvedPackageRoots = new Set<string>();

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
          ? { filePath: coreTypesPath, packageRoot: corePackageRoot }
          : moduleName === "@tsonic/core/lang.js"
            ? { filePath: coreLangPath, packageRoot: corePackageRoot }
            : resolveTsonicModule(moduleName);
      if (resolvedTsonicModule) {
        resolvedPackageRoots.add(resolvedTsonicModule.packageRoot);
        return {
          resolvedFileName: resolvedTsonicModule.filePath,
          extension: ts.Extension.Dts,
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

  const tsProgram = ts.createProgram([fileName], compilerOptions, host);
  const checker = tsProgram.getTypeChecker();

  const tsonicProgram = {
    program: tsProgram,
    checker,
    binding: createBinding(checker),
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "Test",
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: loadBindings(Array.from(resolvedPackageRoots)),
    clrResolver: createClrBindingsResolver("/test"),
  };

  const options = { sourceRoot: "/test", rootNamespace: "Test" };
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
