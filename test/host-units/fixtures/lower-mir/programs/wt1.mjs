// WT-1 Direct code (spec/inputs/WALKTHROUGH-PROGRAMS.md).
//   export function add(left: int32, right: int32): int32 { return left + right; }
//   export function total(): int32 { return add(20, 22); }
//   export function count(limit: int32): int32 {
//     let current: int32 = 0;
//     while (current < limit) current = current + 1;
//     return current;
//   }
import { T, builders, callee, mapped, native, signature, typedBody } from "../typed.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
const LESS = native("<", "int32", [T.int32, T.int32], T.bool);
const SIG_ADD = signature("add", [["left", T.int32], ["right", T.int32]], T.int32);
const SIG_TOTAL = signature("total", [], T.int32);
const SIG_COUNT = signature("count", [["limit", T.int32]], T.int32);

export function wt1() {
  const a = builders("add");
  const add = typedBody("add", { signature: SIG_ADD, completion: T.int32,
    locals: [["left", "parameter", T.int32], ["right", "parameter", T.int32]],
    params: [[0, "required", T.int32], [1, "required", T.int32]],
    root: a.block(a.returns({ $: "left+right", ...a.arithmetic(a.id("left", 0, T.int32), "PlusToken", a.id("right", 1, T.int32), T.int32, ADD) })) });

  const t = builders("total");
  const total = typedBody("total", { signature: SIG_TOTAL, completion: T.int32,
    root: t.block(t.returns({ $: "add(20,22)", ...t.call(t.global("add", "add", T.unknown), [{ $: "20", ...t.num("20", T.int32) }, { $: "22", ...t.num("22", T.int32) }],
      T.int32, at => ({ callee: callee("add", SIG_ADD, [mapped(0, 0), mapped(1, 1)], T.int32), receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: at("20") }, { kind: "provided", parameter: 1, expression: at("22") }] })) })) });

  const c = builders("count");
  const count = typedBody("count", { signature: SIG_COUNT, completion: T.int32,
    locals: [["limit", "parameter", T.int32], ["current", "binding", T.int32, true]],
    params: [[0, "required", T.int32]],
    root: c.block(
      c.declare([c.variable(c.declName("current", 1), 1, T.int32, c.num("0", T.int32))]),
      { $: "while", ...c.whileLoop(
        { $: "current<limit", ...c.comparison(c.id("current", 1, T.int32), "LessThanToken", c.id("limit", 0, T.int32), LESS) },
        c.expressionStatement(c.assign(c.target("current", 1, T.int32), "EqualsToken",
          { $: "current+1", ...c.arithmetic(c.id("current", 1, T.int32), "PlusToken", c.num("1", T.int32), T.int32, ADD) }, T.int32, T.int32))) },
      c.returns(c.id("current", 1, T.int32))) });
  return { add, total, count };
}
