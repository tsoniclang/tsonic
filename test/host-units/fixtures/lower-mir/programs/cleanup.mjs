// S-2, S-3, S-6 (spec/inputs/WALKTHROUGH-PROGRAMS.md): exits through cleanup.
import { N } from "../names.mjs";
import { T, arrayIteration, builders, callee, declareType, def, direct, invoking, library, mapped, narrowed, native, operation,
  protocol, selected, selection, signature, step, typedBody } from "../typed.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
const SUB = native("-", "int32", [T.int32, T.int32], T.int32);
const LESS = native("<", "int32", [T.int32, T.int32], T.bool);
const EQUAL = native("===", "int32", [T.int32, T.int32], T.bool);
const member = (key, type) => ({ key: { kind: "text", value: key }, origins: [], readOrigins: [], writeOrigins: [], kind: "property",
  read: type, write: type, optional: false, readonly: true });
const FAILURE = declareType("failure", { kind: "shape", members: [member("code", T.int32)], indexes: [], calls: [], constructs: [] });
const RES = declareType("res", { kind: "shape", members: [member("log", T.int32Array)], indexes: [], calls: [], constructs: [] });
const SIG_S2 = signature("s2", [["k", T.int32], ["m", T.int32Rows]], T.int32);
const SIG_RISKY = signature("risky", [["n", T.int32]], T.int32);
const SIG_S3 = signature("s3", [["n", T.int32]], T.int32);
const SIG_FAILURE = signature("Failure.constructor", [["code", T.int32]], FAILURE);
const SIG_RES = signature("Res.constructor", [["log", T.int32Array]], RES);
const SIG_DISPOSE = signature("Res.dispose", [], T.void, RES);
const SIG_S6 = signature("s6", [["log", T.int32Array], ["fail", T.bool]], T.int32);

// S-2
//   export function s2(k: int32, m: int32[][]): int32 {
//     let r = 0;
//     switch (k) { case 1: r += 1; case 2: r += 2; break; default: r = 9; }
//     outer: for (const row of m) { for (const v of row) { if (v < 0) continue outer; if (v === 0) break outer; r += v; } }
//     return r;
//   }
// Both iterations are given a `finish` step so that every exit of a loop has a cleanup to pass (unit cases may vary the selection).
// Each case clause carries the selected equality of its test (NEEDS-W4 G1): lowering does not choose how `k` is compared.
export function s2() {
  const b = builders("s2");
  const tested = (label, clause) => ({ $: label, ...clause, tsonic: { [N.caseTest]: operation(EQUAL) } });
  const bump = (label, right, operator = "PlusEqualsToken", calculation = ADD) => b.expressionStatement({ $: label,
    ...b.assign(b.target("r", 2, T.int32, operator === "EqualsToken" ? { kind: "write", storage: T.int32 }
      : { kind: "read-write", storage: T.int32, read: T.int32, narrowing: null, evidenceIndex: null }), operator, right, T.int32, T.int32,
      operator === "EqualsToken" ? null : calculation) });
  const program = typedBody("s2", { signature: SIG_S2, completion: T.int32,
    locals: [["k", "parameter", T.int32], ["m", "parameter", T.int32Rows], ["r", "binding", T.int32, true], ["row", "binding", T.int32Array], ["v", "binding", T.int32]],
    params: [[0, "required", T.int32], [1, "required", T.int32Rows]],
    root: b.block(
      b.declare([b.variable(b.declName("r", 2), 2, T.int32, b.num("0", T.int32))]),
      { $: "switch", ...b.switchStatement(b.id("k", 0, T.int32), [
        tested("case 1", b.caseClause(b.num("1", T.int32), bump("r+=1", b.num("1", T.int32)))),
        tested("case 2", b.caseClause(b.num("2", T.int32), bump("r+=2", b.num("2", T.int32)), { $: "break", ...b.breaks("switch") })),
        b.defaultClause(bump("r=9", b.num("9", T.int32), "EqualsToken")),
      ]) },
      { $: "outer", ...b.labeled(b.label("outer", "outer"), { $: "for row", ...b.forOf(
        b.declarationList([b.variable(b.declName("row", 3), 3, T.int32Array)]), b.id("m", 1, T.int32Rows),
        b.block({ $: "for v", ...b.forOf(
          b.declarationList([b.variable(b.declName("v", 4), 4, T.int32)]), b.id("row", 3, T.int32Array),
          b.block(
            b.ifElse({ $: "v<0", ...b.comparison(b.id("v", 4, T.int32), "LessThanToken", b.num("0", T.int32), LESS) },
              { $: "continue outer", ...b.continues("for row", b.label("outer", "outer")) }),
            b.ifElse({ $: "v===0", ...b.comparison(b.id("v", 4, T.int32), "EqualsEqualsEqualsToken", b.num("0", T.int32), EQUAL) },
              { $: "break outer", ...b.breaks("outer", b.label("outer", "outer")) }),
            bump("r+=v", b.id("v", 4, T.int32))),
          arrayIteration(T.int32Array, T.int32, { finish: true })) }),
        arrayIteration(T.int32Rows, T.int32Array, { finish: true })) }, "outer") },
      b.returns(b.id("r", 2, T.int32))) });
  return { program };
}

