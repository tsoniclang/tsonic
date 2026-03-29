import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import type { IrModule } from "../ir/types.js";

const repoRoot = path.resolve(process.cwd(), "../..");
const fixtureRoot = (name: string): string =>
  path.join(repoRoot, "test", "fixtures", name);
const fixturePackageRoot = (name: string): string =>
  path.join(fixtureRoot(name), "packages", name);
const fixtureSourceRoot = (name: string): string =>
  path.join(fixturePackageRoot(name), "src");
const fixtureEntryPath = (name: string): string =>
  path.join(fixtureSourceRoot(name), "index.ts");
const normalizeSlashes = (value: string): string => value.replace(/\\/g, "/");
const findModuleBySuffix = (
  modules: readonly IrModule[],
  suffix: string
): IrModule | undefined =>
  modules.find((module) => normalizeSlashes(module.filePath).endsWith(suffix));
const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined =>
  modules.find(
    (module) => normalizeSlashes(module.filePath) === normalizeSlashes(filePath)
  );

const jsSourceRoot = path.resolve(process.cwd(), "../../../js/versions/10");
const nodejsSourceRoot = path.resolve(process.cwd(), "../../../nodejs/versions/10");
const coreRoot = path.join(repoRoot, "node_modules", "@tsonic", "core");

