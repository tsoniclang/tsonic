// WT-5, WT-8, WT-9, WT-10, WT-11 and S-1 (spec/inputs/WALKTHROUGH-PROGRAMS.md).
import { DYNAMIC_KEY, EMPTY_BINDINGS, PURE, T, arrayIteration, bodyId, builders, callee, checked, core, decided, def, direct, invoking,
  mapped, narrowed, native, operation, protocol, selected, selection, signature, step, typedBody, value } from "../typed.mjs";

const ADD = native("+", "int32", [T.int32, T.int32], T.int32);
const LESS = native("<", "int32", [T.int32, T.int32], T.bool);
const CONCAT = selected({ kind: "string-operator", operator: "+" }, [T.string, T.string], T.string);
const NOT_ABSENT = selected({ kind: "absence-test", negated: true }, [T.unknown], T.bool);
const direct0 = (b, name, signatureId, result, label, args = [], mappings = [], argumentsOf = () => []) => ({ $: label,
  ...b.call(b.global(name, name, T.unknown), args, result, at => ({ callee: callee(name, signatureId, mappings, result), receiver: null, arguments: argumentsOf(at) })) });
const string = (b, text) => ({ kind: "StringLiteral", text, tokenFlags: [], tsonic: { ...value(T.string), role: "value", value: text } });
const compound = (b, local, right, label, calculation, type) => b.expressionStatement({ $: label, ...b.assign(
  b.target("target", local, type, { kind: "read-write", storage: type, read: type, narrowing: null, evidenceIndex: null }),
  "PlusEqualsToken", right, type, type, calculation) });

// WT-9
//   async function load(id: int32): Promise<string> { return String(id); }
//   export async function all(ids: int32[]): Promise<string> {
//     let out = "";
//     try { for (const id of ids) { out += await load(id); } } finally { out += "."; }
//     return out;
//   }
//   export function* take(n: int32): Generator<int32> { for (let i = 0; i < n; i++) yield i; }
// Added for "consumer-finish through enclosing cleanups" (section 7 part 8):
//   function* guarded(): Generator<int32> { try { yield 1; } finally { done(); } }
const SIG_LOAD = signature("load", [["id", T.int32]], T.unknown);
const SIG_ALL = signature("all", [["ids", T.int32Array]], T.unknown);
const SIG_TAKE = signature("take", [["n", T.int32]], T.unknown);
const SIG_GUARDED = signature("guarded", [], T.unknown);
const SIG_DONE = signature("done", [], T.void);
const AWAIT = protocol("await", [step("await", core("await", [T.unknown], T.string, invoking("unwind", true)))], T.string);
const YIELD = protocol("yield", [], T.int32);
export function wt9() {
  const b = builders("all");
  const all = typedBody("all", { signature: SIG_ALL, completion: T.unknown, asynchronous: true,
    locals: [["ids", "parameter", T.int32Array], ["out", "binding", T.string, true], ["id", "binding", T.int32]],
    params: [[0, "required", T.int32Array]],
    root: b.block(
      b.declare([b.variable(b.declName("out", 1), 1, T.string, string(b, ""))]),
      { $: "try", ...b.tryStatement(
        b.block({ $: "for", ...b.forOf(b.declarationList([b.variable(b.declName("id", 2), 2, T.int32)]), b.id("ids", 0, T.int32Array),
          b.block(compound(b, 1, { $: "await", ...b.awaits(
            direct0(b, "load", SIG_LOAD, T.unknown, "load(id)", [{ $: "id-argument", ...b.id("id", 2, T.int32) }], [mapped(0, 0)],
              at => [{ kind: "provided", parameter: 0, expression: at("id-argument") }]), T.string, AWAIT) }, "out+=await", CONCAT, T.string)),
          arrayIteration(T.int32Array, T.int32)) }),
        null,
        b.block(compound(b, 1, string(b, "."), "out+=.", CONCAT, T.string))) },
      b.returns(b.id("out", 1, T.string))) });

  const t = builders("take");
  const take = typedBody("take", { signature: SIG_TAKE, completion: T.void, generator: true, yielded: T.int32,
    locals: [["n", "parameter", T.int32], ["i", "binding", T.int32, true]], params: [[0, "required", T.int32]],
    root: t.block(t.forLoop(
      t.declarationList([t.variable(t.declName("i", 1), 1, T.int32, t.num("0", T.int32))]),
      { $: "i<n", ...t.comparison(t.id("i", 1, T.int32), "LessThanToken", t.id("n", 0, T.int32), LESS) },
      { $: "i++", ...t.postfix(t.target("i", 1, T.int32, { kind: "read-write", storage: T.int32, read: T.int32, narrowing: null, evidenceIndex: null }),
        "PlusPlusToken", T.int32, T.int32, ADD) },
      t.expressionStatement({ $: "yield i", ...t.yields(t.id("i", 1, T.int32), T.unknown, YIELD) }))) });

  const g = builders("guarded");
  const guarded = typedBody("guarded", { signature: SIG_GUARDED, completion: T.void, generator: true, yielded: T.int32,
    root: g.block({ $: "try", ...g.tryStatement(
      g.block(g.expressionStatement({ $: "yield 1", ...g.yields(g.num("1", T.int32), T.unknown, YIELD) })),
      null,
      g.block(g.expressionStatement(direct0(g, "done", SIG_DONE, T.void, "done()")))) }) });
  return { all, take, guarded };
}

