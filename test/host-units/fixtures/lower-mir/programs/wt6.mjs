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
import { SIG, T, builders, callee, direct, endpoint, mapped, narrowed, native, nativeIndex, selected, selection, signature, typedBody, typedOperation } from "../typed.mjs";
import { nativeFactsFixture } from "../../native-facts.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
// WT-4 also declares a function `f`; the two are different definitions.
const SIG_F = signature("wt6.f", [], T.int32);
const SIG_GROW = signature("grow", [["a", T.int32Array]], T.int32);
const SIG_ORDER_GROW = signature("orderGrow", [["a", T.int32Array], ["i", T.fnVoidToInt32]], T.int32);
const SIG_ORDER_FIXED = signature("orderFixed", [["a", T.int32Fixed4], ["i", T.fnVoidToInt32]], T.int32);
const SIG_ORDER_FIXED_BY_REFERENCE = signature("orderFixedByReference", [["a", T.int32Fixed4, "required", null, "byref-readwrite"], ["i", T.fnVoidToInt32]], T.int32);
const SIG_MUTATE_FIXED = signature("mutateFixed", [["a", T.int32Fixed4, "required", null, "byref-readwrite"]], T.int32);
const SIG_ORDER_FIXED_ALIASED = signature("orderFixedAliased", [["a", T.int32Fixed4], ["i", T.fnVoidToInt32]], T.int32);
const SIG_ORDER_FIXED_REPLACE = signature("orderFixedReplace", [["a", T.int32Fixed4], ["i", T.fnVoidToInt32], ["replacement", T.int32Fixed4]], T.int32);
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

const cleared = b => {
  const original = b.undefined();
  return { ...original, $: "undefined", tsonic: at => {
    const from = { root: { kind: "body", value: b.nodeRef(at("undefined")) }, path: [] };
    const to = { root: { kind: "body", value: b.nodeRef(at("opt=undefined")) }, path: [] };
    const embedding = { kind: "conversion", conversion: "absence", proof: { steps: [{ from, to, rule: "absence", premises: [] }], conclusion: 0 }, check: { kind: "none" } };
    return { ...original.tsonic, convertedType: T.optCounter, conversion: { kind: "convert", role: "assignment",
      operation: typedOperation(selected({ kind: "conversion", from: T.absence, to: T.optCounter, embedding }, [T.absence], T.optCounter)) } };
  } };
};

