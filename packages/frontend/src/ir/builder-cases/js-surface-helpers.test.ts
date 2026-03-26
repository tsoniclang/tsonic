/**
 * IR Builder tests: JS surface helpers - global bindings, regex, spread arrays
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import { createProgram, createProgramContext } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("JS surface helpers", () => {
    it("threads generic surface root global bindings into identifier callees", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-generic-surface-globals-")
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

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(surfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(surfaceRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(surfaceRoot, "index.d.ts"),
          [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "declare global {",
            "  const console: {",
            "    log(...data: unknown[]): void;",
            "  };",
            "  function setInterval(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;",
            "  function clearInterval(id: int): void;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "bindings.json"),
          JSON.stringify(
            {
              bindings: {
                console: {
                  kind: "global",
                  assembly: "js",
                  type: "js.console",
                },
                setInterval: {
                  kind: "global",
                  assembly: "js",
                  type: "js.Timers",
                  csharpName: "Timers.setInterval",
                },
                clearInterval: {
                  kind: "global",
                  assembly: "js",
                  type: "js.Timers",
                  csharpName: "Timers.clearInterval",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            "  const id = setInterval(() => {}, 1000);",
            "  clearInterval(id);",
            '  console.log("tick");',
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
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
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const firstStmt = fn.body.statements[0];
        expect(firstStmt?.kind).to.equal("variableDeclaration");
        if (!firstStmt || firstStmt.kind !== "variableDeclaration") return;

        const setIntervalCall = firstStmt.declarations[0]?.initializer;
        expect(setIntervalCall?.kind).to.equal("call");
        if (!setIntervalCall || setIntervalCall.kind !== "call") return;

        expect(setIntervalCall.callee.kind).to.equal("identifier");
        if (setIntervalCall.callee.kind !== "identifier") return;

        expect(setIntervalCall.callee.name).to.equal("setInterval");
        expect(setIntervalCall.callee.resolvedClrType).to.equal(
          "js.Timers"
        );
        expect(setIntervalCall.callee.resolvedAssembly).to.equal(
          "js"
        );
        expect(setIntervalCall.callee.csharpName).to.equal(
          "Timers.setInterval"
        );

        const clearIntervalStmt = fn.body.statements[1];
        expect(clearIntervalStmt?.kind).to.equal("expressionStatement");
        if (
          !clearIntervalStmt ||
          clearIntervalStmt.kind !== "expressionStatement"
        )
          return;

        const clearIntervalCall = clearIntervalStmt.expression;
        expect(clearIntervalCall.kind).to.equal("call");
        if (clearIntervalCall.kind !== "call") return;
        expect(clearIntervalCall.callee.kind).to.equal("identifier");
        if (clearIntervalCall.callee.kind !== "identifier") return;
        expect(clearIntervalCall.callee.csharpName).to.equal(
          "Timers.clearInterval"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("converts regex literals into RegExp constructor expressions on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-regex-literal-")
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
            "export function isUpper(text: string): boolean {",
            "  return /^[A-Z]+$/i.test(text);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          useStandardLib: false,
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
            stmt.kind === "functionDeclaration" && stmt.name === "isUpper"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const testCall = returnStmt.expression;
        expect(testCall?.kind).to.equal("call");
        if (!testCall || testCall.kind !== "call") return;

        expect(testCall.callee.kind).to.equal("memberAccess");
        if (testCall.callee.kind !== "memberAccess") return;

        const regexCtor = testCall.callee.object;
        expect(regexCtor.kind).to.equal("new");
        if (regexCtor.kind !== "new") return;

        expect(regexCtor.callee.kind).to.equal("identifier");
        if (regexCtor.callee.kind !== "identifier") return;

        expect(regexCtor.callee.name).to.equal("RegExp");
        expect(regexCtor.callee.resolvedClrType).to.equal("js.RegExp");
        expect(regexCtor.arguments).to.deep.equal([
          {
            kind: "literal",
            value: "^[A-Z]+$",
            raw: JSON.stringify("^[A-Z]+$"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[0]?.sourceSpan,
          },
          {
            kind: "literal",
            value: "i",
            raw: JSON.stringify("i"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[1]?.sourceSpan,
          },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves spread-only array element types on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-spread-array-")
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
            "type MenuEntry = { weight: number };",
            "export const sortMenuEntries = (entries: MenuEntry[]): MenuEntry[] => {",
            "  return [...entries].sort((a: MenuEntry, b: MenuEntry) => a.weight - b.weight);",
            "};",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          useStandardLib: false,
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

        const sortDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "sortMenuEntries"
        );
        expect(sortDecl).to.not.equal(undefined);
        if (!sortDecl) return;

        const initializer = sortDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("arrowFunction");
        if (!initializer || initializer.kind !== "arrowFunction") return;
        expect(initializer.body.kind).to.equal("blockStatement");
        if (initializer.body.kind !== "blockStatement") return;

        const returnStmt = initializer.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const sortCall = returnStmt.expression;
        expect(sortCall?.kind).to.equal("call");
        if (!sortCall || sortCall.kind !== "call") return;
        expect(sortCall.callee.kind).to.equal("memberAccess");
        if (sortCall.callee.kind !== "memberAccess") return;
        expect(sortCall.callee.object.kind).to.equal("array");
        if (sortCall.callee.object.kind !== "array") return;

        const inferredType = sortCall.callee.object.inferredType;
        expect(inferredType?.kind).to.equal("arrayType");
        if (!inferredType || inferredType.kind !== "arrayType") return;
        expect(inferredType.elementType.kind).to.equal("referenceType");
        if (inferredType.elementType.kind !== "referenceType") return;
        expect(inferredType.elementType.name).to.equal("MenuEntry");
        const weightMember = inferredType.elementType.structuralMembers?.find(
          (member: { kind: string; name: string }) =>
            member.kind === "propertySignature" && member.name === "weight"
        );
        expect(weightMember).to.not.equal(undefined);
        expect(weightMember?.kind).to.equal("propertySignature");
        if (!weightMember || weightMember.kind !== "propertySignature") return;
        expect(weightMember.type).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
