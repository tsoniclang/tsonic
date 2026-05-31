import { describe, it, afterEach } from "mocha";
import { expect } from "chai";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExternalBindingsResolver } from "./external-bindings-resolver.js";

type TestPkgSpec = {
  readonly packageName: string;
  readonly namespaceKey: string;
  readonly namespace: string;
  readonly ownerIdentity: string;
};

const writeJson = (filePath: string, value: unknown) => {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const writeText = (filePath: string, value: string) => {
  writeFileSync(filePath, value);
};

describe("ExternalBindingsResolver (npm exports + dist bindings)", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const createWorkspaceRoot = (): string => {
    const root = join(
      tmpdir(),
      `tsonic-external-bindings-resolver-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
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
    if (!match)
      throw new Error(`Expected scoped package name, got: ${packageName}`);
    const scope = match[1];
    const name = match[2];
    if (!scope || !name)
      throw new Error(`Invalid scoped package name: ${packageName}`);
    return join(workspaceRoot, "node_modules", `@${scope}`, name);
  };

  const createUnscopedPackageRoot = (
    workspaceRoot: string,
    packageName: string
  ): string => join(workspaceRoot, "node_modules", packageName);

  const writeDistBindingsPackage = (
    pkgRoot: string,
    spec: TestPkgSpec
  ): { readonly bindingsPath: string } => {
    const distRoot = join(pkgRoot, "dist", "tsonic", "bindings");
    mkdirSync(distRoot, { recursive: true });

    // Facade stub - must exist so Node resolution can locate it via exports.
    writeText(join(distRoot, `${spec.namespaceKey}.js`), "export {};\n");
    writeText(
      join(distRoot, `${spec.namespaceKey}.d.ts`),
      "export type __test = 1;\n"
    );

    const nsDir = join(distRoot, spec.namespaceKey);
    const internalDir = join(nsDir, "internal");
    mkdirSync(internalDir, { recursive: true });

    const bindingsPath = join(nsDir, "bindings.json");
    writeJson(bindingsPath, { schema: "tsonic.bindings", provider: { namespace: spec.namespace }, targetSurface: { types: [{ ownerIdentity: spec.ownerIdentity }] } });
    return { bindingsPath };
  };

  it("resolves external bindings from a scoped package using npm exports (dist layout)", () => {
    const workspaceRoot = createWorkspaceRoot();

    const spec: TestPkgSpec = {
      packageName: "@acme/domain",
      namespaceKey: "System.Linq",
      namespace: "System.Linq",
      ownerIdentity: "Acme.Domain",
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

    const { bindingsPath } = writeDistBindingsPackage(pkgRoot, spec);

    const resolver = createExternalBindingsResolver(workspaceRoot);

    const direct = resolver.resolve(
      `${spec.packageName}/${spec.namespaceKey}.js`
    );
    expect(direct.kind).to.equal("externalSurface");
    if (direct.kind !== "externalSurface") return;
    expect(direct.resolvedNamespace).to.equal(spec.namespace);
    expect(direct.bindingsPath).to.equal(bindingsPath);
    expect(direct.ownerIdentity).to.equal(spec.ownerIdentity);

    // Deep subpaths should still resolve to the namespace bindings.
    const deep = resolver.resolve(
      `${spec.packageName}/${spec.namespaceKey}/internal/index.js`
    );
    expect(deep.kind).to.equal("externalSurface");
    if (deep.kind !== "externalSurface") return;
    expect(deep.bindingsPath).to.equal(bindingsPath);
    expect(deep.resolvedNamespace).to.equal(spec.namespace);
  });

  it("resolves external bindings from an unscoped package using npm exports (dist layout)", () => {
    const workspaceRoot = createWorkspaceRoot();

    const spec: TestPkgSpec = {
      packageName: "acme-domain",
      namespaceKey: "Acme.Domain.Models.Users",
      namespace: "Acme.Domain.Models.Users",
      ownerIdentity: "Acme.Domain",
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
    const resolver = createExternalBindingsResolver(workspaceRoot);

    const result = resolver.resolve(
      `${spec.packageName}/${spec.namespaceKey}.js`
    );
    expect(result.kind).to.equal("externalSurface");
    if (result.kind !== "externalSurface") return;
    expect(result.bindingsPath).to.equal(bindingsPath);
    expect(result.resolvedNamespace).to.equal(spec.namespace);
    expect(result.ownerIdentity).to.equal(spec.ownerIdentity);
  });

  it("prefers <Namespace>/bindings.json over a root bindings.json when resolving a namespace facade", () => {
    const workspaceRoot = createWorkspaceRoot();

    // Emulates packages like `xunit-types` that ship:
    // - a root bindings.json for the empty namespace ("")
    // - a namespace-specific bindings.json for `Xunit`
    // - a root facade stub `Xunit.js`
    const packageName = "xunit-types";
    const namespaceKey = "Xunit";
    const pkgRoot = createUnscopedPackageRoot(workspaceRoot, packageName);
    mkdirSync(pkgRoot, { recursive: true });
    writeJson(join(pkgRoot, "package.json"), {
      name: packageName,
      private: true,
      type: "module",
    });

    // Facade stub at package root
    writeText(join(pkgRoot, `${namespaceKey}.js`), "export {};\n");
    writeText(
      join(pkgRoot, `${namespaceKey}.d.ts`),
      "export type __test = 1;\n"
    );

    // Root bindings.json (empty namespace)
    writeJson(join(pkgRoot, "bindings.json"), { schema: "tsonic.bindings", provider: { namespace: "" }, targetSurface: { types: [{ ownerIdentity: "xunit.execution.dotnet" }] } });

    // Namespace bindings.json
    const nsDir = join(pkgRoot, namespaceKey);
    mkdirSync(join(nsDir, "internal"), { recursive: true });
    const nsBindingsPath = join(nsDir, "bindings.json");
    writeJson(nsBindingsPath, { schema: "tsonic.bindings", provider: { namespace: namespaceKey }, targetSurface: { types: [{ ownerIdentity: "xunit.core" }] } });

    const resolver = createExternalBindingsResolver(workspaceRoot);
    const result = resolver.resolve(`${packageName}/${namespaceKey}.js`);
    expect(result.kind).to.equal("externalSurface");
    if (result.kind !== "externalSurface") return;
    expect(result.bindingsPath).to.equal(nsBindingsPath);
    expect(result.resolvedNamespace).to.equal(namespaceKey);
    expect(result.ownerIdentity).to.equal("xunit.core");
  });
});
