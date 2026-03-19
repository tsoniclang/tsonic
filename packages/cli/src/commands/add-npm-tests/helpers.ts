import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const writeWorkspaceConfig = (
  dir: string,
  options: { readonly surface?: string } = {}
): string => {
  const configPath = join(dir, "tsonic.workspace.json");
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: options.surface ?? "clr",
        dotnet: {
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
      "\n",
    "utf-8"
  );

  return configPath;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const readWorkspaceConfig = (dir: string): any =>
  JSON.parse(readFileSync(join(dir, "tsonic.workspace.json"), "utf-8"));

export const writeLocalNpmPackage = (
  workspaceRoot: string,
  relDir: string,
  pkg: {
    readonly name: string;
    readonly manifest?: unknown;
    readonly aikyaManifest?: unknown;
    readonly bindingsRoot?: string;
    readonly dependencies?: Readonly<Record<string, string>>;
  }
): string => {
  const pkgRoot = join(workspaceRoot, relDir);
  mkdirSync(pkgRoot, { recursive: true });

  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        private: true,
        version: "1.0.0",
        type: "module",
        ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  if (pkg.manifest !== undefined) {
    writeFileSync(
      join(pkgRoot, "tsonic.bindings.json"),
      JSON.stringify(pkg.manifest, null, 2) + "\n",
      "utf-8"
    );
  }

  if (pkg.aikyaManifest !== undefined) {
    mkdirSync(join(pkgRoot, "tsonic"), { recursive: true });
    writeFileSync(
      join(pkgRoot, "tsonic", "package-manifest.json"),
      JSON.stringify(pkg.aikyaManifest, null, 2) + "\n",
      "utf-8"
    );
  }

  if (pkg.bindingsRoot) {
    mkdirSync(join(pkgRoot, pkg.bindingsRoot), { recursive: true });
  }

  return pkgRoot;
};

export const writeInstalledSurfacePackage = (
  workspaceRoot: string,
  pkg: {
    readonly name: string;
    readonly surfaceManifest: unknown;
  }
): string => {
  const [scope, name] = pkg.name.startsWith("@")
    ? pkg.name.split("/")
    : [undefined, pkg.name];
  const pkgRoot =
    scope && name
      ? join(workspaceRoot, "node_modules", scope, name)
      : join(workspaceRoot, "node_modules", pkg.name);
  mkdirSync(pkgRoot, { recursive: true });
  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: "1.0.0",
        type: "module",
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  writeFileSync(
    join(pkgRoot, "tsonic.surface.json"),
    JSON.stringify(pkg.surfaceManifest, null, 2) + "\n",
    "utf-8"
  );
  return pkgRoot;
};
