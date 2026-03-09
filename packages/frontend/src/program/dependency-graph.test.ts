import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";

describe("Dependency Graph", () => {
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
          (module) =>
            module.filePath ===
            path.relative(srcDir, path.resolve(packageEntry))
        )
      ).to.equal(true);
      expect(
        result.value.modules.some(
          (module) =>
            module.filePath ===
            path.relative(srcDir, path.resolve(packageHelper))
        )
      ).to.equal(true);
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
