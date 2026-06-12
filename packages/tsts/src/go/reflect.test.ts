import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TypeOf,
  ValueOf,
  DeepEqual,
  Bool,
  Float64,
  Int64,
  Interface,
  Struct,
  String as StringKind,
  Slice,
  Map as MapKind,
  Invalid,
  Int,
  NewType,
  TypeFor,
  TypeAssert,
  MakeSlice,
  Append,
  Zero,
  VisibleFields,
} from "./reflect.js";

test("reflect.TypeOf(value).Kind() classifies JSON-shaped values", () => {
  assert.equal(TypeOf("hi")?.Kind(), StringKind);
  assert.equal(TypeOf(true)?.Kind(), Bool);
  // JSON numbers decode to Go float64.
  assert.equal(TypeOf(3.5)?.Kind(), Float64);
  assert.equal(TypeOf(42)?.Kind(), Float64);
  assert.equal(TypeOf([1, 2, 3])?.Kind(), Slice);
  assert.equal(TypeOf(new globalThis.Map())?.Kind(), MapKind);
  assert.equal(TypeOf({ a: 1 })?.Kind(), MapKind);
  // nil interface -> nil Type.
  assert.equal(TypeOf(undefined), undefined);
  assert.equal(TypeOf(null), undefined);
});

test("reflect.ValueOf.Kind matches TypeOf", () => {
  assert.equal(ValueOf("x").Kind(), StringKind);
  assert.equal(ValueOf([1]).Kind(), Slice);
  assert.equal(ValueOf(undefined).Kind(), Invalid);
  assert.equal(ValueOf(10n).Kind(), Int64);
});

test("reflect.Value.Len/Index over a slice", () => {
  const v = ValueOf(["a", "b", "c"]);
  assert.equal(v.Len(), 3);
  assert.equal(v.Index(0).String(), "a");
  assert.equal(v.Index(2).Interface(), "c");
});

test("reflect.Value.String/Int/Uint/Bool", () => {
  assert.equal(ValueOf("hello").String(), "hello");
  assert.equal(ValueOf(7).Int(), 7);
  assert.equal(ValueOf(7.9).Int(), 7);
  assert.equal(ValueOf(7).Uint(), 7);
  assert.equal(ValueOf(true).Bool(), true);
});

test("reflect.Value.IsNil / IsValid", () => {
  assert.equal(ValueOf(undefined).IsNil(), true);
  assert.equal(ValueOf(null).IsNil(), true);
  assert.equal(ValueOf([1]).IsNil(), false);
  assert.equal(ValueOf(undefined).IsValid(), false);
  assert.equal(ValueOf(0).IsValid(), true);
});

test("reflect.DeepEqual primitives", () => {
  assert.equal(DeepEqual(1, 1), true);
  assert.equal(DeepEqual(1, 2), false);
  assert.equal(DeepEqual("a", "a"), true);
  assert.equal(DeepEqual(true, false), false);
  assert.equal(DeepEqual(1, "1"), false);
  assert.equal(DeepEqual(undefined, undefined), true);
  assert.equal(DeepEqual(undefined, null), false);
});

test("reflect.DeepEqual arrays/objects/maps", () => {
  assert.equal(DeepEqual([1, 2, 3], [1, 2, 3]), true);
  assert.equal(DeepEqual([1, 2], [1, 2, 3]), false);
  assert.equal(DeepEqual([1, [2, 3]], [1, [2, 3]]), true);
  assert.equal(DeepEqual([1, [2, 3]], [1, [2, 4]]), false);

  assert.equal(DeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  assert.equal(DeepEqual({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(DeepEqual({ a: { x: 1 } }, { a: { x: 1 } }), true);

  const m1 = new globalThis.Map<string, number>([["a", 1]]);
  const m2 = new globalThis.Map<string, number>([["a", 1]]);
  const m3 = new globalThis.Map<string, number>([["a", 2]]);
  assert.equal(DeepEqual(m1, m2), true);
  assert.equal(DeepEqual(m1, m3), false);

  // Cross-kind: array vs object are not deeply equal.
  assert.equal(DeepEqual([1], { 0: 1 }), false);
});

test("reflect static-type helpers use explicit metadata without runtime guessing", () => {
  const intType = NewType({ kind: Int, name: "int" });
  const sliceType = NewType({ kind: Slice, name: "[]int", elem: intType });
  const structType = NewType({
    kind: Struct,
    name: "Example",
    fields: [{ Name: "Count", Type: intType }],
  });

  assert.equal(TypeFor<string>().Kind(), Interface);
  assert.deepEqual(TypeAssert<string>(ValueOf("x")), ["x", true]);
  assert.deepEqual(MakeSlice(sliceType, 2, 4).Interface(), [0, 0]);
  assert.deepEqual(Append(ValueOf([1]), ValueOf(2), ValueOf(3)).Interface(), [1, 2, 3]);
  assert.equal(Zero(intType).Interface(), 0);
  assert.deepEqual(VisibleFields(structType).map((field) => field.Name), ["Count"]);
});
