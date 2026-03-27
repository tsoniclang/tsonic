/**
 * IR Builder tests: Type access, Record properties, indexed access, and Length
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Type access and Records", () => {
    it("types Record<string, unknown>.Keys as string[] without unknown poison", () => {
      const source = `
        export function firstKey(settings: Record<string, unknown>): string | undefined {
          const settingsKeys = settings.Keys;
          if (settingsKeys.Length === 0) {
            return undefined;
          }
          return settingsKeys[0];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "firstKey"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const keyDecl = fn.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (d) =>
              d.name.kind === "identifierPattern" &&
              d.name.name === "settingsKeys"
          )
      );
      expect(keyDecl).to.not.equal(undefined);
      const keyInit = keyDecl?.declarations[0]?.initializer;
      expect(keyInit?.kind).to.equal("memberAccess");
      if (!keyInit || keyInit.kind !== "memberAccess") return;
      expect(keyInit.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
      });
    });

    it("types Record<string, unknown>.Values as unknown[] deterministically", () => {
      const source = `
        export function firstValue(settings: Record<string, unknown>): unknown | undefined {
          const values = settings.Values;
          return values.Length > 0 ? values[0] : undefined;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "firstValue"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const valuesDecl = fn.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (d) =>
              d.name.kind === "identifierPattern" && d.name.name === "values"
          )
      );
      expect(valuesDecl).to.not.equal(undefined);
      const valuesInit = valuesDecl?.declarations[0]?.initializer;
      expect(valuesInit?.kind).to.equal("memberAccess");
      if (!valuesInit || valuesInit.kind !== "memberAccess") return;
      expect(valuesInit.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "unknownType", explicit: true },
      });
    });

    it("allows arbitrary property access on Record<string, unknown> without unknown poison", () => {
      const source = `
        export function fill(): Record<string, unknown> {
          const state: Record<string, unknown> = {};
          state.zulip_version = "1.0";
          state.realm_users = [];
          return state;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
    });

    it("allows declared unknown members on structural callback parameters", () => {
      const source = `
        export function project(
          rawUpdates: { stream_id: string; property: string; value: unknown }[]
        ): string[] {
          return rawUpdates.map((update) => String(update.value ?? ""));
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
    });

    it("allows explicitly unknown nominal members without poisoning property access", () => {
      const source = `
        class Box {
          public value: unknown = undefined;
        }

        export function read(box: Box): string {
          return String(box.value ?? "");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
    });

    it("supports indexed access on generic discriminated-union payloads after narrowing", () => {
      const source = `
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Ok<T> | Err<E>;

        declare function listTenants(): Result<{ Id: string }[], string>;

        export function run(): string {
          const result = listTenants();
          if (!result.success) {
            return result.error;
          }

          const data = result.data;
          return data[0]!.Id;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const dataDecl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "data"
          )
      );
      expect(dataDecl).to.not.equal(undefined);
      const dataInit = dataDecl?.declarations[0]?.initializer;
      expect(
        dataInit?.kind === "typeAssertion" ? dataInit.expression.kind : dataInit?.kind
      ).to.equal("memberAccess");
      const narrowedDataType =
        dataInit?.kind === "typeAssertion" ? dataInit.inferredType : dataInit?.inferredType;
      expect(narrowedDataType?.kind).to.equal("arrayType");
      if (!narrowedDataType || narrowedDataType.kind !== "arrayType") {
        return;
      }
      expect(narrowedDataType.elementType.kind).to.equal("objectType");
      if (narrowedDataType.elementType.kind !== "objectType") return;
      expect(narrowedDataType.elementType.members).to.have.length(1);
      const idMember = narrowedDataType.elementType.members[0];
      expect(idMember?.kind).to.equal("propertySignature");
      if (!idMember || idMember.kind !== "propertySignature") return;
      expect(idMember.name).to.equal("Id");
      expect(idMember.type).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      expect(idMember.isOptional).to.equal(false);
      expect(idMember.isReadonly).to.equal(false);
    });

    it("treats string-literal element access on narrowed unions like property access", () => {
      const source = `
        type Err = { error: string; code?: string };
        type Ok = { events: string[] };

        declare function getEvents(): Err | Ok;

        export function run(): string {
          const result = getEvents();
          if ("error" in result) {
            return result["code"] ?? result["error"];
          }
          return result["events"][0] ?? "";
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const ifStmt = run.body.statements.find(
        (stmt) => stmt.kind === "ifStatement"
      );
      expect(ifStmt).to.not.equal(undefined);
      if (!ifStmt || ifStmt.kind !== "ifStatement") return;

      const thenReturn =
        ifStmt.thenStatement.kind === "blockStatement"
          ? ifStmt.thenStatement.statements.find(
              (stmt) => stmt.kind === "returnStatement"
            )
          : undefined;
      expect(thenReturn).to.not.equal(undefined);
      if (
        !thenReturn ||
        thenReturn.kind !== "returnStatement" ||
        !thenReturn.expression ||
        thenReturn.expression.kind !== "logical"
      ) {
        return;
      }

      const codeAccess = thenReturn.expression.left;
      expect(codeAccess.kind).to.equal("memberAccess");
      if (codeAccess.kind !== "memberAccess") return;
      expect(codeAccess.accessKind).to.not.equal("unknown");
      expect(codeAccess.inferredType).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });

      const finalReturn = [...run.body.statements]
        .reverse()
        .find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
      expect(finalReturn).to.not.equal(undefined);
      if (
        !finalReturn ||
        !finalReturn.expression ||
        finalReturn.expression.kind !== "logical" ||
        finalReturn.expression.left.kind !== "memberAccess"
      ) {
        return;
      }

      const eventsIndex = finalReturn.expression.left;
      expect(eventsIndex.accessKind).to.equal("clrIndexer");
      expect(eventsIndex.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps string-literal element access computed for alias-wrapped string dictionaries", () => {
      const source = `
        interface SettingsMap {
          [key: string]: string;
        }

        declare function load(): SettingsMap;

        export function run(): string | undefined {
          const settings = load();
          return settings["waiting_period_threshold"];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const returnStmt = run.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
          stmt.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (!returnStmt?.expression) return;

      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.isComputed).to.equal(true);
      expect(returnStmt.expression.accessKind).to.equal("dictionary");
    });

    it("keeps string-literal element access computed after generic return narrowing", () => {
      const source = `
        type SettingsMap = { [key: string]: string };

        declare const JsonSerializer: {
          Deserialize<T>(json: string): T | undefined;
        };

        export function run(json: string): string | undefined {
          const settingsOrNull = JsonSerializer.Deserialize<SettingsMap>(json);
          if (settingsOrNull === undefined) {
            return undefined;
          }
          const settings = settingsOrNull;
          return settings["waiting_period_threshold"];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5107")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const returnStmt = [...run.body.statements]
        .reverse()
        .find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
      expect(returnStmt).to.not.equal(undefined);
      if (!returnStmt?.expression) return;

      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.isComputed).to.equal(true);
      expect(returnStmt.expression.accessKind).to.equal("dictionary");
    });

    it("types inferred array Length access as int without unknown poison", () => {
      const source = `
        export function count(items: string[]): int {
          const copy = items;
          return copy.Length;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "count"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements.find(
        (s) => s.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      )
        return;
      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("types tuple Length access as int without unknown poison", () => {
      const source = `
        export function tupleCount(pair: [string, int]): int {
          return pair.Length;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN5203")).to.equal(false);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "tupleCount"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements.find(
        (s) => s.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      )
        return;
      expect(returnStmt.expression.kind).to.equal("memberAccess");
      if (returnStmt.expression.kind !== "memberAccess") return;
      expect(returnStmt.expression.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });
  });
});
