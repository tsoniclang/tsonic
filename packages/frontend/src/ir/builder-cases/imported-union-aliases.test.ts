import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type {
  IrClassDeclaration,
  IrConstructorDeclaration,
  IrReferenceType,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  it("preserves imported union alias family metadata on constructor parameters without stamping anonymous nested unions", () => {
    const files = {
      "src/typed-array-core.ts": `
        export type TypedArrayInput<TElement extends number> =
          | TElement[]
          | Iterable<number>;

        export type TypedArrayConstructorInput<TElement extends number> =
          | number
          | TypedArrayInput<TElement>;

        export class TypedArrayBase<TElement extends number> {
          constructor(lengthOrValues: number | TypedArrayInput<TElement>) {
            void lengthOrValues;
          }
        }
      `,
      "src/uint16-array.ts": `
        import type { TypedArrayConstructorInput } from "./typed-array-core.js";
        import { TypedArrayBase } from "./typed-array-core.js";

        export class Uint16Array extends TypedArrayBase<number> {
          constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
            super(lengthOrValues);
          }
        }
      `,
    };

    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(files, "src/uint16-array.ts");

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const importedKlass = result.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "Uint16Array"
      );
      expect(importedKlass).to.not.equal(undefined);
      if (!importedKlass) return;

      const importedCtor = importedKlass.members.find(
        (member): member is IrConstructorDeclaration =>
          member.kind === "constructorDeclaration"
      );
      expect(importedCtor).to.not.equal(undefined);
      if (!importedCtor) return;

      const importedParameter = importedCtor.parameters[0];
      expect(importedParameter?.type?.kind).to.equal("referenceType");
      if (importedParameter?.type?.kind !== "referenceType") return;

      const importedType = importedParameter.type as IrReferenceType;
      expect(importedType.name).to.equal("TypedArrayConstructorInput");
      expect(importedType.typeArguments).to.have.lengthOf(1);

      const coreSourceFile = testProgram.sourceFiles.find((candidate) =>
        candidate.fileName.endsWith("/src/typed-array-core.ts")
      );
      expect(coreSourceFile).to.not.equal(undefined);
      if (!coreSourceFile) return;

      const coreResult = buildIrModule(
        coreSourceFile,
        testProgram,
        options,
        ctx
      );
      expect(coreResult.ok).to.equal(true);
      if (!coreResult.ok) return;

      const coreKlass = coreResult.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "TypedArrayBase"
      );
      expect(coreKlass).to.not.equal(undefined);
      if (!coreKlass) return;

      const coreCtor = coreKlass.members.find(
        (member): member is IrConstructorDeclaration =>
          member.kind === "constructorDeclaration"
      );
      expect(coreCtor).to.not.equal(undefined);
      if (!coreCtor) return;

      const coreParameter = coreCtor.parameters[0];
      expect(coreParameter?.type?.kind).to.equal("unionType");
      if (coreParameter?.type?.kind !== "unionType") return;

      expect(coreParameter.type.runtimeCarrierFamilyKey).to.equal(undefined);
      expect(coreParameter.type.types).to.have.lengthOf(2);
      expect(coreParameter.type.types[1]?.kind).to.equal("referenceType");
      if (coreParameter.type.types[1]?.kind !== "referenceType") return;
      expect(coreParameter.type.types[1].name).to.equal("TypedArrayInput");
    } finally {
      cleanup();
    }
  });

  it("keeps conditional constructor arguments on the selected numeric arm for source-backed aliases", () => {
    const files = {
      "src/typed-array-core.ts": `
        export type TypedArrayInput<TElement extends number> =
          | readonly TElement[]
          | Iterable<number>;

        export type TypedArrayConstructorInput<TElement extends number> =
          | number
          | TypedArrayInput<TElement>;

        export class Uint16Array {
          constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
            void lengthOrValues;
          }
        }
      `,
      "src/index.ts": `
        import { Uint16Array } from "./typed-array-core.js";

        export function create(totalLength: number): Uint16Array {
          return new Uint16Array(totalLength === 0 ? 1 : totalLength);
        }
      `,
    };

    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(files, "src/index.ts");

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const createFn = result.value.body.find(
        (
          stmt
        ): stmt is Extract<
          (typeof result.value.body)[number],
          { kind: "functionDeclaration" }
        > => stmt.kind === "functionDeclaration" && stmt.name === "create"
      );
      expect(createFn).to.not.equal(undefined);
      if (!createFn) return;

      const returnStmt = createFn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const ctorExpr = returnStmt.expression;
      expect(ctorExpr?.kind).to.equal("new");
      if (!ctorExpr || ctorExpr.kind !== "new") return;

      expect(ctorExpr.parameterTypes?.[0]?.kind).to.equal("referenceType");
      if (ctorExpr.parameterTypes?.[0]?.kind !== "referenceType") return;
      expect(ctorExpr.parameterTypes[0].name).to.equal(
        "TypedArrayConstructorInput"
      );
      expect(ctorExpr.surfaceParameterTypes?.[0]?.kind).to.equal(
        "referenceType"
      );
      if (ctorExpr.surfaceParameterTypes?.[0]?.kind !== "referenceType") return;
      expect(ctorExpr.surfaceParameterTypes[0].name).to.equal(
        "TypedArrayConstructorInput"
      );
      expect(ctorExpr.arguments[0]?.kind).to.equal("conditional");
      if (ctorExpr.arguments[0]?.kind !== "conditional") return;
      expect(ctorExpr.arguments[0].inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
    } finally {
      cleanup();
    }
  });

  it("keeps bare numeric constructor arguments on the selected numeric arm while preserving the source-backed surface", () => {
    const files = {
      "src/typed-array-core.ts": `
        export type TypedArrayInput<TElement extends number> =
          | readonly TElement[]
          | Iterable<number>;

        export type TypedArrayConstructorInput<TElement extends number> =
          | number
          | TypedArrayInput<TElement>;

        export class Uint16Array {
          constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
            void lengthOrValues;
          }
        }
      `,
      "src/index.ts": `
        import { Uint16Array } from "./typed-array-core.js";

        export function create(totalLength: number): Uint16Array {
          return new Uint16Array(totalLength);
        }
      `,
    };

    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(files, "src/index.ts");

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const createFn = result.value.body.find(
        (
          stmt
        ): stmt is Extract<
          (typeof result.value.body)[number],
          { kind: "functionDeclaration" }
        > => stmt.kind === "functionDeclaration" && stmt.name === "create"
      );
      expect(createFn).to.not.equal(undefined);
      if (!createFn) return;

      const returnStmt = createFn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const ctorExpr = returnStmt.expression;
      expect(ctorExpr?.kind).to.equal("new");
      if (!ctorExpr || ctorExpr.kind !== "new") return;

      expect(ctorExpr.parameterTypes?.[0]?.kind).to.equal("referenceType");
      if (ctorExpr.parameterTypes?.[0]?.kind !== "referenceType") return;
      expect(ctorExpr.parameterTypes[0].name).to.equal(
        "TypedArrayConstructorInput"
      );
      expect(ctorExpr.surfaceParameterTypes?.[0]?.kind).to.equal(
        "referenceType"
      );
      if (ctorExpr.surfaceParameterTypes?.[0]?.kind !== "referenceType") return;
      expect(ctorExpr.surfaceParameterTypes[0].name).to.equal(
        "TypedArrayConstructorInput"
      );
      expect(ctorExpr.arguments[0]?.kind).to.equal("identifier");
      if (ctorExpr.arguments[0]?.kind !== "identifier") return;
      expect(ctorExpr.arguments[0].inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
    } finally {
      cleanup();
    }
  });

  it("expands alias-backed await expression result types instead of preserving the pre-await carrier", () => {
    const files = {
      "src/index.ts": `
        type MaybeAsyncText = void | string | Promise<void | string>;

        declare function invoke(flag: boolean): MaybeAsyncText;

        export async function run(flag: boolean): Promise<void | string> {
          await invoke(flag);
        }
      `,
    };

    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(files, "src/index.ts");

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const runFn = result.value.body.find(
        (
          stmt
        ): stmt is Extract<
          (typeof result.value.body)[number],
          { kind: "functionDeclaration" }
        > => stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(runFn).to.not.equal(undefined);
      if (!runFn) return;

      const awaitStmt = runFn.body.statements[0];
      expect(awaitStmt?.kind).to.equal("expressionStatement");
      if (!awaitStmt || awaitStmt.kind !== "expressionStatement") return;

      const awaitExpr = awaitStmt.expression;
      expect(awaitExpr.kind).to.equal("await");
      if (awaitExpr.kind !== "await") return;

      expect(awaitExpr.inferredType?.kind).to.equal("unionType");
      if (awaitExpr.inferredType?.kind !== "unionType") return;

      expect(
        awaitExpr.inferredType.types.some(
          (member) =>
            member.kind === "referenceType" && member.name === "MaybeAsyncText"
        )
      ).to.equal(false);
      expect(
        awaitExpr.inferredType.types.some(
          (member) =>
            member.kind === "referenceType" && member.name === "Promise"
        )
      ).to.equal(false);
      expect(
        awaitExpr.inferredType.types.some(
          (member) =>
            member.kind === "primitiveType" && member.name === "string"
        )
      ).to.equal(true);
    } finally {
      cleanup();
    }
  });
});