describe("Fixture fast coverage", function () {
  this.timeout(90_000);

  it("mirrors nodejs-surface-module-graph through the frontend dependency graph", () => {
    expect(fs.existsSync(path.join(nodejsSourceRoot, "package.json"))).to.equal(
      true
    );

    const fixtureName = "nodejs-surface-module-graph";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "NodejsSurfaceModuleGraph",
      surface: "@tsonic/js",
      typeRoots: [nodejsSourceRoot],
    });

    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const localIndex = findModuleByFilePath(result.value.modules, "index.ts");
    const localPathing = findModuleByFilePath(result.value.modules, "pathing.ts");
    const localSystemInfo = findModuleByFilePath(
      result.value.modules,
      "system-info.ts"
    );
    const localFileState = findModuleByFilePath(
      result.value.modules,
      "file-state.ts"
    );
    const pathModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/path-module.ts"
    );
    const osModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/os/index.ts"
    );
    const processModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/process-module.ts"
    );
    const fsModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/fs-module.ts"
    );
    const cryptoModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/crypto/index.ts"
    );

    expect(localIndex?.namespace).to.equal("NodejsSurfaceModuleGraph");
    expect(localPathing?.namespace).to.equal("NodejsSurfaceModuleGraph");
    expect(localSystemInfo?.namespace).to.equal("NodejsSurfaceModuleGraph");
    expect(localFileState?.namespace).to.equal("NodejsSurfaceModuleGraph");
    expect(pathModule?.namespace).to.equal("nodejs");
    expect(osModule?.namespace).to.equal("nodejs.os");
    expect(processModule?.namespace).to.equal("nodejs");
    expect(fsModule?.namespace).to.equal("nodejs");
    expect(cryptoModule?.namespace).to.equal("nodejs.crypto");
  });

  it("mirrors nodejs-path-posix-join through source-package subpath graph traversal", () => {
    expect(fs.existsSync(path.join(nodejsSourceRoot, "package.json"))).to.equal(
      true
    );

    const fixtureName = "nodejs-path-posix-join";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "NodejsPathPosixJoin",
      surface: "@tsonic/js",
      typeRoots: [nodejsSourceRoot],
    });

    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const entryModule = findModuleByFilePath(result.value.modules, "index.ts");
    const pathModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/path-module.ts"
    );

    expect(entryModule?.namespace).to.equal("NodejsPathPosixJoin");
    expect(pathModule?.namespace).to.equal("nodejs");
  });

  it("mirrors js-surface-node-aliases through node alias dependency graph", () => {
    expect(fs.existsSync(path.join(nodejsSourceRoot, "package.json"))).to.equal(
      true
    );

    const fixtureName = "js-surface-node-aliases";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "JsSurfaceNodeAliases",
      surface: "@tsonic/js",
      typeRoots: [nodejsSourceRoot],
    });

    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const entryModule = findModuleByFilePath(result.value.modules, "index.ts");
    const pathModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/path-module.ts"
    );
    const fsModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/fs-module.ts"
    );
    const osModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/os/index.ts"
    );
    const processModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/process-module.ts"
    );
    const cryptoModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/crypto/index.ts"
    );

    expect(entryModule?.namespace).to.equal("JsSurfaceNodeAliases");
    expect(pathModule?.namespace).to.equal("nodejs");
    expect(fsModule?.namespace).to.equal("nodejs");
    expect(osModule?.namespace).to.equal("nodejs.os");
    expect(processModule?.namespace).to.equal("nodejs");
    expect(cryptoModule?.namespace).to.equal("nodejs.crypto");
  });

  it("mirrors nodejs-surface-alias-coverage through broad node alias graph traversal", () => {
    expect(fs.existsSync(path.join(nodejsSourceRoot, "package.json"))).to.equal(
      true
    );

    const fixtureName = "nodejs-surface-alias-coverage";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "NodejsSurfaceAliasCoverage",
      surface: "@tsonic/js",
      typeRoots: [nodejsSourceRoot],
    });

    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const entryModule = findModuleByFilePath(result.value.modules, "index.ts");
    const httpModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/http/index.ts"
    );
    const netModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/net/index.ts"
    );
    const urlModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/url/index.ts"
    );
    const timersModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/timers-module.ts"
    );
    const pathModule = findModuleBySuffix(
      result.value.modules,
      "node_modules/@tsonic/nodejs/src/path-module.ts"
    );

    expect(entryModule?.namespace).to.equal("NodejsSurfaceAliasCoverage");
    expect(httpModule?.namespace).to.equal("nodejs.http");
    expect(netModule?.namespace).to.equal("nodejs.net");
    expect(urlModule?.namespace).to.equal("nodejs.url");
    expect(timersModule?.namespace).to.equal("nodejs");
    expect(pathModule?.namespace).to.equal("nodejs");
  });

  it("mirrors source-package-basic through source-package graph traversal", () => {
    const fixtureName = "source-package-basic";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "SourcePackageBasic",
      surface: "@tsonic/js",
    });

    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const entryModule = findModuleByFilePath(result.value.modules, "index.ts");
    const packageIndex = findModuleBySuffix(
      result.value.modules,
      "node_modules/@acme/math/src/index.ts"
    );
    const packageHelpers = findModuleBySuffix(
      result.value.modules,
      "node_modules/@acme/math/src/helpers.ts"
    );

    expect(entryModule?.namespace).to.equal("SourcePackageBasic");
    expect(packageIndex?.namespace).to.equal("acme.math");
    expect(packageHelpers?.namespace).to.equal("acme.math");
  });

  it("mirrors source-package-subpath through explicit subpath graph traversal", () => {
    const fixtureName = "source-package-subpath";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "SourcePackageSubpath",
      surface: "@tsonic/js",
    });

    expect(result.ok).to.equal(true);
    if (!result.ok) return;

    const entryModule = findModuleByFilePath(result.value.modules, "index.ts");
    const packageHelpers = findModuleBySuffix(
      result.value.modules,
      "node_modules/@acme/math/src/helpers.ts"
    );
    const packageIndex = findModuleBySuffix(
      result.value.modules,
      "node_modules/@acme/math/src/index.ts"
    );

    expect(entryModule?.namespace).to.equal("SourcePackageSubpath");
    expect(packageHelpers?.namespace).to.equal("acme.math");
    expect(packageIndex).to.equal(undefined);
  });

  it("mirrors nodejs-surface-imports-negative with exact frontend diagnostics", () => {
    expect(fs.existsSync(path.join(nodejsSourceRoot, "package.json"))).to.equal(
      true
    );

    const fixtureName = "nodejs-surface-imports-negative";
    const result = buildModuleDependencyGraph(fixtureEntryPath(fixtureName), {
      projectRoot: fixtureRoot(fixtureName),
      sourceRoot: fixtureSourceRoot(fixtureName),
      rootNamespace: "NodejsSurfaceImportsNegative",
      surface: "@tsonic/js",
      typeRoots: [nodejsSourceRoot],
    });

    expect(result.ok).to.equal(false);
    if (result.ok) return;

    const rendered = result.error
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
      .join("\n");

    expect(rendered).to.include("TSN2002");
    expect(rendered).to.include(
      'Default import requires an explicit default export: "node:fs"'
    );
  });

  for (const scenario of [
    {
      fixtureName: "parseint-int-narrowing-reject",
      rootNamespace: "ParseintIntNarrowingReject",
    },
    {
      fixtureName: "finite-number-int-narrowing-reject",
      rootNamespace: "FiniteNumberIntNarrowingReject",
    },
  ] as const) {
    it(`mirrors ${scenario.fixtureName} with exact frontend diagnostics`, () => {
      expect(fs.existsSync(path.join(jsSourceRoot, "package.json"))).to.equal(
        true
      );
      expect(fs.existsSync(path.join(coreRoot, "package.json"))).to.equal(true);

      const metaPath = path.join(fixtureRoot(scenario.fixtureName), "e2e.meta.json");
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as {
        readonly expectedErrors?: readonly string[];
      };

      const result = buildModuleDependencyGraph(
        fixtureEntryPath(scenario.fixtureName),
        {
          projectRoot: fixtureRoot(scenario.fixtureName),
          sourceRoot: fixtureSourceRoot(scenario.fixtureName),
          rootNamespace: scenario.rootNamespace,
          surface: "@tsonic/js",
          typeRoots: [jsSourceRoot, coreRoot],
        }
      );

      expect(result.ok).to.equal(false);
      if (result.ok) return;

      const rendered = result.error
        .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
        .join("\n");

      expect(rendered).to.include(meta.expectedErrors?.[0] ?? "TSN5101");

      if (scenario.fixtureName === "parseint-int-narrowing-reject") {
        expect(rendered).to.include("parsed");
        expect(rendered).to.match(
          /Cannot (?:narrow|prove narrowing of) 'parsed'.*Int32/
        );
      } else {
        for (const expected of meta.expectedErrors?.slice(1) ?? []) {
          expect(rendered).to.include(expected);
        }
      }
    });
  }
});
