// WT-6 Effects, order, checks, unwind (spec/inputs/WALKTHROUGH-PROGRAMS.md).
//   function f(): int32 { return 1; }
//   function grow(a: int32[]): int32 { a.push(0); return 1; }
//   export function orderGrow(a: int32[], i: () => int32): int32 { a[i()] += grow(a); return a[0]; }
//   export function orderFixed(a: FixedArray<int32, 4>, i: () => int32): int32 { a[i()] += f(); return a[0]; }
//   export function orderInPlace(opt: Point | undefined): int32 { opt!.count += (opt = undefined, 1); return 0; }
//     (`Point` is held in place: the access decision of `count` says so)
//   export function order(a: int32[], i: () => int32, o: { inner: { x: int32 } },
//                         opt: { count: int32 } | undefined): int32 {
//     a[i()] += f();
//     o.inner.x = f();
//     opt!.count += (opt = undefined, 1);
//     try { return a[0]; } finally { a[0] = 0; }
//   }
// `policy.bounds` and `policy.absent` are the selected failure kinds ("unwind" | "abort") that Rules
// has written into the index and narrowing decisions. Integer `+` is selected as a pure operation.
import { N } from "../names.mjs";
import { DYNAMIC_KEY, SIG, T, builders, callee, checked, direct, endpoint, mapped, narrowed, native, selection, signature, typedBody } from "../typed.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
// WT-4 also declares a function `f`; the two are different definitions.
const SIG_F = signature("wt6.f", [], T.int32);
const SIG_GROW = signature("grow", [["a", T.int32Array]], T.int32);
const SIG_ORDER_GROW = signature("orderGrow", [["a", T.int32Array], ["i", T.fnVoidToInt32]], T.int32);
const SIG_ORDER_FIXED = signature("orderFixed", [["a", T.int32Fixed4], ["i", T.fnVoidToInt32]], T.int32);
const SIG_ORDER_FIXED_BY_REFERENCE = signature("orderFixedByReference", [["a", T.int32Fixed4, "required", null, "byref-readwrite"], ["i", T.fnVoidToInt32]], T.int32);
const SIG_ORDER_IN_PLACE = signature("orderInPlace", [["opt", T.optCounter]], T.int32);
const SIG_ORDER = signature("order", [["a", T.int32Array], ["i", T.fnVoidToInt32], ["o", T.outer], ["opt", T.optCounter]], T.int32);

// The indirect call `i()`: the callee is the value of the parameter; no body is known to the caller.
const callI = (b, local, label) => ({ $: label, ...b.call(b.id("i", local, T.fnVoidToInt32), [], T.int32, () => ({
  callee: { decision: { ...callee("()=>int32", SIG["()=>int32"], [], T.int32).decision,
    advertised: endpoint("()=>int32", "advertised", SIG["()=>int32"], false),
    api: endpoint("()=>int32", "api-signature", SIG["()=>int32"], false) },
    activation: null }, receiver: null, arguments: [] })) });
const callF = (b, label) => ({ $: label, ...b.call(b.global("f", "wt6.f", T.unknown), [], T.int32,
  () => ({ callee: callee("wt6.f", SIG_F, [], T.int32), receiver: null, arguments: [] })) });

const compoundIndex = (b, arrayLocal, arrayType, indexLocation, rhs, labels) =>
  b.expressionStatement({ $: labels.assignment, ...b.assign(
    { $: labels.target, ...b.element(b.id("a", arrayLocal, arrayType), callI(b, 1, labels.index),
      b.readWrite(selection(DYNAMIC_KEY, T.int32, T.int32, indexLocation), T.int32)) },
    "PlusEqualsToken", rhs, T.int32, T.int32, ADD) });
const returnFirst = (b, arrayLocal, arrayType, indexLocation, label) =>
  b.returns({ $: label, ...b.element(b.id("a", arrayLocal, arrayType), b.num("0", T.int32),
    b.read(T.int32, selection(DYNAMIC_KEY, T.int32, T.int32, indexLocation))) });

