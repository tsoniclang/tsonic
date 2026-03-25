/**
 * Tests for package resolution: installed subpath exports, tsconfig declarations,
 * and project-local @tsonic imports
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgram } from "../creation.js";

describe("Program Creation – package resolution", function () {
  this.timeout(90_000);

  it("should prefer installed @tsonic source-package subpath exports over sibling compiler packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-installed-tsonic-subpath-")
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

      const nodejsRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.join(nodejsRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(nodejsRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(nodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "10.0.99-test",
            type: "module",
            exports: {
              ".": "./src/index.ts",
              "./index.js": "./src/index.ts",
              "./path.js": "./src/path-module.ts",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./path.js": "./src/path-module.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "src", "index.ts"),
        'export * as path from "./path-module.ts";\n'
      );
      fs.writeFileSync(
        path.join(nodejsRoot, "src", "path-module.ts"),
        [
          "export const join = (...parts: string[]): string => parts.join('/');",
          "export const basename = (value: string): string => value;",
        ].join("\n")
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import * as nodePath from "@tsonic/nodejs/path.js";',
          'export const ok = nodePath.join("alpha", "beta");',
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [path.join(tempDir, "node_modules", "@tsonic", "nodejs")],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.program
          .getSourceFiles()
          .some(
            (sourceFile) =>
              path.resolve(sourceFile.fileName) ===
              path.resolve(path.join(nodejsRoot, "src", "path-module.ts"))
          )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should preserve symlinked source-package paths during program creation", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-symlinked-source-package-")
    );
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-symlinked-source-package-ext-")
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

      const nodejsRoot = path.join(
        tempDir,
        "node_modules",
        "@tsonic",
        "nodejs"
      );
      fs.mkdirSync(path.dirname(nodejsRoot), { recursive: true });

      fs.mkdirSync(path.join(externalRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(externalRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(externalRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "10.0.99-test",
            type: "module",
            exports: {
              ".": "./src/index.ts",
              "./path.js": "./src/path-module.ts",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(externalRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./path.js": "./src/path-module.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(externalRoot, "src", "index.ts"),
        'export * as path from "./path-module.ts";\n'
      );
      fs.writeFileSync(
        path.join(externalRoot, "src", "path-module.ts"),
        'export const join = (...parts: string[]): string => parts.join("/");\n'
      );
      fs.symlinkSync(externalRoot, nodejsRoot, "dir");

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import * as nodePath from "@tsonic/nodejs/path.js";',
          'export const ok = nodePath.join("alpha", "beta");',
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [nodejsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.program
          .getSourceFiles()
          .some(
            (sourceFile) =>
              path.resolve(sourceFile.fileName) ===
              path.resolve(path.join(nodejsRoot, "src", "path-module.ts"))
          )
      ).to.equal(true);
      expect(
        result.value.program
          .getSourceFiles()
          .some(
            (sourceFile) =>
              path.resolve(sourceFile.fileName) ===
              path.resolve(path.join(externalRoot, "src", "path-module.ts"))
          )
      ).to.equal(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }
  });

  it("should include tsconfig declaration roots for local module augmentation", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-tsconfig-decls-")
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

      fs.writeFileSync(
        path.join(tempDir, "tsconfig.json"),
        JSON.stringify(
          {
            include: ["src/**/*.ts", "types/**/*.d.ts"],
          },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      const typesDir = path.join(tempDir, "types");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(typesDir, { recursive: true });

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        path.join(typesDir, "augment.d.ts"),
        [
          "declare global {",
          "  interface Boolean {",
          "    asTag(): string;",
          "  }",
          "}",
          "",
          "export {};",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        entryPath,
        ["export type BoolMethod = Boolean['asTag'];", ""].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should resolve project-local @tsonic/* imports when no authoritative package exists", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-creation-")
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

      const fakePkgRoot = path.join(tempDir, "node_modules/@tsonic/custom");
      fs.mkdirSync(fakePkgRoot, { recursive: true });
      fs.writeFileSync(
        path.join(fakePkgRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/custom", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(fakePkgRoot, "System.d.ts"),
        "export const Marker: unique symbol;\n"
      );
      fs.writeFileSync(
        path.join(fakePkgRoot, "System.js"),
        "export const Marker = Symbol('marker');\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { Marker } from "@tsonic/custom/System.js";\nexport const ok = Marker;\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        useStandardLib: true,
        typeRoots: [],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedDts = path.resolve(path.join(fakePkgRoot, "System.d.ts"));
      expect(result.value.program.getSourceFile(expectedDts)).to.not.equal(
        undefined
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
