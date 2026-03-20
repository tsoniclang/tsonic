import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { AssemblyReference } from "@tsonic/backend";

export const findProjectCsproj = (projectRoot: string): string | null => {
  const files = readdirSync(projectRoot);
  const csprojFile = files.find((fileName) => fileName.endsWith(".csproj"));
  return csprojFile ? join(projectRoot, csprojFile) : null;
};

export const dedupePackageReferencesAgainstAssemblyReferences = <
  T extends { readonly id: string },
>(
  packageReferences: readonly T[],
  assemblyReferences: readonly { readonly name: string }[]
): readonly T[] => {
  if (packageReferences.length === 0 || assemblyReferences.length === 0) {
    return packageReferences;
  }

  const localAssemblyIds = new Set(
    assemblyReferences.map((reference) => reference.name.toLowerCase())
  );
  return packageReferences.filter(
    (reference) => !localAssemblyIds.has(reference.id.toLowerCase())
  );
};

const findDll = (dllName: string): string | null => {
  const projectLibPath = join(process.cwd(), "lib", dllName);
  if (existsSync(projectLibPath)) return projectLibPath;

  const cliRuntimePaths = [
    join(import.meta.dirname, "../../../runtime"),
    join(import.meta.dirname, "../../runtime"),
    join(import.meta.dirname, "../runtime"),
    join(process.cwd(), "node_modules/@tsonic/cli/runtime"),
  ];

  for (const runtimeDir of cliRuntimePaths) {
    const dllPath = join(runtimeDir, dllName);
    if (existsSync(dllPath)) return dllPath;
  }
  return null;
};

export const findRuntimeDlls = (
  outputDir: string
): readonly AssemblyReference[] => {
  const refs: AssemblyReference[] = [];
  const runtimeDll = findDll("Tsonic.Runtime.dll");
  if (runtimeDll) {
    refs.push({
      name: "Tsonic.Runtime",
      hintPath: relative(outputDir, runtimeDll),
    });
  }
  return refs;
};

export const collectProjectLibraries = (
  workspaceRoot: string,
  outputDir: string,
  libraries: readonly string[]
): readonly AssemblyReference[] => {
  const refs: AssemblyReference[] = [];

  for (const libPath of libraries) {
    const absolutePath = isAbsolute(libPath)
      ? libPath
      : join(workspaceRoot, libPath);
    if (!existsSync(absolutePath) || !libPath.endsWith(".dll")) continue;

    const dllName = libPath.split(/[\\/]/).pop() ?? "";
    if (dllName.toLowerCase() === "tsonic.runtime.dll") continue;

    refs.push({
      name: dllName.replace(/\.dll$/, ""),
      hintPath: relative(outputDir, absolutePath),
    });
  }

  return refs;
};

export const toGeneratedRelativePath = (modulePath: string): string => {
  const normalized = modulePath.replace(/\\/g, "/");
  const strippedLeadingTraversal = normalized.replace(/^(\.\.\/)+/, "");
  const hasEscapedSourceRoot = strippedLeadingTraversal !== normalized;
  const safeRelativePath = hasEscapedSourceRoot
    ? join("__external__", strippedLeadingTraversal).replace(/\\/g, "/")
    : strippedLeadingTraversal.replace(/^\/+/, "");
  return safeRelativePath.replace(/\.ts$/, ".cs");
};

export const findRuntimeProjectReferencePath = (): string | undefined => {
  const candidatePaths = [
    join(import.meta.dirname, "../../../../runtime/src/Tsonic.Runtime.csproj"),
    join(import.meta.dirname, "../../../runtime/src/Tsonic.Runtime.csproj"),
    join(
      import.meta.dirname,
      "../../../../../@tsonic/runtime/src/Tsonic.Runtime.csproj"
    ),
    join(
      import.meta.dirname,
      "../../../../@tsonic/runtime/src/Tsonic.Runtime.csproj"
    ),
  ].map((pathLike) => resolve(pathLike));

  return candidatePaths.find(existsSync);
};
