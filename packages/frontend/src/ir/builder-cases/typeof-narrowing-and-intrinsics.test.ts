/**
 * IR Builder tests: typeof narrowing basics and core intrinsic provenance
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  createTestProgram,
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("typeof narrowing basics", () => {
    it("narrows typeof checks in js-surface branches to the matching primitive type", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-typeof-narrowing-")
      );

      try {
        const jsRoot = path.resolve(process.cwd(), "../../../js/versions/10");
        expect(fs.existsSync(path.join(jsRoot, "package.json"))).to.equal(true);

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
            "export function main(value: unknown): void {",
            '  if (typeof value === "number") {',
            "    console.log(value.toString());",
            '  } else if (typeof value === "string") {',
            "    console.log(value.toUpperCase());",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [jsRoot],
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

        const mainFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(mainFn).to.not.equal(undefined);
        if (!mainFn) return;

        const numberIf = mainFn.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "ifStatement" }> =>
            stmt.kind === "ifStatement"
        );
        expect(numberIf).to.not.equal(undefined);
        if (!numberIf) return;

        const numberExprStmt =
          numberIf.thenStatement.kind === "blockStatement"
            ? numberIf.thenStatement.statements[0]
            : undefined;
        expect(numberExprStmt?.kind).to.equal("expressionStatement");
        if (
          !numberExprStmt ||
          numberExprStmt.kind !== "expressionStatement" ||
          numberExprStmt.expression.kind !== "call"
        ) {
          return;
        }

        const numberToStringCall = numberExprStmt.expression.arguments[0];
        expect(numberToStringCall?.kind).to.equal("call");
        if (!numberToStringCall || numberToStringCall.kind !== "call") return;
        expect(numberToStringCall.callee.kind).to.equal("memberAccess");
        if (numberToStringCall.callee.kind !== "memberAccess") return;
        expect(numberToStringCall.callee.object.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });

        const stringIf =
          numberIf.elseStatement?.kind === "ifStatement"
            ? numberIf.elseStatement
            : undefined;
        expect(stringIf).to.not.equal(undefined);
        if (!stringIf) return;

        const stringExprStmt =
          stringIf.thenStatement.kind === "blockStatement"
            ? stringIf.thenStatement.statements[0]
            : undefined;
        expect(stringExprStmt?.kind).to.equal("expressionStatement");
        if (
          !stringExprStmt ||
          stringExprStmt.kind !== "expressionStatement" ||
          stringExprStmt.expression.kind !== "call"
        ) {
          return;
        }

        const stringCall = stringExprStmt.expression.arguments[0];
        expect(stringCall?.kind).to.equal("call");
        if (!stringCall || stringCall.kind !== "call") return;
        expect(stringCall.callee.kind).to.equal("memberAccess");
        if (stringCall.callee.kind !== "memberAccess") return;
        expect(stringCall.callee.object.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Core intrinsic provenance", () => {
    const expectVariableInitializerKind = (
      source: string,
      variableName: string,
      expectedKind: string
    ): void => {
      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const variableStmt = result.value.body.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (decl) =>
              decl.name.kind === "identifierPattern" &&
              decl.name.name === variableName
          )
      );
      expect(variableStmt).to.not.equal(undefined);
      if (!variableStmt) return;

      const declaration = variableStmt.declarations.find(
        (decl) =>
          decl.name.kind === "identifierPattern" &&
          decl.name.name === variableName
      );
      expect(declaration?.initializer?.kind).to.equal(expectedKind);
    };

    it("does not lower locally declared nameof as the compiler intrinsic", () => {
      expectVariableInitializerKind(
        `
          function nameof(value: string): string {
            return value + "!";
          }

          export const label = nameof("x");
        `,
        "label",
        "call"
      );
    });

    it("does not lower locally declared sizeof as the compiler intrinsic", () => {
      expectVariableInitializerKind(
        `
          function sizeof<T>(): number {
            return 4;
          }

          export const bytes = sizeof<number>();
        `,
        "bytes",
        "call"
      );
    });

    it("does not lower locally declared defaultof/trycast/stackalloc/asinterface intrinsics", () => {
      const source = `
        function defaultof<T>(): T | undefined {
          return undefined;
        }
        function trycast<T>(value: unknown): T | undefined {
          return value as T | undefined;
        }
        function stackalloc<T>(size: number): T {
          throw new Error(String(size));
        }
        function asinterface<T>(value: unknown): T {
          return value as T;
        }

        interface Box { value: number; }

        export const fallback = defaultof<number>();
        export const maybe = trycast<Box>({ value: 1 });
        export const mem = stackalloc<number>(16);
        export const view = asinterface<Box>({ value: 1 });
      `;

      for (const variableName of ["fallback", "maybe", "mem", "view"]) {
        expectVariableInitializerKind(source, variableName, "call");
      }
    });
  });
});