// WT-10
//   function pure(): void {}
//   function clear(p: { x: { v: int32 } | null }): void { p.x = null; }
//   export function read(o: { x: { v: int32 } | null }, a: int32[]): int32 {
//     let sum = 0;
//     for (let i = 0; i < a.length; i++) sum += a[i];
//     if (o.x !== null) { pure(); sum += o.x.v; }
//     if (o.x !== null) { clear(o); return o.x.v + sum; }
//     return sum;
//   }
const SIG_PURE = signature("pure", [], T.void);
const SIG_CLEAR = signature("clear", [["p", T.holder]], T.void);
const SIG_READ = signature("read", [["o", T.holder], ["a", T.int32Array]], T.int32);
export function wt10(policy) {
  const b = builders("read");
  const ox = label => ({ $: label, ...b.property(b.id("o", 0, T.holder), "x", b.read(T.optBoxV, selection("x", T.optBoxV, T.optBoxV, direct("by-reference")))) });
  const narrowedV = (label, valueLabel) => ({ $: valueLabel, ...b.property(
    { $: label, ...b.property(b.id("o", 0, T.holder), "x", b.read(T.boxV, selection("x", T.optBoxV, T.optBoxV, direct("by-reference")),
      { narrowing: narrowed(T.optBoxV, T.boxV, policy.absent) })) },
    "v", b.read(T.int32, selection("v", T.int32, T.int32, direct("by-reference")))) });
  const guard = label => ({ $: label, ...b.comparison(ox(`${label}#o.x`), "ExclamationEqualsEqualsToken", b.keyword("NullKeyword", T.absence), NOT_ABSENT) });
  const program = typedBody("read", { signature: SIG_READ, completion: T.int32,
    locals: [["o", "parameter", T.holder], ["a", "parameter", T.int32Array], ["sum", "binding", T.int32, true], ["i", "binding", T.int32, true]],
    params: [[0, "required", T.holder], [1, "required", T.int32Array]],
    root: b.block(
      b.declare([b.variable(b.declName("sum", 2), 2, T.int32, b.num("0", T.int32))]),
      { $: "for", ...b.forLoop(
        b.declarationList([b.variable(b.declName("i", 3), 3, T.int32, b.num("0", T.int32))]),
        { $: "i<a.length", ...b.comparison(b.id("i", 3, T.int32), "LessThanToken",
          b.property(b.id("a", 1, T.int32Array), "length", b.read(T.int32, selection("length", T.int32, null, direct("by-reference")))), LESS) },
        b.postfix(b.target("i", 3, T.int32, { kind: "read-write", storage: T.int32, read: T.int32, narrowing: null, evidenceIndex: null }), "PlusPlusToken", T.int32, T.int32, ADD),
        compound(b, 2, { $: "a[i]", ...b.element(b.id("a", 1, T.int32Array), b.id("i", 3, T.int32),
          b.read(T.int32, selection(DYNAMIC_KEY, T.int32, T.int32, checked(policy.bounds, "by-reference")))) }, "sum+=a[i]", ADD, T.int32)) },
      b.ifElse(guard("guard#1"), b.block(b.expressionStatement(direct0(b, "pure", SIG_PURE, T.void, "pure()")),
        compound(b, 2, narrowedV("o.x#1", "o.x.v#1"), "sum+=o.x.v", ADD, T.int32))),
      b.ifElse(guard("guard#2"), b.block(
        b.expressionStatement(direct0(b, "clear", SIG_CLEAR, T.void, "clear(o)", [{ $: "o-argument", ...b.id("o", 0, T.holder) }], [mapped(0, 0)],
          at => [{ kind: "provided", parameter: 0, expression: at("o-argument") }])),
        b.returns(b.arithmetic(narrowedV("o.x#2", "o.x.v#2"), "PlusToken", b.id("sum", 2, T.int32), T.int32, ADD)))),
      b.returns(b.id("sum", 2, T.int32))) });
  return { program };
}