// S-3
//   class Failure { constructor(readonly code: int32) {} }
//   function risky(n: int32): int32 { if (n < 0) throw new Failure(n); return n; }
//   export function s3(n: int32): int32 {
//     try { return risky(n); } catch (e) { if (e instanceof Failure) return e.code - 100; throw e; }
//   }
// `variant` is the selected failure kind of the variant test at the narrowed use of `e`.
const newFailure = (b, label, argument, argumentLabel) => ({ $: label, ...b.construct(b.global("Failure", "Failure", T.unknown),
  [{ $: argumentLabel, ...argument }], FAILURE, at => ({ callee: callee("Failure.constructor", SIG_FAILURE, [mapped(0, 0)], FAILURE), receiver: null,
    arguments: [{ kind: "provided", parameter: 0, expression: at(argumentLabel) }] })) });
export function s3(variant) {
  const r = builders("risky");
  const risky = typedBody("risky", { signature: SIG_RISKY, completion: T.int32,
    locals: [["n", "parameter", T.int32]], params: [[0, "required", T.int32]],
    root: r.block(
      r.ifElse({ $: "n<0", ...r.comparison(r.id("n", 0, T.int32), "LessThanToken", r.num("0", T.int32), LESS) },
        { $: "throw", ...r.throws(newFailure(r, "new Failure(n)", r.id("n", 0, T.int32), "n-argument")) }),
      r.returns(r.id("n", 0, T.int32))) });

  const b = builders("s3");
  const INSTANCE_OF = selected({ kind: "type-query" }, [T.unknown], T.bool);
  const program = typedBody("s3", { signature: SIG_S3, completion: T.int32,
    locals: [["n", "parameter", T.int32], ["e", "catch", T.unknown]], params: [[0, "required", T.int32]],
    root: b.block({ $: "try", ...b.tryStatement(
      b.block(b.returns({ $: "risky(n)", ...b.call(b.global("risky", "risky", T.unknown), [{ $: "n-argument", ...b.id("n", 0, T.int32) }], T.int32,
        at => ({ callee: callee("risky", SIG_RISKY, [mapped(0, 0)], T.int32), receiver: null,
          arguments: [{ kind: "provided", parameter: 0, expression: at("n-argument") }] })) })),
      b.catchClause(b.variable(b.declName("e", 1), 1, T.unknown), b.block(
        b.ifElse({ $: "e instanceof Failure", ...b.comparison(b.id("e", 1, T.unknown), "InstanceOfKeyword", b.global("Failure", "Failure", T.unknown), INSTANCE_OF) },
          b.returns(b.arithmetic(
            { $: "e.code", ...b.property({ $: "e#narrowed", ...b.id("e", 1, FAILURE, { value: { narrowing: narrowed(T.unknown, FAILURE, variant) } }) },
              "code", b.read(T.int32, selection("code", T.int32, T.int32, direct(N.reference)))) },
            "MinusToken", b.num("100", T.int32), T.int32, SUB))),
        { $: "throw e", ...b.throws(b.id("e", 1, T.unknown)) })),
      null) }) });
  return { risky, program };
}

// S-6
//   class Res { constructor(readonly log: int32[]) {} [Symbol.dispose](): void { this.log.push(1); } }
//   export function s6(log: int32[], fail: boolean): int32 {
//     try { using r = new Res(log); if (fail) throw new Failure(0); return log.length; } catch { return log.length; }
//   }
export function s6() {
  const b = builders("s6");
  const length = label => ({ $: label, ...b.property(b.id("log", 0, T.int32Array), "length", b.read(T.int32, selection("length", T.int32, null, direct(N.reference)))) });
  const dispose = protocol("dispose", [step("dispose", library("Res.dispose", [RES], T.void, invoking(N.failureUnwind, N.effectWrite)),
    callee("Res.dispose", SIG_DISPOSE, [], T.void))], T.void);
  const program = typedBody("s6", { signature: SIG_S6, completion: T.int32,
    locals: [["log", "parameter", T.int32Array], ["fail", "parameter", T.bool], ["r", "binding", RES]],
    params: [[0, "required", T.int32Array], [1, "required", T.bool]],
    root: b.block({ $: "try", ...b.tryStatement(
      b.block(
        b.declare([b.variable(b.declName("r", 2), 2, RES, { $: "new Res(log)", ...b.construct(b.global("Res", "Res", T.unknown),
          [{ $: "log-argument", ...b.id("log", 0, T.int32Array) }], RES, at => ({ callee: callee("Res.constructor", SIG_RES, [mapped(0, 0)], RES), receiver: null,
            arguments: [{ kind: "provided", parameter: 0, expression: at("log-argument") }] })) })],
          { role: "using", asynchronous: false, protocols: [{ kind: "decided", decision: dispose }] }),
        b.ifElse({ $: "fail", ...b.id("fail", 1, T.bool) }, { $: "throw", ...b.throws(newFailure(b, "new Failure(0)", b.num("0", T.int32), "0-argument")) }),
        b.returns(length("log.length#try"))),
      b.catchClause(null, b.block(b.returns(length("log.length#catch")))),
      null) }) });
  return { program, disposeDeclaration: def("Res.dispose") };
}
