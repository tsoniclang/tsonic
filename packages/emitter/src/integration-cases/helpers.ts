import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildIrModule,
  createProgram,
  createProgramContext,
  runAnonymousTypeLoweringPass,
  runAttributeCollectionPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
  runOverloadCollectionPass,
  runOverloadFamilyConsistencyPass,
  validateProgram,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "../emitter.js";
import type { EmitterOptions } from "../types.js";

const helpersDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(helpersDir, "../../../../");
const workspaceRoot = path.resolve(repoRoot, "..");
const workspaceNodeModulesRoot = path.join(repoRoot, "node_modules");

const symlinkWorkspaceEntry = (
  sourcePath: string,
  targetPath: string
): void => {
  if (fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.lstatSync(sourcePath);
  fs.symlinkSync(sourcePath, targetPath, stat.isDirectory() ? "dir" : "file");
};

const getExplicitNodeModulesPackageRoots = (
  files: Readonly<Record<string, string>>
): ReadonlySet<string> => {
  const explicitPackageRoots = new Set<string>();

  for (const relativePath of Object.keys(files)) {
    if (!relativePath.startsWith("node_modules/")) {
      continue;
    }

    const segments = relativePath.split("/");
    if (segments.length < 2) {
      continue;
    }

    const packageRootSegments =
      segments[1]?.startsWith("@") && segments.length >= 3
        ? segments.slice(0, 3)
        : segments.slice(0, 2);
    explicitPackageRoots.add(packageRootSegments.join("/"));
  }

  return explicitPackageRoots;
};

const populateAuthoritativeWorkspaceNodeModules = (
  tempDir: string,
  explicitPackageRoots: ReadonlySet<string>
): void => {
  if (!fs.existsSync(workspaceNodeModulesRoot)) {
    return;
  }

  const tempNodeModulesRoot = path.join(tempDir, "node_modules");
  fs.mkdirSync(tempNodeModulesRoot, { recursive: true });

  const entries = fs.readdirSync(workspaceNodeModulesRoot, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(workspaceNodeModulesRoot, entry.name);
    const targetPath = path.join(tempNodeModulesRoot, entry.name);

    if (!entry.isDirectory()) {
      symlinkWorkspaceEntry(sourcePath, targetPath);
      continue;
    }

    if (entry.name !== "@tsonic") {
      if (explicitPackageRoots.has(`node_modules/${entry.name}`)) {
        continue;
      }
      symlinkWorkspaceEntry(sourcePath, targetPath);
      continue;
    }

    fs.mkdirSync(targetPath, { recursive: true });
    const scopedEntries = fs.readdirSync(sourcePath, { withFileTypes: true });
    for (const scopedEntry of scopedEntries) {
      const packageName = `@tsonic/${scopedEntry.name}`;
      if (explicitPackageRoots.has(`node_modules/@tsonic/${scopedEntry.name}`)) {
        continue;
      }
      const authoritativeRoot = findAuthoritativePackageRoot(packageName);
      const scopedSourcePath =
        authoritativeRoot ?? path.join(sourcePath, scopedEntry.name);
      const scopedTargetPath = path.join(targetPath, scopedEntry.name);
      symlinkWorkspaceEntry(scopedSourcePath, scopedTargetPath);
    }
  }
};

const readJsonObject = (filePath: string): Record<string, unknown> | undefined => {
  if (!ts.sys.fileExists(filePath)) {
    return undefined;
  }

  try {
    const text = ts.sys.readFile(filePath);
    if (!text) {
      return undefined;
    }
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const findAuthoritativePackageRoot = (
  packageName: string
): string | undefined => {
  const shortName = packageName.replace(/^@tsonic\//, "");
  const candidates = [
    path.join(workspaceRoot, shortName, "versions", "10"),
    path.join(workspaceRoot, shortName),
    path.join(workspaceRoot, shortName, "packages", shortName),
  ];

  for (const candidate of candidates) {
    const manifestPath = path.join(candidate, "tsonic.package.json");
    const packageJsonPath = path.join(candidate, "package.json");
    if (ts.sys.fileExists(packageJsonPath)) {
      const packageJson = readJsonObject(packageJsonPath);
      if (packageJson?.name === packageName) {
        return candidate;
      }
    }

    if (!ts.sys.fileExists(manifestPath)) {
      continue;
    }

    const manifest = readJsonObject(manifestPath);
    const surfaces = Array.isArray(manifest?.surfaces)
      ? manifest.surfaces.filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        )
      : [];
    if (surfaces.includes(packageName)) {
      return candidate;
    }
  }

  return undefined;
};

export const compileToCSharp = (
  source: string,
  fileName = "/test/test.ts",
  emitOptions: Partial<EmitterOptions> = {}
): string => {
  const normalizedFileName = fileName.replace(/\\/g, "/");
  const pathWithoutDrive = normalizedFileName.replace(/^[A-Za-z]:/, "");
  const relativeSegments = pathWithoutDrive
    .split("/")
    .filter((segment) => segment.length > 0);
  const entryRelativePath =
    relativeSegments.length > 0
      ? path.posix.join(...relativeSegments)
      : "test.ts";
  const sourceRootRelativePath =
    relativeSegments.length > 1 ? relativeSegments[0]! : ".";

  return compileProjectToCSharp(
    {
      [entryRelativePath]: source,
    },
    entryRelativePath,
    emitOptions,
    {
      sourceRootRelativePath,
      rootNamespace: "Test",
    }
  );
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
    const explicitNodeModulesPackageRoots = getExplicitNodeModulesPackageRoots(files);
    populateAuthoritativeWorkspaceNodeModules(
      tempDir,
      explicitNodeModulesPackageRoots
    );

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
    const validationDiagnostics = validateProgram(program);
    if (validationDiagnostics.hasErrors) {
      throw new Error(
        `Program validation failed: ${validationDiagnostics.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`
      );
    }
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
    const overloadResult = runOverloadCollectionPass(loweredModules);
    if (!overloadResult.ok) {
      throw new Error(
        `Overload collection failed: ${overloadResult.diagnostics.map((d) => d.message).join("; ")}`
      );
    }

    const overloadConsistencyResult = runOverloadFamilyConsistencyPass(
      overloadResult.modules
    );
    if (!overloadConsistencyResult.ok) {
      throw new Error(
        `Overload family consistency failed: ${overloadConsistencyResult.diagnostics.map((d) => d.message).join("; ")}`
      );
    }

    const attributeResult = runAttributeCollectionPass(
      overloadConsistencyResult.modules
    );
    if (!attributeResult.ok) {
      throw new Error(
        `Attribute collection failed: ${attributeResult.diagnostics.map((d) => d.message).join("; ")}`
      );
    }

    const proofResult = runNumericProofPass(attributeResult.modules);
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

    const emitResult = emitCSharpFiles(reloweredAfterRefreshModules, {
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
