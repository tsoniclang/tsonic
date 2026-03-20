import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ResolvedConfig, Result } from "../../types.js";

export const overlayDependencyBindings = (
  config: ResolvedConfig,
  bindingsOutDir: string
): Result<void, string> => {
  const depBindingsDirByAssembly = new Map<string, string>();
  for (const lib of config.libraries) {
    if (!lib.toLowerCase().endsWith(".dll")) continue;
    const assemblyName = basename(lib, ".dll");
    if (assemblyName === config.outputName) continue;
    const depBindingsDir = resolveDependencyBindingsDirForDll(lib);
    if (existsSync(depBindingsDir)) {
      depBindingsDirByAssembly.set(assemblyName, depBindingsDir);
    }
  }

  if (depBindingsDirByAssembly.size === 0) {
    return { ok: true, value: undefined };
  }

  const generatedNamespaces = readdirSync(bindingsOutDir, {
    withFileTypes: true,
  })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const ns of generatedNamespaces) {
    const internalIndexPath = join(
      bindingsOutDir,
      ns,
      "internal",
      "index.d.ts"
    );
    if (!existsSync(internalIndexPath)) continue;

    const content = readFileSync(internalIndexPath, "utf-8");
    const assemblyMatch = content.match(/^\/\/ Assembly:\s*(.+)\s*$/m);
    if (!assemblyMatch || !assemblyMatch[1]) continue;
    const assembly = assemblyMatch[1].trim();

    const depDir = depBindingsDirByAssembly.get(assembly);
    if (!depDir) continue;

    const depInternalIndex = join(depDir, ns, "internal", "index.d.ts");
    if (existsSync(depInternalIndex)) {
      copyFileSync(depInternalIndex, internalIndexPath);
    }

    const facadeDts = join(bindingsOutDir, `${ns}.d.ts`);
    const depFacadeDts = join(depDir, `${ns}.d.ts`);
    if (existsSync(facadeDts) && existsSync(depFacadeDts)) {
      copyFileSync(depFacadeDts, facadeDts);
    }
  }

  return { ok: true, value: undefined };
};

export const resolveDependencyBindingsDirForDll = (dllPath: string): string => {
  let cursor = resolve(dirname(dllPath));
  for (let i = 0; i < 24; i += 1) {
    const projectStyle = join(cursor, "dist", "tsonic", "bindings");
    if (existsSync(projectStyle)) return projectStyle;

    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return join(resolve(dirname(dllPath)), "dist", "tsonic", "bindings");
};
