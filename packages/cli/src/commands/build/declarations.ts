import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as ts from "typescript";
import type { ResolvedConfig, Result } from "../../types.js";

type EmitLibraryDeclarationsOptions = {
  readonly preserveSourceRoot?: boolean;
};

const listTypeScriptSourceInputs = (sourceRoot: string): readonly string[] => {
  const out: string[] = [];
  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (
        entry.isFile() &&
        (absolute.endsWith(".ts") ||
          absolute.endsWith(".mts") ||
          absolute.endsWith(".cts")) &&
        !absolute.endsWith(".d.ts")
      ) {
        out.push(absolute);
      }
    }
  };
  if (existsSync(sourceRoot)) visit(sourceRoot);
  return out;
};

const listDeclarationFiles = (roots: readonly string[]): readonly string[] => {
  const out: string[] = [];
  const seen = new Set<string>();

  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (entry.isFile() && absolute.endsWith(".d.ts") && !seen.has(absolute)) {
        seen.add(absolute);
        out.push(absolute);
      }
    }
  };

  for (const root of roots) {
    if (existsSync(root)) visit(root);
  }
  return out;
};

const formatTsDiagnostics = (
  diagnostics: readonly ts.Diagnostic[],
  cwd: string
): string => {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => cwd,
    getNewLine: () => "\n",
  };
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host).trim();
};

const normalizeSlashes = (pathLike: string): string => pathLike.replace(/\\/g, "/");

export const emitLibraryTypeDeclarations = (
  config: ResolvedConfig,
  options: EmitLibraryDeclarationsOptions = {}
): Result<void, string> => {
  const emitRootDir = resolve(config.workspaceRoot);
  const sourceRoot = resolve(config.projectRoot, config.sourceRoot);
  const sourceFiles = listTypeScriptSourceInputs(sourceRoot);
  if (sourceFiles.length === 0) {
    return {
      ok: false,
      error: `No TypeScript source files found under sourceRoot: ${sourceRoot}`,
    };
  }

  const distDir = join(config.projectRoot, "dist");
  mkdirSync(distDir, { recursive: true });
  const resolvedTypeRoots = config.typeRoots.map((pathLike) =>
    resolve(config.workspaceRoot, pathLike)
  );
  const declarationFiles = listDeclarationFiles(resolvedTypeRoots);
  const rootNames = Array.from(new Set<string>([...sourceFiles, ...declarationFiles]));
  const sourceRootFromEmitRoot = normalizeSlashes(relative(emitRootDir, sourceRoot));
  const projectRootFromEmitRoot = normalizeSlashes(
    relative(emitRootDir, resolve(config.projectRoot))
  );
  const normalizedDistDir = normalizeSlashes(distDir);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    declaration: true,
    emitDeclarationOnly: true,
    noEmitOnError: true,
    allowImportingTsExtensions: true,
    noCheck: true,
    skipLibCheck: true,
    preserveSymlinks: true,
    outDir: distDir,
    rootDir: emitRootDir,
    types: [],
  };

  const host = ts.createCompilerHost(compilerOptions, true);
  const program = ts.createProgram({ rootNames, options: compilerOptions, host });
  const preEmitDiagnostics = ts.getPreEmitDiagnostics(program);
  if (preEmitDiagnostics.length > 0) {
    return {
      ok: false,
      error:
        `Type declaration emit failed before emit.\n` +
        formatTsDiagnostics(preEmitDiagnostics, config.projectRoot),
    };
  }

  const emitResult = program.emit(
    undefined,
    (fileName, text, writeByteOrderMark) => {
      const normalizedFileName = normalizeSlashes(fileName);
      const distPrefix = `${normalizedDistDir}/`;

      const relativeEmittedPath = normalizedFileName.startsWith(distPrefix)
        ? normalizedFileName.slice(distPrefix.length)
        : normalizedFileName === normalizedDistDir
          ? ""
          : null;

      if (
        relativeEmittedPath !== null &&
        (relativeEmittedPath === "node_modules" ||
          relativeEmittedPath.startsWith("node_modules/"))
      ) {
        return;
      }

      let targetPath = fileName;
      const trimPrefix =
        options.preserveSourceRoot === true
          ? projectRootFromEmitRoot
          : sourceRootFromEmitRoot;

      if (
        relativeEmittedPath !== null &&
        trimPrefix.length > 0 &&
        (relativeEmittedPath === trimPrefix ||
          relativeEmittedPath.startsWith(`${trimPrefix}/`))
      ) {
        const trimmedRelativePath = relativeEmittedPath
          .slice(trimPrefix.length)
          .replace(/^\/+/, "");
        targetPath =
          trimmedRelativePath.length > 0
            ? join(distDir, ...trimmedRelativePath.split("/"))
            : distDir;
      }

      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(
        targetPath,
        writeByteOrderMark ? `\uFEFF${text}` : text,
        "utf-8"
      );
    },
    undefined,
    true
  );
  if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
    return {
      ok: false,
      error:
        `Type declaration emit failed.\n` +
        formatTsDiagnostics(emitResult.diagnostics, config.projectRoot),
    };
  }

  return { ok: true, value: undefined };
};
