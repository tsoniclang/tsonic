import assert from "node:assert/strict";
import test from "node:test";
import type {
  Type,
} from "@tsonic/tsts";
import {
  selectSourceCallParameterSlots,
} from "./call-parameter-slots.js";
import type {
  ResolvedSourceCallInfo,
} from "./call-result-selection.js";

test("selected call parameter slots preserve required, optional, and rest forms", () => {
  const required = type();
  const optional = type();
  const rest = type();
  const selected = selectSourceCallParameterSlots(
    call([
      parameter(0, "value", required, false, false),
      parameter(1, "suffix", optional, true, false),
      parameter(2, "items", rest, true, true),
    ]),
    typeShape(new Map()),
  );
  assert.deepEqual(selected, [
    { sourceParameterIndex: 0, sourceParameterName: "value", form: "required" },
    { sourceParameterIndex: 1, sourceParameterName: "suffix", form: "optional" },
    { sourceParameterIndex: 2, sourceParameterName: "items", form: "rest" },
  ]);
});

test("selected tuple-rest parameters expand into exact effective slots", () => {
  const tuple = type();
  const selected = selectSourceCallParameterSlots(
    call([parameter(0, "args", tuple, false, true)]),
    typeShape(new Map([[tuple, [
      { type: type(), elementKind: "required" },
      { type: type(), elementKind: "optional" },
      { type: type(), elementKind: "rest" },
    ]]])),
  );
  assert.deepEqual(selected, [
    { sourceParameterIndex: 0, sourceParameterName: "args0", form: "required" },
    { sourceParameterIndex: 0, sourceParameterName: "args1", form: "optional" },
    { sourceParameterIndex: 0, sourceParameterName: "args2", form: "rest" },
  ]);
});

test("selected call parameter slots fail closed for untyped or contradictory evidence", () => {
  const selected = call([
    parameter(0, "first", type(), false, false),
    parameter(0, "second", type(), false, false),
  ]);
  assert.equal(selectSourceCallParameterSlots(selected, typeShape(new Map())), undefined);
  assert.equal(selectSourceCallParameterSlots(
    { ...selected, sourceSelectedSignatureKind: "untyped" },
    typeShape(new Map()),
  ), undefined);
});

function call(
  parameters: readonly ResolvedSourceCallInfo["sourceSelectedSignatureParameters"][number][],
): ResolvedSourceCallInfo {
  return {
    sourceSelectedSignatureKind: "resolved",
    sourceSelectedSignatureParameters: parameters,
  } as ResolvedSourceCallInfo;
}

function parameter(
  parameterIndex: number,
  parameterName: string,
  selectedType: Type,
  acceptsOmission: boolean,
  rest: boolean,
): ResolvedSourceCallInfo["sourceSelectedSignatureParameters"][number] {
  return {
    parameterIndex,
    parameterName,
    selectedType,
    acceptsOmission,
    rest,
  } as ResolvedSourceCallInfo["sourceSelectedSignatureParameters"][number];
}

function type(): Type {
  return {} as never;
}

function typeShape(
  tuples: ReadonlyMap<Type, readonly {
    readonly type: Type;
    readonly elementKind: "required" | "optional" | "rest" | "variadic";
  }[]>,
) {
  return {
    isTuple: (value: Type) => tuples.has(value),
    getTupleElementInfos: (value: Type) => tuples.get(value) ?? [],
  } as never;
}
