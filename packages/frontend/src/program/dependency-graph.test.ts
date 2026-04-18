import { describe, it } from "mocha";
import { expect } from "chai";
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

  it("should traverse awaited relative dynamic-import side effects", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/dynamic-import-side-effects",
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
          (module) => module.filePath === "nested/module.ts"
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should traverse value-consuming closed-world dynamic imports", () => {
    const fixture = materializeFrontendFixture([
      "fragments/minimal-surfaces/tsonic-js",
      "program/dependency-graph/dynamic-import-value",
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
          (module) => module.filePath === "nested/module.ts"
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });
});
