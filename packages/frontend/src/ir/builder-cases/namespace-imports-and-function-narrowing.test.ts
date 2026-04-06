/**
 * IR Builder tests: Namespace import recovery and function declaration narrowing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  createFilesystemTestProgram,
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";
import { runAnonymousTypeLoweringPass } from "../validation/anonymous-type-lowering-pass.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – namespace imports and function narrowing", () => {
    it("recovers namespace-import member types from source-package const arrow exports", () => {
      const fixture = materializeFrontendFixture(
        "ir/namespace-imports-and-function-narrowing/source-package-namespace"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

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
        expect(parseCall.callee.object.inferredType?.kind).to.equal("objectType");
        if (parseCall.callee.object.inferredType?.kind !== "objectType") return;
        expect(
          [...parseCall.callee.object.inferredType.members.map((member) => member.name)].sort()
        ).to.deep.equal(["basename", "parse", "ParsedPathError"].sort());
        const errorMember = parseCall.callee.object.inferredType.members.find(
          (member) => member.name === "ParsedPathError"
        );
        expect(errorMember?.kind).to.equal("propertySignature");
        if (!errorMember || errorMember.kind !== "propertySignature") return;
        expect(errorMember.type.kind).to.equal("referenceType");
        if (errorMember.type.kind !== "referenceType") return;
        expect(errorMember.type.typeId).to.not.equal(undefined);
        expect(errorMember.type.resolvedClrType).to.be.a("string");
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
        expect(returnStmt.expression.callee.object.inferredType?.kind).to.equal(
          "objectType"
        );
        expect(returnStmt.expression.callee.inferredType?.kind).to.equal(
          "functionType"
        );
      } finally {
        fixture.cleanup();
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
            "interface Chunk {",
            "  readonly length: number;",
            "}",
            "interface ChunkConstructor {",
            "  readonly prototype: Chunk;",
            "  new(length?: number): Chunk;",
            "}",
            "declare const Chunk: ChunkConstructor;",
            "",
            "export function appendBody(value: string | Chunk): string {",
            "  if (value instanceof Chunk) {",
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

    it("preserves instanceof narrowing for imported constructor-typed values", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/crypto.ts": [
            "export interface RSA {",
            "  Encrypt(data: string): string;",
            "}",
            "export const RSA: (abstract new() => RSA) & {",
            "  Create(): RSA;",
            "} = undefined as unknown as (abstract new() => RSA) & {",
            "  Create(): RSA;",
            "};",
          ].join("\n"),
          "src/index.ts": [
            'import { RSA } from "./crypto.js";',
            'import type { RSA as RsaInstance } from "./crypto.js";',
            "declare function takesRsa(value: RsaInstance): void;",
            "",
            "export function encrypt(value: RsaInstance | string): string {",
            "  if (value instanceof RSA) {",
            "    takesRsa(value);",
            '    return value.Encrypt("payload");',
            "  }",
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
            stmt.kind === "functionDeclaration" && stmt.name === "encrypt"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const ifStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStmt?.kind).to.equal("ifStatement");
        if (
          !ifStmt ||
          ifStmt.kind !== "ifStatement" ||
          ifStmt.thenStatement.kind !== "blockStatement"
        ) {
          return;
        }

        const thenStatements = ifStmt.thenStatement.statements;

        const callStmt = thenStatements.find(
          (
            stmt: IrFunctionDeclaration["body"]["statements"][number]
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

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType?.kind).to.equal("referenceType");
        if (narrowedArg?.inferredType?.kind !== "referenceType") {
          return;
        }
        expect(narrowedArg.inferredType.name).to.equal("RSA");

        const returnStmt = thenStatements.find(
          (
            stmt: IrFunctionDeclaration["body"]["statements"][number]
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "returnStatement" }
          > => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "call"
        ) {
          return;
        }

        const callee = returnStmt.expression.callee;
        expect(callee.kind).to.equal("memberAccess");
        if (callee.kind !== "memberAccess") {
          return;
        }

        expect(callee.object.inferredType?.kind).to.equal("referenceType");
        if (callee.object.inferredType?.kind !== "referenceType") {
          return;
        }
        expect(callee.object.inferredType.name).to.equal("RSA");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof narrowing for imported constructor values with alias-backed instance types", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/crypto.ts": [
            "export interface RSA$instance {",
            "  Encrypt(data: string): string;",
            "}",
            "export interface __RSA$views {",
            "  AsKey(): RSA$instance;",
            "}",
            "export type RSA = RSA$instance & __RSA$views;",
            "export const RSA: (abstract new() => RSA) & {",
            "  Create(): RSA;",
            "} = undefined as unknown as (abstract new() => RSA) & {",
            "  Create(): RSA;",
            "};",
          ].join("\n"),
          "src/index.ts": [
            'import { RSA } from "./crypto.js";',
            'import type { RSA as RsaInstance } from "./crypto.js";',
            "declare function takesRsa(value: RsaInstance): void;",
            "",
            "export function encrypt(value: RsaInstance | string): string {",
            "  if (value instanceof RSA) {",
            "    takesRsa(value);",
            '    return value.Encrypt("payload");',
            "  }",
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
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof narrowing for declaration-package constructor values", () => {
      const fixture = materializeFrontendFixture(
        "ir/namespace-imports-and-function-narrowing/instanceof-declaration-package"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          typeRoots: ["node_modules/@acme/crypto"],
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

        const result = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(result.ok).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("does not emit anonymous namespace carriers that are only referenced from imports", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/child-process.ts": [
            "export class SpawnSyncReturns<T> {",
            "  value!: T;",
            "}",
            "",
            "export function spawnSync(): SpawnSyncReturns<Uint8Array> {",
            "  return new SpawnSyncReturns<Uint8Array>();",
            "}",
            "",
          ].join("\n"),
          "src/index.ts": [
            'import * as child_process from "./child-process.js";',
            "",
            "export function run(): number {",
            "  const result = child_process.spawnSync();",
            "  return result.value.length;",
            "}",
            "",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const moduleResults = fixture.testProgram.sourceFiles.map((sourceFile) =>
          buildIrModule(sourceFile, fixture.testProgram, fixture.options, fixture.ctx)
        );
        expect(moduleResults.every((result) => result.ok)).to.equal(true);
        if (!moduleResults.every((result) => result.ok)) return;

        const lowered = runAnonymousTypeLoweringPass(
          moduleResults.map((result) => result.value)
        );

        expect(lowered.ok).to.equal(true);
        expect(
          lowered.modules.some(
            (module) => module.filePath === "__tsonic/__tsonic_anonymous_types.g.ts"
          )
        ).to.equal(false);
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
