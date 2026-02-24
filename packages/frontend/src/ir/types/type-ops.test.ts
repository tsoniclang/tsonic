import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "./index.js";
import {
  irTypesEqual,
  normalizedUnionType,
  stableIrTypeKey,
  unwrapAsyncWrapperType,
} from "./type-ops.js";

const stringType: IrType = { kind: "primitiveType", name: "string" };
const numberType: IrType = { kind: "primitiveType", name: "number" };
const booleanType: IrType = { kind: "primitiveType", name: "boolean" };

describe("type-ops", () => {
  it("treats union member order as equal", () => {
    const left: IrType = {
      kind: "unionType",
      types: [stringType, numberType, booleanType],
    };
    const right: IrType = {
      kind: "unionType",
      types: [booleanType, stringType, numberType],
    };

    expect(irTypesEqual(left, right)).to.equal(true);
    expect(stableIrTypeKey(left)).to.equal(stableIrTypeKey(right));
  });

  it("normalizes and deduplicates nested unions", () => {
    const nested: IrType = {
      kind: "unionType",
      types: [
        stringType,
        {
          kind: "unionType",
          types: [numberType, stringType],
        },
      ],
    };

    const normalized = normalizedUnionType([nested, booleanType]);
    expect(normalized.kind).to.equal("unionType");
    if (normalized.kind !== "unionType") return;
    expect(normalized.types).to.have.length(3);
    const keys = normalized.types.map((t) => stableIrTypeKey(t));
    expect(keys).to.deep.equal([
      stableIrTypeKey(booleanType),
      stableIrTypeKey(numberType),
      stableIrTypeKey(stringType),
    ]);
  });

  it("unwraps Promise/Task/ValueTask wrappers", () => {
    const payload: IrType = { kind: "primitiveType", name: "int" };

    const promiseType: IrType = {
      kind: "referenceType",
      name: "Promise",
      typeArguments: [payload],
    };
    const taskType: IrType = {
      kind: "referenceType",
      name: "System.Threading.Tasks.Task_1",
      resolvedClrType: "System.Threading.Tasks.Task`1[[System.Int32]]",
      typeArguments: [payload],
    };
    const valueTaskType: IrType = {
      kind: "referenceType",
      name: "ValueTask_1",
      resolvedClrType: "System.Threading.Tasks.ValueTask`1[[System.Int32]]",
      typeArguments: [payload],
    };
    const plainType: IrType = {
      kind: "referenceType",
      name: "List_1",
      typeArguments: [payload],
    };

    expect(unwrapAsyncWrapperType(promiseType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(taskType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(valueTaskType)).to.deep.equal(payload);
    expect(unwrapAsyncWrapperType(plainType)).to.equal(undefined);
  });
});
