// Inputs added after R1's review of W4-1 (clauses that had no case) and for the ruling on activation (K-3239 item 4).
import { PARAMETRIC, PURE, T, bodyId, builders, callee, core, deepBody, invoking, library, mapped, native, protocol, signature, step, arrayIteration,
  typedBody } from "../typed.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
const LESS = native("<", "int32", [T.int32, T.int32], T.bool);
const EQUAL = native("===", "int32", [T.int32, T.int32], T.bool);

// R1, R2, R12: an operation that is neither a call nor a check and whose selected execution can fail.
//   export function quotient(a: int32, b: int32): int32 { try { return a / b; } catch { return 0; } }
// `execution` is the selected execution of `/`: an invocation that unwinds, one that ends the process, or a pure value.
const SIG_QUOTIENT = signature("quotient", [["a", T.int32], ["b", T.int32]], T.int32);
export function quotient(execution) {
  const b = builders("quotient");
  const program = typedBody("quotient", { signature: SIG_QUOTIENT, completion: T.int32,
    locals: [["a", "parameter", T.int32], ["b", "parameter", T.int32]], params: [[0, "required", T.int32], [1, "required", T.int32]],
    root: b.block({ $: "try", ...b.tryStatement(
      b.block(b.returns({ $: "a/b", ...b.arithmetic(b.id("a", 0, T.int32), "SlashToken", b.id("b", 1, T.int32), T.int32,
        native("/", "int32", [T.int32, T.int32], T.int32, execution)) })),
      b.catchClause(null, b.block({ $: "return 0", ...b.returns(b.num("0", T.int32)) })), null) }) });
  return { program };
}

// R7: a required parameter before a default. The admissible supplied counts are 2 and 1; there is no entry for 0.
//   export function scaled(a: int32, b: int32 = 2): int32 { return a + b; }
const B_DEFAULT = bodyId("scaled.b", "default");
const SIG_SCALED = signature("scaled", [["a", T.int32], ["b", T.int32, "default", B_DEFAULT]], T.int32);
const SIG_B_DEFAULT = signature("scaled.b", [], T.int32);
export function scaled() {
  const b = builders("scaled");
  const program = typedBody("scaled", { signature: SIG_SCALED, completion: T.int32,
    locals: [["a", "parameter", T.int32], ["b", "parameter", T.int32]],
    params: [[0, "required", T.int32], [1, "default", T.int32, B_DEFAULT]], nestedBodies: [B_DEFAULT],
    root: b.block(b.returns({ $: "a+b", ...b.arithmetic(b.id("a", 0, T.int32), "PlusToken", b.id("b", 1, T.int32), T.int32, ADD) })) });
  const internal = [{ instance: { body: B_DEFAULT, bindings: PARAMETRIC }, captures: [], signature: SIG_B_DEFAULT }];
  return { program, internal, B_DEFAULT };
}

// R6: a `return` out of an iteration that has a `finish` step.
//   export function firstZero(row: int32[]): int32 { for (const v of row) { if (v === 0) return 1; } return 0; }
const SIG_FIRST_ZERO = signature("firstZero", [["row", T.int32Array]], T.int32);
export function firstZero() {
  const b = builders("firstZero");
  const program = typedBody("firstZero", { signature: SIG_FIRST_ZERO, completion: T.int32,
    locals: [["row", "parameter", T.int32Array], ["v", "binding", T.int32]], params: [[0, "required", T.int32Array]],
    root: b.block(
      { $: "for", ...b.forOf(b.declarationList([b.variable(b.declName("v", 1), 1, T.int32)]), b.id("row", 0, T.int32Array),
        b.block(b.ifElse({ $: "v===0", ...b.comparison(b.id("v", 1, T.int32), "EqualsEqualsEqualsToken", b.num("0", T.int32), EQUAL) },
          { $: "return 1", ...b.returns(b.num("1", T.int32)) })),
        arrayIteration(T.int32Array, T.int32, { finish: true })) },
      { $: "return 0", ...b.returns(b.num("0", T.int32)) }) });
  return { program };
}

// Part 7: "no native recursion in proportion to source nesting".
const SIG_DEEP = signature("deep", [], T.int32);
export const deep = depth => ({ program: deepBody("deep", SIG_DEEP, depth) });

