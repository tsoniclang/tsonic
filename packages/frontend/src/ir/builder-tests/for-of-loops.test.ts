/**
 * IR Builder tests: For-of loop conversion and iterable threading
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import {
  IrFunctionDeclaration,
} from "../types.js";
import {
  createTestProgram,
  createProgram,
  createProgramContext,
  unwrapTransparentExpression,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("For-Await Loop Conversion", () => {
    it("should set isAwait=true for 'for await' loop", () => {
      const source = `
        async function process(items: AsyncIterable<string>): Promise<void> {
          for await (const item of items) {
            console.log(item);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const func = result.value.body[0];
        if (func?.kind !== "functionDeclaration") {
          throw new Error("Expected function declaration");
        }
        const forAwaitStmt = func.body.statements[0];
        if (forAwaitStmt?.kind !== "forOfStatement") {
          throw new Error("Expected forOfStatement");
        }
        expect(forAwaitStmt.isAwait).to.equal(true);
      }
    });

    it("should set isAwait=false for regular 'for of' loop", () => {
      const source = `
        function process(items: string[]): void {
          for (const item of items) {
            console.log(item);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const func = result.value.body[0];
        if (func?.kind !== "functionDeclaration") {
          throw new Error("Expected function declaration");
        }
        const forOfStmt = func.body.statements[0];
        if (forOfStmt?.kind !== "forOfStatement") {
          throw new Error("Expected forOfStatement");
        }
        expect(forOfStmt.isAwait).to.equal(false);
      }
    });

    it("should keep isAwait=false for regular 'for of' inside async functions", () => {
      const source = `
        async function process(items: string[]): Promise<void> {
          for (const item of items) {
            console.log(item);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const func = result.value.body[0];
        if (func?.kind !== "functionDeclaration") {
          throw new Error("Expected function declaration");
        }
        const forOfStmt = func.body.statements[0];
        if (forOfStmt?.kind !== "forOfStatement") {
          throw new Error("Expected forOfStatement");
        }
        expect(forOfStmt.isAwait).to.equal(false);
      }
    });

    it("threads Map entry tuple element types into for-of bodies", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-for-of-map-entries-")
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
            "export function process(menuBuilders: Map<string, string[]>): void {",
            "  for (const [menuName, builders] of menuBuilders) {",
            "    const first = builders[0];",
            "    console.log(menuName, first);",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "process"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const loop = fn.body.statements[0];
        expect(loop?.kind).to.equal("forOfStatement");
        if (!loop || loop.kind !== "forOfStatement") return;

        expect(loop.variable.kind).to.equal("arrayPattern");
        if (loop.variable.kind !== "arrayPattern") return;

        const tupleElements = loop.variable.elements;
        expect(tupleElements[0]?.pattern).to.deep.equal({
          kind: "identifierPattern",
          name: "menuName",
        });
        expect(tupleElements[1]?.pattern).to.deep.equal({
          kind: "identifierPattern",
          name: "builders",
        });

        const loopBody = loop.body;
        expect(loopBody.kind).to.equal("blockStatement");
        if (loopBody.kind !== "blockStatement") return;

        const firstDecl = loopBody.statements[0];
        expect(firstDecl?.kind).to.equal("variableDeclaration");
        if (!firstDecl || firstDecl.kind !== "variableDeclaration") return;

        const initializer = firstDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("memberAccess");
        if (!initializer || initializer.kind !== "memberAccess") return;

        const narrowedObject = unwrapTransparentExpression(initializer.object);
        expect(narrowedObject?.kind).to.equal("identifier");
        if (!narrowedObject || narrowedObject.kind !== "identifier") return;

        expect(narrowedObject.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });
        expect(initializer.accessKind).to.equal("clrIndexer");
        expect(initializer.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads Iterable<T> element types from values() into for-of bodies", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-for-of-iterable-values-")
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
            "export function process(menus: Map<string, string[]>): void {",
            "  for (const entries of menus.values()) {",
            "    const first = entries[0];",
            "    console.log(first);",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "process"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const loop = fn.body.statements[0];
        expect(loop?.kind).to.equal("forOfStatement");
        if (!loop || loop.kind !== "forOfStatement") return;

        expect(loop.variable).to.deep.equal({
          kind: "identifierPattern",
          name: "entries",
        });

        const loopBody = loop.body;
        expect(loopBody.kind).to.equal("blockStatement");
        if (loopBody.kind !== "blockStatement") return;

        const firstDecl = loopBody.statements[0];
        expect(firstDecl?.kind).to.equal("variableDeclaration");
        if (!firstDecl || firstDecl.kind !== "variableDeclaration") return;

        const initializer = firstDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("memberAccess");
        if (!initializer || initializer.kind !== "memberAccess") return;

        const narrowedObject = unwrapTransparentExpression(initializer.object);
        expect(narrowedObject?.kind).to.equal("identifier");
        if (!narrowedObject || narrowedObject.kind !== "identifier") return;

        expect(narrowedObject.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });
        expect(initializer.accessKind).to.equal("clrIndexer");
        expect(initializer.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
