import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";

describe("Dependency Graph", function () {
  this.timeout(60_000);
  it("should traverse imports from installed tsonic source packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-source-package-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { clamp } from "@acme/math";\nexport const value = clamp(10, 0, 5);\n'
      );

      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      const packageHelper = path.join(packageRoot, "src", "helpers.ts");
      fs.writeFileSync(
        packageHelper,
        "export const clampMin = (x: number, min: number): number => x < min ? min : x;\n"
      );
      const packageEntry = path.join(packageRoot, "src", "index.ts");
      fs.writeFileSync(
        packageEntry,
        [
          'import { clampMin } from "./helpers.ts";',
          "export function clamp(x: number, min: number, max: number): number {",
          "  const lower = clampMin(x, min);",
          "  return lower > max ? max : lower;",
          "}",
        ].join("\n")
      );

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
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should traverse source-package redirects behind module bindings", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-module-redirect-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { createServer } from "node:http";\nexport const value = createServer();\n'
      );

      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src", "http"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./http.js": "./src/http/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:http": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.Http.http",
                sourceImport: "@tsonic/nodejs/http.js",
              },
            },
          },
          null,
          2
        )
      );
      const packageHelper = path.join(packageRoot, "src", "http", "helper.ts");
      fs.writeFileSync(
        packageHelper,
        "export const createValue = (): number => 42;\n"
      );
      const packageEntry = path.join(packageRoot, "src", "http", "index.ts");
      fs.writeFileSync(
        packageEntry,
        [
          'import { createValue } from "./helper.ts";',
          "export const createServer = (): number => createValue();",
        ].join("\n")
      );

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
        (module) => module.filePath === "node_modules/@tsonic/nodejs/src/http/index.ts"
      );
      const packageHelperModule = result.value.modules.find(
        (module) => module.filePath === "node_modules/@tsonic/nodejs/src/http/helper.ts"
      );
      expect(packageEntryModule?.namespace).to.equal("nodejs.Http");
      expect(packageEntryModule?.className).to.equal("http");
      expect(packageHelperModule?.namespace).to.equal("nodejs.Http");
      expect(packageHelperModule?.className).to.equal("helper");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("uses the shared module-binding namespace root for source-package root entrypoints", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-root-entry-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { EventEmitter } from "@tsonic/nodejs/index.js";\nexport const value = new EventEmitter();\n'
      );

      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
                "./events.js": "./src/events-module.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:events": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.events",
                sourceImport: "@tsonic/nodejs/events.js",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "index.ts"),
        'export { EventEmitter } from "./events-module.ts";\n'
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "events-module.ts"),
        "export class EventEmitter {}\n"
      );

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
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("nests sibling files under the module namespace when an index export would otherwise collide", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-index-sibling-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { Buffer } from "node:buffer";\nexport const value = Buffer;\n'
      );

      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src", "buffer"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./buffer.js": "./src/buffer/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:buffer": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.buffer",
                sourceImport: "@tsonic/nodejs/buffer.js",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "buffer", "index.ts"),
        'export { Buffer } from "./buffer.ts";\n'
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "buffer", "buffer.ts"),
        "export class Buffer {}\n"
      );

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

      expect(entryModule?.namespace).to.equal("nodejs");
      expect(entryModule?.className).to.equal("buffer");
      expect(bufferModule?.namespace).to.equal("nodejs.Buffer");
      expect(bufferModule?.className).to.equal("buffer");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps non-index source-package entry class names for module-bound redirects", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-module-file-redirect-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { process } from "node:process";\nexport const value = process.version;\n'
      );

      const packageRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic", "package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./process.js": "./src/process-module.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:process": {
                kind: "module",
                assembly: "nodejs",
                type: "nodejs.process",
                sourceImport: "@tsonic/nodejs/process.js",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "process-module.ts"),
        'export const process = { version: "v1.0.0" };\n'
      );

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
          module.filePath === "node_modules/@tsonic/nodejs/src/process-module.ts"
      );
      expect(processModule?.namespace).to.equal("nodejs");
      expect(processModule?.className).to.equal("ProcessModule");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should expose type-like simple bindings to the emitter graph", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-simple-bindings-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          "const cb: (err: Error | undefined) => void = (_err) => {};",
          "cb(undefined);",
          "export const ok = true;",
        ].join("\n")
      );

      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.bindings.get("Error")?.name).to.equal(
        "Tsonic.JSRuntime.Error"
      );
      expect(JSON.stringify(result.value.modules)).to.include(
        '"clrName":"Tsonic.JSRuntime.Error"'
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should traverse awaited relative dynamic-import side effects", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-dynamic-import-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(path.join(srcDir, "nested"), { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      const importedPath = path.join(srcDir, "nested", "module.ts");

      fs.writeFileSync(
        entryPath,
        [
          "async function load(): Promise<void> {",
          '  await import("./nested/module.js");',
          "}",
          "void load();",
        ].join("\n")
      );
      fs.writeFileSync(importedPath, "export const loaded = true;\n");

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
          (module) =>
            module.filePath ===
            path.relative(srcDir, path.resolve(importedPath))
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should traverse value-consuming closed-world dynamic imports", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dependency-graph-dynamic-import-value-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(path.join(srcDir, "nested"), { recursive: true });
      const entryPath = path.join(srcDir, "index.ts");
      const importedPath = path.join(srcDir, "nested", "module.ts");

      fs.writeFileSync(
        entryPath,
        [
          "async function load(): Promise<number> {",
          '  const module = await import("./nested/module.js");',
          "  return module.value;",
          "}",
          "void load();",
        ].join("\n")
      );
      fs.writeFileSync(importedPath, "export const value = 42;\n");

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
          (module) =>
            module.filePath ===
            path.relative(srcDir, path.resolve(importedPath))
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