// K-3239 item 4: the activation of an execution is the first entry of its own graph, once per handle. The caller
// records the selected mode on the creating call and the connection to the body, and nothing that stands for the
// activation.
//   function* gen(): Generator<int32> { yield 1; }                       (activated by the first drive)
//   async function fetched(id: int32): Promise<int32> { return id; }     (activated at creation)
//   export function handles(n: int32): int32 {
//     let s = 0;
//     for (let i = 0; i < n; i++) { for (const v of gen()) { s += v; } }   // one creation site, one handle per iteration; first and repeated drive
//     const idle = gen();                                                   // a handle never driven
//     try { fetched(1); } catch { return -1; }                              // immediate mode: an entry that throws unwinds the creating call
//     return s;
//   }
const SIG_GEN = signature("gen", [], T.unknown);
const SIG_FETCHED = signature("fetched", [["id", T.int32]], T.unknown);
const SIG_HANDLES = signature("handles", [["n", T.int32]], T.int32);
const SIG_GENERATOR_NEXT = signature("Generator.next", [], T.unknown, T.unknown);
const SIG_GENERATOR_RETURN = signature("Generator.return", [], T.unknown, T.unknown);
export const GENERATOR_STEP = { acquire: 0, next: 1, done: 2, value: 3, finish: 4 };
export function handles() {
  const b = builders("handles");
  // The iteration protocol selected for a generator handle: `next` and `finish` are calls of the handle's own members.
  const driven = protocol("iterate", [
    step("acquire", core("iterate.acquire", [T.unknown], T.unknown, invoking("none", false))),
    step("next", library("Generator.next", [T.unknown], T.unknown, invoking("unwind", true)), callee("Generator.next", SIG_GENERATOR_NEXT, [], T.unknown)),
    step("done", core("iterate.done", [T.unknown], T.bool, invoking("none", false))),
    step("value", core("iterate.value", [T.unknown], T.int32, invoking("none", false))),
    step("finish", library("Generator.return", [T.unknown], T.unknown, invoking("unwind", true)), callee("Generator.return", SIG_GENERATOR_RETURN, [], T.unknown)),
  ], T.int32);
  const create = label => ({ $: label, ...b.call(b.global("gen", "gen", T.unknown), [], T.unknown,
    () => ({ callee: callee("gen", SIG_GEN, [], T.unknown, { activation: "when-first-driven" }), receiver: null, arguments: [] })) });
  const program = typedBody("handles", { signature: SIG_HANDLES, completion: T.int32,
    locals: [["n", "parameter", T.int32], ["s", "binding", T.int32, true], ["i", "binding", T.int32, true], ["v", "binding", T.int32], ["idle", "binding", T.unknown]],
    params: [[0, "required", T.int32]],
    root: b.block(
      b.declare([b.variable(b.declName("s", 1), 1, T.int32, b.num("0", T.int32))]),
      { $: "for i", ...b.forLoop(
        b.declarationList([b.variable(b.declName("i", 2), 2, T.int32, b.num("0", T.int32))]),
        { $: "i<n", ...b.comparison(b.id("i", 2, T.int32), "LessThanToken", b.id("n", 0, T.int32), LESS) },
        b.postfix(b.target("i", 2, T.int32, { kind: "read-write", storage: T.int32, read: T.int32, narrowing: null, evidenceIndex: null }), "PlusPlusToken", T.int32, T.int32, ADD),
        b.block({ $: "for v", ...b.forOf(b.declarationList([b.variable(b.declName("v", 3), 3, T.int32)]), create("gen()#loop"),
          b.block(b.expressionStatement({ $: "s+=v", ...b.assign(
            b.target("s", 1, T.int32, { kind: "read-write", storage: T.int32, read: T.int32, narrowing: null, evidenceIndex: null }),
            "PlusEqualsToken", b.id("v", 3, T.int32), T.int32, T.int32, ADD) })),
          driven) })) },
      b.declare([b.variable(b.declName("idle", 4), 4, T.unknown, create("gen()#idle"))]),
      { $: "try", ...b.tryStatement(
        b.block(b.expressionStatement({ $: "fetched(1)", ...b.call(b.global("fetched", "fetched", T.unknown), [{ $: "1", ...b.num("1", T.int32) }], T.unknown,
          at => ({ callee: callee("fetched", SIG_FETCHED, [mapped(0, 0)], T.unknown, [], { activation: "at-creation" }), receiver: null,
            arguments: [{ kind: "provided", parameter: 0, expression: at("1") }] })) })),
        b.catchClause(null, b.block({ $: "return -1", ...b.returns(b.num("-1", T.int32)) })), null) },
      b.returns(b.id("s", 1, T.int32))) });
  return { program };
}

/** The three selections of `/` for `quotient`. */
export const quotients = () => ({
  unwinding: quotient(invoking("unwind", false)).program,
  aborting: quotient(invoking("abort", false)).program,
  pure: quotient(PURE).program,
});
/** The activation mode a creating call's decision carries. */
export const activationOf = item => item.record.callee.resolution.decision.activation;
export const ACTIVATION = { atCreation: "at-creation", whenFirstDriven: "when-first-driven" };

// Part 7: "a node kind the admitted vocabulary excludes".
//   export function excluded(): int32 { with (0) {} return 0; }
const SIG_EXCLUDED = signature("excluded", [], T.int32);
export function excluded() {
  const b = builders("excluded");
  const program = typedBody("excluded", { signature: SIG_EXCLUDED, completion: T.int32,
    root: b.block({ kind: "WithStatement", expression: b.num("0", T.int32), statement: b.block(), tsonic: null }, b.returns(b.num("0", T.int32))) });
  return { program };
}
