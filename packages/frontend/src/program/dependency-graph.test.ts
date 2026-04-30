import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

const hasNonEmptyObjectTypeMetadata = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const inferredType = record.inferredType;
  if (
    inferredType &&
    typeof inferredType === "object" &&
    (inferredType as { kind?: string }).kind === "objectType"
  ) {
    const members = (inferredType as { members?: unknown[] }).members;
    if (Array.isArray(members) && members.length > 0) {
      return true;
    }
  }

  const contextualType = record.contextualType;
  if (
    contextualType &&
    typeof contextualType === "object" &&
    (contextualType as { kind?: string }).kind === "objectType"
  ) {
    const members = (contextualType as { members?: unknown[] }).members;
    if (Array.isArray(members) && members.length > 0) {
      return true;
    }
  }

  return Object.values(record).some((entry) =>
    hasNonEmptyObjectTypeMetadata(entry)
  );
};

describe("Dependency Graph", function () {
  this.timeout(60_000);
  it("dedupes source-package roots by package identity during ambient discovery", () => {
    const fixture = materializeFrontendFixture(
      "program/program-input-discovery/rootdir-external"
    );

    try {
      const projectRoot = fixture.path("workspace/app");
      const sourceRoot = fixture.path("workspace/app/src");
      const entryPath = path.join(sourceRoot, "index.ts");
      const installedJsRoot = fixture.path(
        "workspace/app/node_modules/@tsonic/js"
      );
      const siblingJsRoot = fixture.path("workspace/js/versions/10");
      const nodeRoot = fixture.path(
        "workspace/app/node_modules/@tsonic/nodejs"
      );

      fs.mkdirSync(sourceRoot, { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, "package.json"),
        JSON.stringify({ name: "app", version: "0.0.0", type: "module" })
      );
      fs.writeFileSync(entryPath, "export const app = 1;\n");

      for (const packageRoot of [installedJsRoot, siblingJsRoot]) {
        fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(packageRoot, "package.json"),
          JSON.stringify({
            name: "@tsonic/js",
            version: "10.0.49",
            type: "module",
          })
        );
        fs.writeFileSync(
          path.join(packageRoot, "tsonic.package.json"),
          JSON.stringify({
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "js",
              ambient: ["./globals.ts"],
              exports: { ".": "./src/index.ts" },
            },
          })
        );
        fs.writeFileSync(
          path.join(packageRoot, "globals.ts"),
          [
            "export {};",
            "declare global {",
            "  interface Array<T> {}",
            "  interface Boolean {}",
            "  interface CallableFunction {}",
            "  interface Function {}",
            "  interface IArguments {}",
            "  interface NewableFunction {}",
            "  interface Number {}",
            "  interface Object {}",
            "  interface RegExp {}",
            "  interface String {}",
            "}",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(packageRoot, "src/index.ts"),
          "export const jsPackage = 1;\n"
        );
      }

      fs.mkdirSync(path.join(nodeRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(nodeRoot, "package.json"),
        JSON.stringify({
          name: "@tsonic/nodejs",
          version: "10.0.49",
          type: "module",
        })
      );
      fs.writeFileSync(
        path.join(nodeRoot, "tsonic.package.json"),
        JSON.stringify({
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          source: {
            namespace: "nodejs",
            ambient: ["./globals.ts"],
            exports: { ".": "./src/index.ts" },
          },
        })
      );
      fs.writeFileSync(path.join(nodeRoot, "globals.ts"), "export {};\n");
      fs.writeFileSync(
        path.join(nodeRoot, "src/index.ts"),
        "export const nodePackage = 1;\n"
      );

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot,
        sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [installedJsRoot, nodeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const jsGlobalsModules = result.value.modules.filter(
        (module) =>
          module.namespace === "js._" && module.className === "globals"
      );

      expect(jsGlobalsModules).to.have.length(1);
      expect(jsGlobalsModules[0]?.filePath).to.equal(
        "node_modules/@tsonic/js/globals.ts"
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should traverse imports from installed tsonic source packages", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/installed-source-package",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.modules.some(
          (module) => module.filePath === "node_modules/@acme/math/src/index.ts"
        )
      ).to.equal(true);
      expect(
        result.value.modules.some(
          (module) =>
            module.filePath === "node_modules/@acme/math/src/helpers.ts"
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("reports invalid native source package metadata as TSN1004 diagnostics", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/invalid-source-package",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@acme/math");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(false);
      if (result.ok) return;

      expect(result.error.some((diag) => diag.code === "TSN1004")).to.equal(
        true
      );
      expect(
        result.error.some(
          (diag) =>
            diag.message ===
            `Invalid source package manifest: ${path.join(packageRoot, "tsonic.package.json")}`
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps post-refresh anonymous array element carriers lowered in final IR", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/refresh-lowering",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(hasNonEmptyObjectTypeMetadata(result.value.modules)).to.equal(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should traverse source-package modules behind declaration aliases", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/module-redirect",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@tsonic/nodejs");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [packageRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.modules.some(
          (module) =>
            module.filePath === "node_modules/@tsonic/nodejs/src/http/index.ts"
        )
      ).to.equal(true);
      expect(
        result.value.modules.some(
          (module) =>
            module.filePath === "node_modules/@tsonic/nodejs/src/http/helper.ts"
        )
      ).to.equal(true);
      const packageEntryModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@tsonic/nodejs/src/http/index.ts"
      );
      const packageHelperModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@tsonic/nodejs/src/http/helper.ts"
      );
      expect(packageEntryModule?.namespace).to.equal("nodejs.http");
      expect(packageEntryModule?.className).to.equal("index");
      expect(packageHelperModule?.namespace).to.equal("nodejs.http");
      expect(packageHelperModule?.className).to.equal("helper");
    } finally {
      fixture.cleanup();
    }
  });

  it("should traverse source-package redirects behind global bindings", () => {
    const fixture = materializeFrontendFixture(
      "program/dependency-graph/global-redirect"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const packageEntryModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@fixture/js/src/console.ts"
      );
      const packageHelperModule = result.value.modules.find(
        (module) => module.filePath === "node_modules/@fixture/js/src/helper.ts"
      );

      expect(packageEntryModule).to.not.equal(undefined);
      expect(packageHelperModule).to.not.equal(undefined);
      expect(packageEntryModule?.namespace).to.equal("Fixture.Js");
      expect(packageEntryModule?.className).to.equal("console");
      expect(packageHelperModule?.namespace).to.equal("Fixture.Js");
      expect(packageHelperModule?.className).to.equal("helper");
    } finally {
      fixture.cleanup();
    }
  });

  it("should traverse symlinked source-package redirects behind global ambient declarations", () => {
    const fixture = materializeFrontendFixture(
      "program/dependency-graph/global-redirect-symlink"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const packageEntryModule = result.value.modules.find(
        (module) =>
          module.className === "console" && module.namespace === "Fixture.Js"
      );
      const packageHelperModule = result.value.modules.find(
        (module) =>
          module.className === "helper" && module.namespace === "Fixture.Js"
      );

      expect(packageEntryModule).to.not.equal(undefined);
      expect(packageHelperModule).to.not.equal(undefined);
      expect(packageEntryModule?.namespace).to.equal("Fixture.Js");
      expect(packageHelperModule?.namespace).to.equal("Fixture.Js");
    } finally {
      fixture.cleanup();
    }
  });

  it("uses the shared module-binding namespace root for source-package root entrypoints", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/root-entrypoint",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@tsonic/nodejs");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [packageRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const indexModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@tsonic/nodejs/src/index.ts"
      );
      const eventsModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@tsonic/nodejs/src/events-module.ts"
      );

      expect(indexModule?.namespace).to.equal("nodejs");
      expect(indexModule?.className).to.equal("index");
      expect(eventsModule?.namespace).to.equal("nodejs");
      expect(eventsModule?.className).to.equal("EventsModule");
    } finally {
      fixture.cleanup();
    }
  });

  it("nests sibling files under the module namespace when an index export would otherwise collide", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/index-sibling",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@tsonic/nodejs");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [packageRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const entryModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@tsonic/nodejs/src/buffer/index.ts"
      );
      const bufferModule = result.value.modules.find(
        (module) =>
          module.filePath === "node_modules/@tsonic/nodejs/src/buffer/buffer.ts"
      );

      expect(entryModule?.namespace).to.equal("nodejs.buffer");
      expect(entryModule?.className).to.equal("index");
      expect(bufferModule?.namespace).to.equal("nodejs.buffer");
      expect(bufferModule?.className).to.equal("buffer");
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps non-index source-package entry class names for module-bound redirects", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/module-file-redirect",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@tsonic/nodejs");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [packageRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const processModule = result.value.modules.find(
        (module) =>
          module.filePath ===
          "node_modules/@tsonic/nodejs/src/process-module.ts"
      );
      expect(processModule?.namespace).to.equal("nodejs");
      expect(processModule?.className).to.equal("ProcessModule");
    } finally {
      fixture.cleanup();
    }
  });

  it("uses the builtin Error type when native packages publish no simple global bindings", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/builtin-error",
    ]);

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const seen = new WeakSet<object>();
      expect(
        JSON.stringify(result.value.modules, (_key, value) => {
          if (typeof value === "bigint") {
            return value.toString();
          }
          if (value && typeof value === "object") {
            if (seen.has(value as object)) {
              return "[Circular]";
            }
            seen.add(value as object);
          }
          return value;
        })
      ).to.include('"name":"Error"');
    } finally {
      fixture.cleanup();
    }
  });

});
