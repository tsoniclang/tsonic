import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type { IrClassDeclaration, IrConstructorDeclaration } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  it("preserves imported union alias family metadata on constructor parameters", () => {
    const files = {
      "src/typed-array-core.ts": `
        export type TypedArrayInput<TElement extends number> =
          | TElement[]
          | Iterable<number>;

        export type TypedArrayConstructorInput<TElement extends number> =
          | number
          | TypedArrayInput<TElement>;

        export class TypedArrayBase<TElement extends number> {
          public constructor(lengthOrValues: number | TypedArrayInput<TElement>) {
            void lengthOrValues;
          }
        }
      `,
      "src/uint16-array.ts": `
        import type { TypedArrayConstructorInput } from "./typed-array-core.js";
        import { TypedArrayBase } from "./typed-array-core.js";

        export class Uint16Array extends TypedArrayBase<number> {
          public constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
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

      const klass = result.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "Uint16Array"
      );
      expect(klass).to.not.equal(undefined);
      if (!klass) return;

      const ctor = klass.members.find(
        (member): member is IrConstructorDeclaration =>
          member.kind === "constructorDeclaration"
      );
      expect(ctor).to.not.equal(undefined);
      if (!ctor) return;

      const parameter = ctor.parameters[0];
      console.log(
        JSON.stringify(
          parameter?.type,
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          2
        )
      );
    } finally {
      cleanup();
    }
  });
});
