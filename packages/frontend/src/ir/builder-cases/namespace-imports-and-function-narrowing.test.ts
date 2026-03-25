/**
 * IR Builder tests: Namespace import recovery and function declaration narrowing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  createFilesystemTestProgram,
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – namespace imports and function narrowing", () => {
    it("recovers namespace-import member types from source-package const arrow exports", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-namespace-")
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

        const packageRoot = path.join(
          tempDir,
          "node_modules",
          "@tsonic",
          "nodejs"
        );
        fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
        fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
        fs.writeFileSync(
          path.join(packageRoot, "package.json"),
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
          path.join(packageRoot, "tsonic.package.json"),
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
          path.join(packageRoot, "src", "index.ts"),
          'export * as path from "./path-module.ts";\n'
        );
        fs.writeFileSync(
          path.join(packageRoot, "src", "path-module.ts"),
          [
            "export type ParsedPath = {",
            "  readonly base: string;",
            "};",
            "export const basename = (value: string): string => value;",
            "export const parse = (value: string): ParsedPath => ({ base: value });",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import * as nodePath from "@tsonic/nodejs/path.js";',
            "export function run(): string {",
            '  const parsed = nodePath.parse("file.txt");',
            "  return nodePath.basename(parsed.base);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [packageRoot],
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

        const runFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const parsedDecl = runFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "parsed"
            )
        );
        expect(parsedDecl).to.not.equal(undefined);
        if (!parsedDecl) return;

        const parseCall = parsedDecl.declarations[0]?.initializer;
        expect(parseCall?.kind).to.equal("call");
        if (!parseCall || parseCall.kind !== "call") return;
        expect(parseCall.callee.kind).to.equal("memberAccess");
        if (parseCall.callee.kind !== "memberAccess") return;
        expect(parseCall.callee.inferredType?.kind).to.equal("functionType");
        if (parseCall.callee.inferredType?.kind !== "functionType") return;
        expect(parseCall.callee.inferredType.returnType.kind).to.not.equal(
          "unknownType"
        );

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "call"
        ) {
          return;
        }
        expect(returnStmt.expression.callee.kind).to.equal("memberAccess");
        if (returnStmt.expression.callee.kind !== "memberAccess") return;
        expect(returnStmt.expression.callee.inferredType?.kind).to.equal(
          "functionType"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves Array.isArray fallthrough narrowing after early-return array branches in function declarations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export function appendHeader(value: string | string[]): string {",
            "  if (Array.isArray(value)) {",
            '    return value.join("|");',
            "  }",
            "  takesString(value);",
            "  return value;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "appendHeader"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "expressionStatement" }
          > => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const callArg = callStmt.expression.arguments[0];
        expect(callArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const returnStmt = fn.body.statements.at(-1);
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const ifStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStmt?.kind).to.equal("ifStatement");
        if (!ifStmt || ifStmt.condition.kind !== "call") {
          return;
        }

        expect(ifStmt.condition.narrowing?.kind).to.equal("typePredicate");
        expect(ifStmt.condition.narrowing?.argIndex).to.equal(0);
        expect(ifStmt.condition.narrowing?.targetType.kind).to.equal(
          "arrayType"
        );
        if (
          !ifStmt.condition.narrowing ||
          ifStmt.condition.narrowing.targetType.kind !== "arrayType"
        ) {
          return;
        }
        expect(ifStmt.condition.narrowing.targetType.elementType).to.deep.equal(
          { kind: "primitiveType", name: "string" }
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof fallthrough narrowing after early-return constructor branches in function declarations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export function appendBody(value: string | Uint8Array): string {",
            "  if (value instanceof Uint8Array) {",
            "    return String(value.length);",
            "  }",
            "  takesString(value);",
            "  return value;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "appendBody"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "expressionStatement" }
          > => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const callArg = callStmt.expression.arguments[0];
        expect(callArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const returnStmt = fn.body.statements.at(-1);
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("treats optional exact-numeric parameters as nullable at read sites", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "let currentExitCode: int | undefined = undefined;",
            "",
            "export function exit(code?: int): int {",
            "  const resolved = code ?? currentExitCode ?? (0 as int);",
            "  return resolved;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "exit"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const varDecl = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "variableDeclaration" }
          > => stmt.kind === "variableDeclaration"
        );
        expect(varDecl).to.not.equal(undefined);
        const resolvedInit = varDecl?.declarations[0]?.initializer;
        expect(resolvedInit?.kind).to.equal("logical");
        if (!resolvedInit || resolvedInit.kind !== "logical") {
          return;
        }

        expect(resolvedInit.left.kind).to.equal("logical");
        if (resolvedInit.left.kind !== "logical") {
          return;
        }

        expect(resolvedInit.left.left.inferredType).to.deep.equal({
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "int" },
            { kind: "primitiveType", name: "undefined" },
          ],
        });
      } finally {
        fixture.cleanup();
      }
    });
  });
});