// WT-11
//   export function write(): uint32 {
//     unsafecontext();
//     let value: uint32 = 1;
//     const raw = torawptr(addressof(value), wordLayout);
//     const pointer = reinterpretrawptr(raw, wordLayout);
//     if (pointer !== undefined) storeptr(pointer, 7);
//     return value;
//   }
// The Core laws are Rules' selections: the three address computations are pure; the store writes existing storage and
// cannot fail; a raw access carries no check.
const SIG_WRITE = signature("write", [], T.uint32);
const CORE_SIGNATURES = Object.fromEntries([["unsafecontext", T.void], ["addressof", T.unknown], ["torawptr", T.unknown],
  ["reinterpretrawptr", T.unknown], ["storeptr", T.void]].map(([name, result]) => [name, signature(name, [], result)]));
export function wt11(policy) {
  const b = builders("write");
  const coreCall = (name, label, args, type, decision, mappings, argumentsOf) => ({ $: label, ...b.call(b.global(name, name, T.unknown), args, type,
    at => ({ callee: { ...callee(name, CORE_SIGNATURES[name], mappings, type), activation: null }, receiver: null, arguments: argumentsOf(at) }),
    { operation: operation(decision) }) });
  const provided = (...labels) => at => labels.map((label, parameter) => ({ kind: "provided", parameter, expression: at(label) }));
  const layout = label => ({ $: label, ...b.global("wordLayout", "wordLayout", T.unknown) });
  const OPT_POINTER = T.unknown;
  const program = typedBody("write", { signature: SIG_WRITE, completion: T.uint32,
    locals: [["value", "binding", T.uint32, true], ["raw", "binding", T.unknown], ["pointer", "binding", OPT_POINTER]],
    root: b.block(
      b.expressionStatement(coreCall("unsafecontext", "unsafecontext()", [], T.void, core("unsafecontext", [], T.void, PURE), [], () => [])),
      b.declare([b.variable(b.declName("value", 0), 0, T.uint32, b.num("1", T.uint32))]),
      b.declare([b.variable(b.declName("raw", 1), 1, T.unknown, coreCall("torawptr", "torawptr", [
        coreCall("addressof", "addressof", [{ $: "value-argument", ...b.id("value", 0, T.uint32) }], T.unknown,
          selected({ kind: "pointer-address" }, [T.uint32], T.unknown, PURE), [mapped(0, 0)], provided("value-argument")),
        layout("layout#1")], T.unknown, core("torawptr", [T.unknown, T.unknown], T.unknown, PURE), [mapped(0, 0), mapped(1, 1)], provided("addressof", "layout#1")))]),
      b.declare([b.variable(b.declName("pointer", 2), 2, OPT_POINTER, coreCall("reinterpretrawptr", "reinterpretrawptr",
        [{ $: "raw-argument", ...b.id("raw", 1, T.unknown) }, layout("layout#2")], OPT_POINTER,
        core("reinterpretrawptr", [T.unknown, T.unknown], OPT_POINTER, PURE), [mapped(0, 0), mapped(1, 1)], provided("raw-argument", "layout#2")))]),
      b.ifElse({ $: "pointer!==undefined", ...b.comparison(b.id("pointer", 2, OPT_POINTER), "ExclamationEqualsEqualsToken", b.global("undefined", "undefined", T.absence), NOT_ABSENT) },
        b.expressionStatement(coreCall("storeptr", "storeptr(pointer,7)", [
          { $: "pointer#narrowed", ...b.id("pointer", 2, T.unknown, { value: { narrowing: narrowed(OPT_POINTER, T.unknown, policy.absent) } }) },
          { $: "7", ...b.num("7", T.uint32) }], T.void,
          selected({ kind: "pointer-write" }, [T.unknown, T.uint32], T.void, invoking("none", true)), [mapped(0, 0), mapped(1, 1)], provided("pointer#narrowed", "7")))),
      b.returns(b.id("value", 0, T.uint32))) });
  return { program };
}