export function wt6(policy, holding) {
  const nativeFacts = { ...nativeFactsFixture(holding), arrayIndexFailure: policy.bounds,
    fixedArrayIndexFailure: policy.bounds, absentAccessFailure: policy.absent };
  const compoundIndex = (b, arrayLocal, arrayType, failure, rhs, labels) =>
    b.expressionStatement({ $: labels.assignment, ...b.assign(
      { $: labels.target, ...b.element(b.id("a", arrayLocal, arrayType), callI(b, 1, labels.index),
        nativeIndex(arrayType, T.int32, "read-write", failure, nativeFacts)) },
      "PlusEqualsToken", rhs, T.int32, T.int32, ADD) });
  const returnFirst = (b, arrayLocal, arrayType, failure, label) =>
    b.returns({ $: label, ...b.element(b.id("a", arrayLocal, arrayType), b.num("0", T.int32),
      nativeIndex(arrayType, T.int32, "read", failure, nativeFacts)) });
  const g = builders("orderGrow");
  const orderGrow = typedBody("orderGrow", { signature: SIG_ORDER_GROW, completion: T.int32,
    locals: [["a", "parameter", T.int32Array], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Array], [1, "required", T.fnVoidToInt32]],
    root: g.block(
      compoundIndex(g, 0, T.int32Array, policy.bounds, { $: "grow(a)", ...g.call(g.global("grow", "grow", T.unknown), [{ $: "a-argument", ...g.id("a", 0, T.int32Array) }], T.int32,
        at => ({ callee: callee("grow", SIG_GROW, [mapped(0, 0)], T.int32), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("a-argument") }] })) },
        { assignment: "a[i()]+=grow(a)", target: "@target", index: "i()" }),
      returnFirst(g, 0, T.int32Array, policy.bounds, "a[0]")) });

  const x = builders("orderFixed");
  const orderFixed = typedBody("orderFixed", { signature: SIG_ORDER_FIXED, completion: T.int32,
    locals: [["a", "parameter", T.int32Fixed4], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Fixed4], [1, "required", T.fnVoidToInt32]],
    root: x.block(
      compoundIndex(x, 0, T.int32Fixed4, policy.bounds, callF(x, "f()"), { assignment: "a[i()]+=f()", target: "@target", index: "i()" }),
      returnFirst(x, 0, T.int32Fixed4, policy.bounds, "a[0]")) });

  // The by-reference formal lends the caller's inline storage; it does not select the carrier's holding.
  //   function orderFixedByReference(ref a: FixedArray<int32, 4>, i: () => int32): int32 { a[i()] += f(); return a[0]; }
  const r = builders("orderFixedByReference");
  const orderFixedByReference = typedBody("orderFixedByReference", { signature: SIG_ORDER_FIXED_BY_REFERENCE, completion: T.int32,
    locals: [["a", "parameter", T.int32Fixed4], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Fixed4, null, "byref-readwrite"], [1, "required", T.fnVoidToInt32]],
    root: r.block(
      compoundIndex(r, 0, T.int32Fixed4, policy.bounds, callF(r, "f()"), { assignment: "a[i()]+=f()", target: "@target", index: "i()" }),
      returnFirst(r, 0, T.int32Fixed4, policy.bounds, "a[0]")) });

  const aliased = builders("orderFixedAliased");
  const orderFixedAliased = typedBody("orderFixedAliased", { signature: SIG_ORDER_FIXED_ALIASED, completion: T.int32,
    locals: [["a", "parameter", T.int32Fixed4], ["i", "parameter", T.fnVoidToInt32]],
    params: [[0, "required", T.int32Fixed4], [1, "required", T.fnVoidToInt32]],
    root: aliased.block(
      compoundIndex(aliased, 0, T.int32Fixed4, policy.bounds, { $: "mutateFixed(a)", ...aliased.call(
        aliased.global("mutateFixed", "mutateFixed", T.unknown), [{ $: "borrowed", ...aliased.id("a", 0, T.int32Fixed4) }], T.int32,
        at => ({ callee: callee("mutateFixed", SIG_MUTATE_FIXED, [mapped(0, 0, "byref-readwrite")], T.int32), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("borrowed") }] })) },
      { assignment: "+=", target: "@target", index: "i()" }), returnFirst(aliased, 0, T.int32Fixed4, policy.bounds, "a[0]")) });

  const replaced = builders("orderFixedReplace");
  const orderFixedReplace = typedBody("orderFixedReplace", { signature: SIG_ORDER_FIXED_REPLACE, completion: T.int32,
    locals: [["a", "parameter", T.int32Fixed4, true], ["i", "parameter", T.fnVoidToInt32], ["replacement", "parameter", T.int32Fixed4]],
    params: [[0, "required", T.int32Fixed4], [1, "required", T.fnVoidToInt32], [2, "required", T.int32Fixed4]],
    root: replaced.block(compoundIndex(replaced, 0, T.int32Fixed4, policy.bounds,
      replaced.paren(replaced.sequence({ $: "replaced", ...replaced.assign(replaced.target("a", 0, T.int32Fixed4), "EqualsToken",
        replaced.id("replacement", 2, T.int32Fixed4), T.int32Fixed4, T.int32Fixed4) }, replaced.num("1", T.int32), T.int32), T.int32),
      { assignment: "+=", target: "@target", index: "i()" }), returnFirst(replaced, 0, T.int32Fixed4, policy.bounds, "a[0]")) });

  const b = builders("order");
  const order = typedBody("order", { signature: SIG_ORDER, completion: T.int32,
    locals: [["a", "parameter", T.int32Array], ["i", "parameter", T.fnVoidToInt32], ["o", "parameter", T.outer],
      ["opt", "parameter", T.optCounter, true]],
    params: [[0, "required", T.int32Array], [1, "required", T.fnVoidToInt32], [2, "required", T.outer], [3, "required", T.optCounter]],
    root: b.block(
      // a[i()] += f();
      compoundIndex(b, 0, T.int32Array, policy.bounds, callF(b, "f()#1"), { assignment: "a[i()]+=f()", target: "@target", index: "i()" }),
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
          cleared(b), T.optCounter, T.optCounter) }, b.num("1", T.int32), T.int32), T.int32),
        T.int32, T.int32, ADD) }),
      // try { return a[0]; } finally { a[0] = 0; }
      { $: "try", ...b.tryStatement(
        b.block({ $: "return", ...returnFirst(b, 0, T.int32Array, policy.bounds, "a[0]#read") }),
        null,
        b.block(b.expressionStatement({ $: "a[0]=0", ...b.assign(
          { $: "a[0]#write", ...b.element(b.id("a", 0, T.int32Array), b.num("0", T.int32),
            nativeIndex(T.int32Array, T.int32, "write", policy.bounds, nativeFacts)) },
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
          cleared(p), T.optCounter, T.optCounter) }, p.num("1", T.int32), T.int32), T.int32),
        T.int32, T.int32, ADD) }),
      p.returns(p.num("0", T.int32))) });
  return { orderGrow: { ...orderGrow, nativeFacts }, orderFixed: { ...orderFixed, nativeFacts },
    orderFixedByReference: { ...orderFixedByReference, nativeFacts }, orderFixedAliased: { ...orderFixedAliased, nativeFacts },
    orderFixedReplace: { ...orderFixedReplace, nativeFacts }, orderInPlace: { ...orderInPlace, nativeFacts }, order: { ...order, nativeFacts } };
}
