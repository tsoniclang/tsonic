import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Result } from "../../types.js";

export const ensurePackageJson = (
  dir: string,
  packageName: string
): Result<void, string> => {
  const pkgJsonPath = join(dir, "package.json");
  if (existsSync(pkgJsonPath)) return { ok: true, value: undefined };

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      pkgJsonPath,
      JSON.stringify(
        {
          name: packageName,
          version: "0.0.0",
          private: true,
          type: "module",
          tsonic: { generated: true },
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write bindings package.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export type GeneratedBindingsKind = "framework" | "nuget" | "dll";

export const bindingsStoreDir = (
  projectRoot: string,
  kind: GeneratedBindingsKind,
  packageName: string
): string => join(projectRoot, ".tsonic", "bindings", kind, packageName);

export const ensureGeneratedBindingsPackageJson = (
  dir: string,
  packageName: string,
  meta: {
    readonly kind: GeneratedBindingsKind;
    readonly source: Record<string, unknown>;
  }
): Result<void, string> => {
  const pkgJsonPath = join(dir, "package.json");

  if (existsSync(pkgJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<
        string,
        unknown
      >;
      if (parsed.name !== packageName) {
        return {
          ok: false,
          error:
            `Refusing to reuse existing bindings package with a different name.\n` +
            `Expected: ${packageName}\n` +
            `Found: ${String(parsed.name)}`,
        };
      }

      const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
      if (tsonic.generated !== true) {
        return {
          ok: false,
          error:
            `Refusing to overwrite non-generated package.json at ${pkgJsonPath}.\n` +
            `Move it aside or delete the directory and retry.`,
        };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse existing package.json at ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      pkgJsonPath,
      JSON.stringify(
        {
          name: packageName,
          version: "0.0.0",
          private: true,
          type: "module",
          tsonic: { generated: true, ...meta },
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write bindings package.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const installGeneratedBindingsPackage = (
  projectRoot: string,
  packageName: string,
  fromDir: string
): Result<void, string> => {
  const nodeModulesDir = join(projectRoot, "node_modules");
  mkdirSync(nodeModulesDir, { recursive: true });

  const targetDir = join(nodeModulesDir, packageName);
  if (existsSync(targetDir)) {
    const pkgJsonPath = join(targetDir, "package.json");
    if (!existsSync(pkgJsonPath)) {
      return {
        ok: false,
        error:
          `Refusing to overwrite existing directory without package.json: ${targetDir}\n` +
          `Rename/remove it and retry.`,
      };
    }
    try {
      const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<
        string,
        unknown
      >;
      const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
      if (tsonic.generated !== true) {
        return {
          ok: false,
          error:
            `Refusing to overwrite existing npm package '${packageName}' in node_modules.\n` +
            `Delete ${targetDir} if you intended to replace it.`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    rmSync(targetDir, { recursive: true, force: true });
  }

  mkdirSync(dirname(targetDir), { recursive: true });
  cpSync(fromDir, targetDir, { recursive: true, force: true });
  return { ok: true, value: undefined };
};
