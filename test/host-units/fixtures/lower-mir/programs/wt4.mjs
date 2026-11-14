// WT-4 Omission, defaults, supplied absence (spec/inputs/WALKTHROUGH-PROGRAMS.md).
//   let seed: int32 = 7;
//   function next(): int32 { seed = seed + 1; return seed; }
//   export function f(x: int32 | null = next(), y: int32 = x ?? 0): int32 { return (x ?? -1) + y; }
//   export function calls(): int32 { return f() + f(null) + f(undefined) + f(1) + f(1, 2); }
// The two parameter defaults are bodies of their own (section 5 part 1 row 3).
import { PARAMETRIC, SIG, T, bodyId, builders, callee, mapped, native, omittedMapping, signature, typedBody } from "../typed.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
const X_DEFAULT = bodyId("f.x", "default");
const Y_DEFAULT = bodyId("f.y", "default");
const SIG_NEXT = signature("next", [], T.int32);
const SIG_F = signature("f", [["x", T.optInt32, "default", X_DEFAULT], ["y", T.int32, "default", Y_DEFAULT]], T.int32);
const SIG_CALLS = signature("calls", [], T.int32);
const SIG_X_DEFAULT = signature("f.x", [], T.optInt32);
const SIG_Y_DEFAULT = signature("f.y", [], T.int32);
const coalesce = (b, left, right, type, labels) => ({ $: labels.self, ...b.binary({ $: labels.control, ...left }, "QuestionQuestionToken",
  { $: labels.right, ...right }, at => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null,
    demand: { kind: "always" }, role: "short-circuit",
    selection: { kind: "coalesce", control: at(labels.control), right: at(labels.right), disposition: "dynamic" } })) });

export function wt4() {
  const b = builders("f");
  const f = typedBody("f", { signature: SIG_F, completion: T.int32,
    locals: [["x", "parameter", T.optInt32], ["y", "parameter", T.int32]],
    params: [[0, "default", T.optInt32, X_DEFAULT], [1, "default", T.int32, Y_DEFAULT]],
    nestedBodies: [X_DEFAULT, Y_DEFAULT],
    root: b.block(b.returns({ $: "(x??-1)+y", ...b.arithmetic(
      b.paren(coalesce(b, b.id("x", 0, T.optInt32), b.num("-1", T.int32), T.int32, { self: "x??-1", control: "x", right: "-1" }), T.int32),
      "PlusToken", b.id("y", 1, T.int32), T.int32, ADD) })) });

  // The default of x: `next()`.
  const dx = builders("f.x", "default");
  const xDefault = typedBody("f.x", { role: "default", signature: SIG_X_DEFAULT, completion: T.optInt32,
    root: { $: "next()", ...dx.call(dx.global("next", "next", T.unknown), [], T.int32,
      () => ({ callee: callee("next", SIG_NEXT, [], T.int32), receiver: null, arguments: [] })) } });

  // The default of y: `x ?? 0`; it reads the parameter x of f as a capture.
  const dy = builders("f.y", "default");
  const yDefault = typedBody("f.y", { role: "default", signature: SIG_Y_DEFAULT, completion: T.int32,
    locals: [["x", "capture", T.optInt32, false, { body: bodyId("f"), local: 0 }]],
    captures: [{ body: bodyId("f"), local: 0 }],
    root: coalesce(dy, dy.id("x", 0, T.optInt32), dy.num("0", T.int32), T.int32, { self: "x??0", control: "x", right: "0" }) });

  // The ready data Pipeline supplies for the initializer executions f places (section 7 part 1).
  const internal = [
    { instance: { body: X_DEFAULT, bindings: PARAMETRIC }, captures: [], signature: SIG_X_DEFAULT },
    { instance: { body: Y_DEFAULT, bindings: PARAMETRIC }, captures: [{ body: bodyId("f"), local: 0 }], signature: SIG_Y_DEFAULT },
  ];

  const c = builders("calls");
  const omitted = (parameter, body) => ({ kind: "omitted", parameter, value: { kind: "initializer", instance: { body, bindings: PARAMETRIC } } });
  const callF = (label, args, mappings, argumentsOf) => ({ $: label, ...c.call(c.global("f", "f", T.unknown), args, T.int32,
    at => ({ callee: callee("f", SIG_F, mappings, T.int32), receiver: null, arguments: argumentsOf(at) })) });
  const one = (label, argument) => callF(label, [{ $: `${label}#0`, ...argument }], [mapped(0, 0), omittedMapping(1, T.int32)],
    at => [{ kind: "provided", parameter: 0, expression: at(`${label}#0`) }, omitted(1, Y_DEFAULT)]);
  const sum = (left, right) => c.arithmetic(left, "PlusToken", right, T.int32, ADD);
  const calls = typedBody("calls", { signature: SIG_CALLS, completion: T.int32,
    root: c.block(c.returns(sum(sum(sum(sum(
      callF("f()", [], [omittedMapping(0, T.optInt32), omittedMapping(1, T.int32)], () => [omitted(0, X_DEFAULT), omitted(1, Y_DEFAULT)]),
      one("f(null)", c.keyword("NullKeyword", T.absence))),
      one("f(undefined)", c.global("undefined", "undefined", T.absence))),
      one("f(1)", c.num("1", T.int32))),
      callF("f(1,2)", [{ $: "f(1,2)#0", ...c.num("1", T.int32) }, { $: "f(1,2)#1", ...c.num("2", T.int32) }], [mapped(0, 0), mapped(1, 1)],
        at => [{ kind: "provided", parameter: 0, expression: at("f(1,2)#0") }, { kind: "provided", parameter: 1, expression: at("f(1,2)#1") }])))) });
  return { f, xDefault, yDefault, internal, calls, X_DEFAULT, Y_DEFAULT };
}
