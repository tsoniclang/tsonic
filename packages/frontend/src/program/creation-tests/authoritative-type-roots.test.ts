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
      fs.mkdirSync(projectNodejsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(projectNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "9.9.9",
            type: "module",
            types: "./index.d.ts",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.js"),
        "export {};\n"
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.d.ts"),
        [
          '/// <reference path="./node-aliases.d.ts" />',
          "export declare const path: {",
          "  join(...parts: string[]): any;",
          "};",
          "export declare const process: {",
          "  cwd(): any;",
          "};",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "node-aliases.d.ts"),
        [
          'declare module "node:path" {',
          '  export { path } from "@tsonic/nodejs/index.js";',
          '  export const join: typeof import("@tsonic/nodejs/index.js").path.join;',
          "}",
          'declare module "node:process" {',
          '  export { process } from "@tsonic/nodejs/index.js";',
          '  export const cwd: typeof import("@tsonic/nodejs/index.js").process.cwd;',
          "}",
          "export {};",
        ].join("\n")
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
      fs.mkdirSync(projectNodejsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(projectNodejsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/nodejs",
            version: "9.9.9",
            type: "module",
            types: "./index.d.ts",
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.js"),
        "export {};\n"
      );
      fs.writeFileSync(
        path.join(projectNodejsRoot, "index.d.ts"),
        [
          "export declare const path: {",
          "  join(...parts: string[]): any;",
          "};",
          "export declare const process: {",
          "  cwd(): any;",
          "};",
        ].join("\n")
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        [
          'import { path, process } from "@tsonic/nodejs/index.js";',
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
});