// WT-8, the entry `runEither`:
//   function either(c: boolean, a: () => void, b: () => void): int32 { if (c) a(); else b(); return x; }
//   export function runEither(c: boolean): int32 { return either(c, () => { x = 1; }, () => { x = 2; }); }
const SIG_EITHER = signature("either", [["c", T.bool], ["a", T.fnVoidToVoid], ["b", T.fnVoidToVoid]], T.int32);
const SIG_RUN_EITHER = signature("runEither", [["c", T.bool]], T.int32);
export function wt8() {
  const b = builders("runEither");
  const arrow = (label, name) => ({ $: label, kind: "ArrowFunction", modifiers: null, typeParameters: null, parameters: { $list: true, nodes: [] },
    type: null, fullSignature: null, asteriskToken: null, body: null, equalsGreaterThanToken: { kind: "EqualsGreaterThanToken", tsonic: null },
    tsonic: { ...value(T.fnVoidToVoid), callable: { definition: def(name), parameters: [], signatures: [], attributes: [],
      template: { body: bodyId(name), lexicalBindings: EMPTY_BINDINGS, dependence: "parametric" } },
      closure: decided({ carrier: T.fnVoidToVoid, captures: [], execution: PURE }) } });
  const program = typedBody("runEither", { signature: SIG_RUN_EITHER, completion: T.int32,
    locals: [["c", "parameter", T.bool]], params: [[0, "required", T.bool]], nestedBodies: [bodyId("runEither.a"), bodyId("runEither.b")],
    root: b.block(b.returns(direct0(b, "either", SIG_EITHER, T.int32, "either(…)",
      [{ $: "c-argument", ...b.id("c", 0, T.bool) }, arrow("a-closure", "runEither.a"), arrow("b-closure", "runEither.b")],
      [mapped(0, 0), mapped(1, 1), mapped(2, 2)],
      at => ["c-argument", "a-closure", "b-closure"].map((label, parameter) => ({ kind: "provided", parameter, expression: at(label) }))))) });
  return { program };
}

// WT-5: bodies that must not reach lowering, and one that is independent of them.
//   export function broken(): int32 { return missingName; }               (an error resolution)
//   export function generic<T extends number>(value: T): int32 { return value; }   (template: a deferred conversion)
//   export function independent(): int32 { return 7; }
const SIG_INT32 = signature("returns-int32", [], T.int32);
const SIG_GENERIC = signature("generic", [["value", T.unknown]], T.int32);
export function wt5() {
  const e = builders("broken");
  const broken = typedBody("broken", { signature: SIG_INT32, completion: T.int32,
    root: e.block(e.returns({ $: "missingName", kind: "Identifier", text: "missingName",
      tsonic: { ...value(T.int32), role: "value", resolution: { kind: "error", diagnostic: 0 } } })) });
  const d = builders("generic");
  const deferredConversion = { kind: "deferred", deferred: { invocation: { rule: "embed", input: null }, result: T.int32 } };
  const deferred = typedBody("generic", { signature: SIG_GENERIC, completion: T.int32,
    locals: [["value", "parameter", T.unknown]], params: [[0, "required", T.unknown]],
    root: d.block(d.returns({ $: "value", ...d.id("value", 0, T.unknown, { value: { convertedType: T.int32, conversion: deferredConversion } }) })) });
  deferred.tir.dependence = "binding-dependent";
  const i = builders("independent");
  const independent = typedBody("independent", { signature: SIG_INT32, completion: T.int32, root: i.block(i.returns({ $: "7", ...i.num("7", T.int32) })) });
  return { broken, deferred, independent };
}

// S-1, the parts whose lowering does not depend on a contract W2 has not shaped (NEEDS-W4 A7, B2):
//   function pair(): [int32, int32] { return [1, 2]; }
//   export function s1head(): int32 { const [p, q] = pair(); return p + q; }
const SIG_PAIR = signature("pair", [], T.int32Pair);
export function s1() {
  const b = builders("s1head");
  const element = (name, local, label) => ({ $: label, kind: "BindingElement", dotDotDotToken: null, propertyName: null, name: b.declName(name, local), initializer: null,
    tsonic: { role: "binding", declaration: { kind: "local", local: b.localRef(local) }, storage: T.int32, initializer: null } });
  const program = typedBody("s1head", { signature: SIG_INT32, completion: T.int32,
    locals: [["p", "binding", T.int32], ["q", "binding", T.int32]],
    root: b.block(
      b.declare([{ kind: "VariableDeclaration", exclamationToken: null, type: null,
        name: { $: "[p,q]", kind: "ArrayBindingPattern", elements: { $list: true, nodes: [element("p", 0, "p"), element("q", 1, "q")] }, tsonic: { storage: T.int32Pair } },
        initializer: direct0(b, "pair", SIG_PAIR, T.int32Pair, "pair()"),
        tsonic: { declaration: { kind: "local", local: b.localRef(0) }, storage: T.int32Pair, initializer: null } }]),
      b.returns({ $: "p+q", ...b.arithmetic(b.id("p", 0, T.int32), "PlusToken", b.id("q", 1, T.int32), T.int32, ADD) })) });
  return { program };
}