export function wt6(policy) {
  // The access decision states the receiver and the extent of the carrier (K-3238 point 1): lowering reads both and
  // derives neither from the type. A dense array is a reference to a carrier whose extent can change; a fixed array
  // is storage in place whose extent cannot; the third is a fixed carrier reached through a reference.
  const dense = checked(policy.bounds, "by-reference", N.extentMutable);
  const fixed = checked(policy.bounds, "in-place", N.extentFixed);
  const fixedByReference = checked(policy.bounds, "by-reference", N.extentFixed);

  const g = builders("orderGrow");
  const orderGrow = typedBody("orderGrow", { signature: SIG_ORDER_GROW, completion: T.int32,
    locals: [["a", "parameter", T.int32Array], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Array], [1, "required", T.fnVoidToInt32]],
    root: g.block(
      compoundIndex(g, 0, T.int32Array, dense, { $: "grow(a)", ...g.call(g.global("grow", "grow", T.unknown), [{ $: "a-argument", ...g.id("a", 0, T.int32Array) }], T.int32,
        at => ({ callee: callee("grow", SIG_GROW, [mapped(0, 0)], T.int32), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("a-argument") }] })) },
        { assignment: "a[i()]+=grow(a)", target: "@target", index: "i()" }),
      returnFirst(g, 0, T.int32Array, dense, "a[0]")) });

  const x = builders("orderFixed");
  const orderFixed = typedBody("orderFixed", { signature: SIG_ORDER_FIXED, completion: T.int32,
    locals: [["a", "parameter", T.int32Fixed4], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Fixed4], [1, "required", T.fnVoidToInt32]],
    root: x.block(
      compoundIndex(x, 0, T.int32Fixed4, fixed, callF(x, "f()"), { assignment: "a[i()]+=f()", target: "@target", index: "i()" }),
      returnFirst(x, 0, T.int32Fixed4, direct("in-place"), "a[0]")) });

  // Added for R2 K-1: receiver mode and extent disagree. The fixed array is the caller's storage, reached through a
  // by-reference parameter; its extent cannot change.
  //   function orderFixedByReference(ref a: FixedArray<int32, 4>, i: () => int32): int32 { a[i()] += f(); return a[0]; }
  const r = builders("orderFixedByReference");
  const orderFixedByReference = typedBody("orderFixedByReference", { signature: SIG_ORDER_FIXED_BY_REFERENCE, completion: T.int32,
    locals: [["a", "parameter", T.int32Fixed4], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Fixed4, null, "byref-readwrite"], [1, "required", T.fnVoidToInt32]],
    root: r.block(
      compoundIndex(r, 0, T.int32Fixed4, fixedByReference, callF(r, "f()"), { assignment: "a[i()]+=f()", target: "@target", index: "i()" }),
      returnFirst(r, 0, T.int32Fixed4, direct("by-reference"), "a[0]")) });

  const b = builders("order");
  const order = typedBody("order", { signature: SIG_ORDER, completion: T.int32,
    locals: [["a", "parameter", T.int32Array], ["i", "parameter", T.fnVoidToInt32], ["o", "parameter", T.outer],
      ["opt", "parameter", T.optCounter, true]],
    params: [[0, "required", T.int32Array], [1, "required", T.fnVoidToInt32], [2, "required", T.outer], [3, "required", T.optCounter]],
    root: b.block(
      // a[i()] += f();
      compoundIndex(b, 0, T.int32Array, dense, callF(b, "f()#1"), { assignment: "a[i()]+=f()", target: "@target", index: "i()" }),
      // o.inner.x = f();
      b.expressionStatement({ $: "o.inner.x=f()", ...b.assign(
        { $: "@x", ...b.property(
          { $: "o.inner", ...b.property(b.id("o", 2, T.outer), "inner", b.read(T.inner, selection("inner", T.inner, T.inner, direct("by-reference")))) },
          "x", b.write(selection("x", T.int32, T.int32, direct("by-reference")), T.int32)) },
        "EqualsToken", callF(b, "f()#2"), T.int32, T.int32) }),
      // opt!.count += (opt = undefined, 1);
      b.expressionStatement({ $: "opt!.count+=", ...b.assign(
        { $: "@count", ...b.property(
          { $: "@bang", ...b.nonNull(b.id("opt", 3, T.optCounter), T.counter, narrowed(T.optCounter, T.counter, policy.absent)) },
          "count", b.readWrite(selection("count", T.int32, T.int32, direct("by-reference")), T.int32)) },
        "PlusEqualsToken",
        b.paren(b.sequence({ $: "opt=undefined", ...b.assign(b.target("opt", 3, T.optCounter), "EqualsToken",
          b.global("undefined", "undefined", T.absence), T.absence, T.optCounter) }, b.num("1", T.int32), T.int32), T.int32),
        T.int32, T.int32, ADD) }),
      // try { return a[0]; } finally { a[0] = 0; }
      { $: "try", ...b.tryStatement(
        b.block({ $: "return", ...returnFirst(b, 0, T.int32Array, dense, "a[0]#read") }),
        null,
        b.block(b.expressionStatement({ $: "a[0]=0", ...b.assign(
          { $: "a[0]#write", ...b.element(b.id("a", 0, T.int32Array), b.num("0", T.int32),
            b.write(selection(DYNAMIC_KEY, T.int32, T.int32, dense), T.int32)) },
          "EqualsToken", b.num("0", T.int32), T.int32, T.int32) }))) }) });
  // Section 7 part 8, the WT-6 row, for a type held in place: the narrowed place is the variable's own storage.
  const p = builders("orderInPlace");
  const orderInPlace = typedBody("orderInPlace", { signature: SIG_ORDER_IN_PLACE, completion: T.int32,
    locals: [["opt", "parameter", T.optCounter, true]], params: [[0, "required", T.optCounter]],
    root: p.block(
      p.expressionStatement({ $: "opt!.count+=", ...p.assign(
        { $: "@count", ...p.property(
          { $: "@bang", ...p.nonNull(p.id("opt", 0, T.optCounter), T.counter, narrowed(T.optCounter, T.counter, policy.absent)) },
          "count", p.readWrite(selection("count", T.int32, T.int32, direct("in-place")), T.int32)) },
        "PlusEqualsToken",
        p.paren(p.sequence({ $: "opt=undefined", ...p.assign(p.target("opt", 0, T.optCounter), "EqualsToken",
          p.global("undefined", "undefined", T.absence), T.absence, T.optCounter) }, p.num("1", T.int32), T.int32), T.int32),
        T.int32, T.int32, ADD) }),
      p.returns(p.num("0", T.int32))) });
  return { orderGrow, orderFixed, orderFixedByReference, orderInPlace, order };
}
