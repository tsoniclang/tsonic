import { describe, it, afterEach } from "mocha";
import { expect } from "chai";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClrBindingsResolver } from "./clr-bindings-resolver.js";

type TestPkgSpec = {
  readonly packageName: string;
  readonly namespaceKey: string;
  readonly namespace: string;
  readonly assemblyName: string;
};

const writeJson = (filePath: string, value: unknown) => {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const writeText = (filePath: string, value: string) => {
  writeFileSync(filePath, value);
};

describe("ClrBindingsResolver (npm exports + dist bindings)", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const createWorkspaceRoot = (): string => {
    const root = join(
      tmpdir(),
      `tsonic-clr-bindings-resolver-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
    );
    createdDirs.push(root);
    mkdirSync(root, { recursive: true });
    writeJson(join(root, "package.json"), {
      name: "test-root",
      private: true,
      type: "module",
    });
    mkdirSync(join(root, "node_modules"), { recursive: true });
    return root;
  };

  const createScopedPackageRoot = (
    workspaceRoot: string,
    packageName: string
  ): string => {
    const match = packageName.match(/^@([^/]+)\/([^/]+)$/);
    if (!match) throw new Error(`Expected scoped package name, got: ${packageName}`);
    const scope = match[1];
    const name = match[2];
    if (!scope || !name) throw new Error(`Invalid scoped package name: ${packageName}`);
    return join(workspaceRoot, "node_modules", `@${scope}`, name);
  };

  const createUnscopedPackageRoot = (
    workspaceRoot: string,
    packageName: string
  ): string => join(workspaceRoot, "node_modules", packageName);

  const writeDistBindingsPackage = (
    pkgRoot: string,
    spec: TestPkgSpec
  ): { readonly bindingsPath: string; readonly metadataPath: string } => {
    const distRoot = join(pkgRoot, "dist", "tsonic", "bindings");
    mkdirSync(distRoot, { recursive: true });

    // Facade stub - must exist so Node resolution can locate it via exports.
    writeText(join(distRoot, `${spec.namespaceKey}.js`), "export {};\n");
    writeText(join(distRoot, `${spec.namespaceKey}.d.ts`), "export type __test = 1;\n");

    const nsDir = join(distRoot, spec.namespaceKey);
    const internalDir = join(nsDir, "internal");
    mkdirSync(internalDir, { recursive: true });

    const bindingsPath = join(nsDir, "bindings.json");
    writeJson(bindingsPath, {
      namespace: spec.namespace,
      types: [{ assemblyName: spec.assemblyName }],
    });

    const metadataPath = join(internalDir, "metadata.json");
    writeJson(metadataPath, {});

    return { bindingsPath, metadataPath };
  };

  it("resolves CLR bindings from a scoped package using npm exports (dist layout)", () => {
    const workspaceRoot = createWorkspaceRoot();

    const spec: TestPkgSpec = {
      packageName: "@acme/domain",
      namespaceKey: "System.Linq",
      namespace: "System.Linq",
      assemblyName: "Acme.Domain",
    };

    const pkgRoot = createScopedPackageRoot(workspaceRoot, spec.packageName);
    mkdirSync(pkgRoot, { recursive: true });
    writeJson(join(pkgRoot, "package.json"), {
      name: spec.packageName,
      private: true,
      type: "module",
      exports: {
        "./package.json": "./package.json",
        "./*.js": {
          types: "./dist/tsonic/bindings/*.d.ts",
          default: "./dist/tsonic/bindings/*.js",
        },
      },
    });

    const { bindingsPath, metadataPath } = writeDistBindingsPackage(pkgRoot, spec);

    const resolver = createClrBindingsResolver(workspaceRoot);

    const direct = resolver.resolve(`${spec.packageName}/${spec.namespaceKey}.js`);
    expect(direct.isClr).to.equal(true);
    if (!direct.isClr) return;
    expect(direct.resolvedNamespace).to.equal(spec.namespace);
    expect(direct.bindingsPath).to.equal(bindingsPath);
    expect(direct.metadataPath).to.equal(metadataPath);
    expect(direct.assembly).to.equal(spec.assemblyName);

    // Deep subpaths should still resolve to the namespace bindings.
    const deep = resolver.resolve(
      `${spec.packageName}/${spec.namespaceKey}/internal/index.js`
    );
    expect(deep.isClr).to.equal(true);
    if (!deep.isClr) return;
    expect(deep.bindingsPath).to.equal(bindingsPath);
    expect(deep.resolvedNamespace).to.equal(spec.namespace);
  });

  it("resolves CLR bindings from an unscoped package using npm exports (dist layout)", () => {
    const workspaceRoot = createWorkspaceRoot();

    const spec: TestPkgSpec = {
      packageName: "acme-domain",
      namespaceKey: "Acme.Domain.Models.Users",
      namespace: "Acme.Domain.Models.Users",
      assemblyName: "Acme.Domain",
    };

    const pkgRoot = createUnscopedPackageRoot(workspaceRoot, spec.packageName);
    mkdirSync(pkgRoot, { recursive: true });
    writeJson(join(pkgRoot, "package.json"), {
      name: spec.packageName,
      private: true,
      type: "module",
      exports: {
        "./package.json": "./package.json",
        "./*.js": {
          types: "./dist/tsonic/bindings/*.d.ts",
          default: "./dist/tsonic/bindings/*.js",
        },
      },
    });

    const { bindingsPath } = writeDistBindingsPackage(pkgRoot, spec);
    const resolver = createClrBindingsResolver(workspaceRoot);

    const result = resolver.resolve(`${spec.packageName}/${spec.namespaceKey}.js`);
    expect(result.isClr).to.equal(true);
    if (!result.isClr) return;
    expect(result.bindingsPath).to.equal(bindingsPath);
    expect(result.resolvedNamespace).to.equal(spec.namespace);
    expect(result.assembly).to.equal(spec.assemblyName);
  });

  it("keeps legacy bindings discovery working when no facade stub is resolvable", () => {
    const workspaceRoot = createWorkspaceRoot();

    const packageName = "legacy-bindings";
    const namespaceKey = "System.Text";
    const pkgRoot = createUnscopedPackageRoot(workspaceRoot, packageName);
    mkdirSync(pkgRoot, { recursive: true });
    writeJson(join(pkgRoot, "package.json"), {
      name: packageName,
      private: true,
      type: "module",
    });

    const nsDir = join(pkgRoot, namespaceKey);
    mkdirSync(join(nsDir, "internal"), { recursive: true });
    const bindingsPath = join(nsDir, "bindings.json");
    writeJson(bindingsPath, {
      namespace: "System.Text",
      types: [{ assemblyName: "System.Text.Encoding" }],
    });

    // No "System.Text.js" exists: exports-aware resolution fails, legacy discovery must succeed.
    const resolver = createClrBindingsResolver(workspaceRoot);
    const result = resolver.resolve(`${packageName}/${namespaceKey}.js`);
    expect(result.isClr).to.equal(true);
    if (!result.isClr) return;
    expect(result.bindingsPath).to.equal(bindingsPath);
    expect(result.resolvedNamespace).to.equal("System.Text");
  });
});
