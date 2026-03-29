/**
 * Tests for authoritative typeRoot resolution: @tsonic module type queries
 * and direct @tsonic imports resolved through authoritative package graph
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import { createProgram } from "../creation.js";

describe("Program Creation – authoritative type roots", function () {
  this.timeout(90_000);

  it("should keep @tsonic module type queries on the authoritative typeRoot package graph", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-node-authoritative-")
    );

    try {
      const authoritativeRoot = path.resolve(
        process.cwd(),
        "../../../nodejs/versions/10"
      );
      expect(
        fs.existsSync(path.join(authoritativeRoot, "package.json"))
      ).to.equal(true);

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

      const projectNodejsRoot = path.join(
        tempDir,
        "node_modules/@tsonic/nodejs"
      );
      fs.mkdirSync(path.join(projectNodejsRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(projectNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "9.9.9",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "fake.nodejs",
              moduleAliases: {
                "node:path": "./path.js",
                "node:process": "./process.js",
              },
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
                "./path.js": "./src/path.ts",
                "./process.js": "./src/process.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "src", "index.ts"),
        [
          'export * as path from "./path.ts";',
          'export * as process from "./process.ts";',
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "src", "path.ts"),
        "export const join = (..._parts: string[]): boolean => false;\n"
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "src", "process.ts"),
        "export const cwd = (): boolean => false;\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import * as path from "node:path";',
          'import * as process from "node:process";',
          'export const joined = path.join("a", "b");',
          "export const cwd = process.cwd();",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.program.getSourceFile(entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const checker = result.value.program.getTypeChecker();
      const returnTypes = new Map<string, string>();
      const declarationFlags = new Map<string, boolean>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression)
        ) {
          const callee = node.expression.getText(sourceFile);
          if (callee === "path.join" || callee === "process.cwd") {
            const signature = checker.getResolvedSignature(node);
            returnTypes.set(
              callee,
              checker.typeToString(checker.getTypeAtLocation(node))
            );
            declarationFlags.set(callee, signature?.declaration !== undefined);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(returnTypes.get("path.join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");
      expect(declarationFlags.get("path.join")).to.equal(true);
      expect(declarationFlags.get("process.cwd")).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should keep direct @tsonic imports on the authoritative package graph", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-direct-authoritative-")
    );

    try {
      const authoritativeRoot = path.resolve(
        process.cwd(),
        "../../../nodejs/versions/10"
      );
      expect(
        fs.existsSync(path.join(authoritativeRoot, "package.json"))
      ).to.equal(true);

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

      const projectNodejsRoot = path.join(
        tempDir,
        "node_modules/@tsonic/nodejs"
      );
      fs.mkdirSync(path.join(projectNodejsRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(projectNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "9.9.9",
            type: "module",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "fake.nodejs",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "src", "index.ts"),
        [
          "export const join = (..._parts: string[]): boolean => false;",
          "export const process = {",
          "  cwd: (): boolean => false,",
          "};",
        ].join("\n")
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import { join, process } from "@tsonic/nodejs/index.js";',
          'export const joined = join("a", "b");',
          "export const cwd = process.cwd();",
        ].join("\n")
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.program.getSourceFile(entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const checker = result.value.program.getTypeChecker();
      const returnTypes = new Map<string, string>();
      const declarationFlags = new Map<string, boolean>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          (ts.isIdentifier(node.expression) ||
            ts.isPropertyAccessExpression(node.expression))
        ) {
          const callee = node.expression.getText(sourceFile);
          if (callee === "join" || callee === "process.cwd") {
            const signature = checker.getResolvedSignature(node);
            returnTypes.set(
              callee,
              checker.typeToString(checker.getTypeAtLocation(node))
            );
            declarationFlags.set(callee, signature?.declaration !== undefined);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(returnTypes.get("join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");
      expect(declarationFlags.get("join")).to.equal(true);
      expect(declarationFlags.get("process.cwd")).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
