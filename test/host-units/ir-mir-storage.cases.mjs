// The cases of storage liveness of a lowered body (`storage-live-before-use`; ir-mir/verify-storage.ts). This file is a
// case module of the MIR bank: test/host-units/ir-mir.test.mjs imports it, and its cases run and are counted there.
// It is not a test entry of its own.
//
// Two kinds of case. Findings are asserted through the public `verifyMir` on complete bodies of one typed source,
//   function storage(p: int32, o?: int32): void { return; }
// so that an expected list is the verifier's whole answer. The work a body costs is asserted on the pass itself with
// an account of the case's own, because `verifyMir` adds the units of the other laws to the same account.
//
// Units, as the pass states them: one for each node of the empty set as it is made; one for each place visited when
// the locals each place reaches are found; one for each set node entered by a change (a marker, the entry set, a
// place's root local), a union, a meet of two different sets, an enumeration of an operand's locals at a use, and the
// lookup of a use that depends on its block's start (one lookup per local per block); one for each local an
// enumeration visits; one for each block of a sweep after the first; one for each outgoing edge of a block read
// again. A body of at most 32 locals has sets of one node, so each change, union, meet, lookup and enumerated node is
// one unit.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { PARAMETRIC, T, TABLE, bodyId, builders, def, signature, typedBody } from "./fixtures/lower-mir/typed.mjs";

const SIG = signature("storage", [["p", T.int32], ["o", T.optInt32, "optional"]], T.void);
const b = builders("storage");
const source = typedBody("storage", { signature: SIG, completion: T.void,
  locals: [["p", "parameter", T.int32], ["o", "parameter", T.optInt32]],
  params: [[0, "required", T.int32], [1, "optional", T.optInt32]],
  root: { $: "root", ...b.block({ $: "return", ...b.returns(null) }) } });
const BODY = bodyId("storage");
const endpoint = role => ({ declaration: def("storage"), role, signature: SIG, body: BODY });
const declaration = { scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] }, parameterCount: 0,
  endpoints: [endpoint("advertised"), endpoint("api-body")] };
const contextOf = maximumWork => ({ limits: { maximumWork }, source: source.tir, types: TABLE,
  declarationOf: definition => definition === def("storage") ? declaration : null, bodyOwner: body => body === BODY ? def("storage") : null });
const site = label => ({ origin: { module: "M[P[p];m]", start: source.at(label), length: 1, derived: [] }, tir: { body: BODY, node: source.at(label) } });
const AT = site("root");

// Records. Local 0 is `p`, local 1 is `o`, locals 2.. are temporaries of type bool; place n is local n.
const live = local => ({ ...AT, kind: "storage-live", local });
const dead = local => ({ ...AT, kind: "storage-dead", local });
const use = local => ({ ...AT, kind: "assign", place: local, value: { kind: "use", operand: { kind: "place", place: local } }, step: null });
const goto = target => ({ ...AT, kind: "goto", target });
const branch = (operand, first, second) => ({ ...AT, kind: "switch", operand, targets: [{ constant: 1, target: first }], otherwise: second, step: null });
const either = (first, second) => branch({ kind: "constant", constant: 1 }, first, second);
const eitherOn = (local, first, second) => branch({ kind: "place", place: local }, first, second);
const done = () => ({ ...site("return"), kind: "return", value: null });
const temporary = id => ({ id, storage: T.bool, role: { kind: "temporary" }, source: null, origin: AT.origin });
const parameters = () => [{ id: 0, storage: T.int32, role: { kind: "parameter", index: 0 }, source: { body: BODY, local: 0 }, origin: AT.origin },
  { id: 1, storage: T.optInt32, role: { kind: "parameter", index: 1 }, source: { body: BODY, local: 1 }, origin: AT.origin }];
const placesOf = locals => locals.map(local => ({ id: local.id, base: { kind: "local", local: local.id }, storage: local.storage, origin: AT.origin }));

/**
 * A complete body: `blocks` are [statements, terminator] pairs. The omission prologue (the block an execution that
 * omits `o` starts at) is appended as the last block: it writes `o`, then runs `prologue[0]` and ends in `prologue[1]`
 * (by default it goes to block 0). So block 0 is a start that also has a predecessor, in every body.
 */
function graph(temporaries, blocks, prologue = [[], null]) {
  const locals = parameters();
  for (let id = 2; id < temporaries + 2; id += 1) locals.push(temporary(id));
  const all = [...blocks, [[{ ...AT, kind: "assign", place: 1, value: { kind: "use", operand: { kind: "constant", constant: 0 } }, step: null }, ...prologue[0]],
    prologue[1] ?? goto(0)]];
  return { body: BODY, bindings: PARAMETRIC, entries: [{ provided: 2, block: 0 }, { provided: 1, block: blocks.length }], locals,
    constants: [{ id: 0, type: T.optInt32, value: { kind: "literal", value: { kind: "absence" } } },
      { id: 1, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: true } } }],
    places: placesOf(locals), blocks: all.map(([statements, terminator], id) => ({ ...AT, id, statements, terminator })), result: T.void };
}
const finding = (block, statement, local) => ({ rule: "storage-live-before-use", site: { kind: "instruction", body: BODY, block, statement },
  detail: [{ kind: "number", value: local }] });

let verifyMir;
let verifyStorage;
let placeLocations;
let leafOf;
let pairOf;
let withLocal;
let meetLive;
let liveIn;
before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "MIR storage cases require a guarded admission");
  ({ verifyMir } = await import("../../packages/host/dist/ir-mir/index.js"));
  ({ verifyStorage, placeLocations, leafOf, pairOf, withLocal, meetLive, liveIn } = await import("../../packages/host/dist/ir-mir/verify-storage.js"));
});

/** The whole answer of the verifier for a body it verified to the end. */
const found = body => {
  const outcome = verifyMir(body, contextOf(1000000));
  assert.equal(outcome.kind, "complete", "the body was verified to the end, not refused for resources");
  return outcome.violations;
};
/** The pass alone under an account of the case: its findings, the units it charged, and whether it ran out. */
const pass = (body, maximum = Number.MAX_SAFE_INTEGER) => {
  const meter = { spent: 0, maximum, exhausted: false };
  const findings = verifyStorage(body, placeLocations(body), meter);
  return { findings, units: meter.spent, exhausted: meter.exhausted };
};
/** Every limit below `units` is a refusal that reports nothing; `units` itself is the complete answer. */
const exactly = (body, units, findings, label) => {
  assert.deepEqual(pass(body), { findings, units, exhausted: false }, `${label}: units and findings without a limit`);
  for (let maximum = 0; maximum < units; maximum += 1)
    assert.deepEqual(pass(body, maximum).findings.length + (pass(body, maximum).exhausted ? 0 : 1), 0, `${label}: limit ${maximum} reports nothing and is exhausted`);
  assert.deepEqual(pass(body, units), { findings, units, exhausted: false }, `${label}: the exact limit`);
};

test("storage: a use needs a begin marker before it on the way from a start", () => {
  assert.deepEqual(found(graph(1, [[[use(2)], done()]])), [finding(0, 0, 2)]);
  assert.deepEqual(found(graph(1, [[[live(2), use(2)], done()]])), []);
  // The operand of a terminator is a use: the site names the block and no statement.
  assert.deepEqual(found(graph(1, [[[], eitherOn(2, 1, 2)], [[], goto(3)], [[], goto(3)], [[], done()]])), [finding(0, null, 2)]);
  assert.deepEqual(found(graph(1, [[[live(2)], eitherOn(2, 1, 2)], [[], goto(3)], [[], goto(3)], [[], done()]])), []);
});

test("storage: after its end marker a local is not used, and an end marker needs live storage", () => {
  assert.deepEqual(found(graph(1, [[[live(2), dead(2), use(2)], done()]])), [finding(0, 2, 2)]);
  assert.deepEqual(found(graph(1, [[[live(2), use(2), dead(2)], done()]])), []);
  assert.deepEqual(found(graph(1, [[[dead(2)], done()]])), [finding(0, 0, 2)], "an end marker on storage that was never begun");
  assert.deepEqual(found(graph(1, [[[live(2), dead(2), dead(2)], done()]])), [finding(0, 2, 2)], "a second end marker");
  assert.deepEqual(found(graph(1, [[[live(2), dead(2), live(2), dead(2)], done()]])), []);
  // A begin marker on live storage is not a finding of this rule.
  assert.deepEqual(found(graph(1, [[[live(2), live(2), use(2)], done()]])), []);
});

test("storage: the locals present on entry are live at every start, and only they", () => {
  // `p` and `o` are used in block 0 with no marker; the prologue writes `o` at the second start.
  assert.deepEqual(found(graph(0, [[[use(0), use(1)], done()]])), []);
  assert.deepEqual(found(graph(0, [[[dead(0), use(0)], done()]])), [finding(0, 1, 0)], "an entry-present local is ended like any other");
  // Block 1 is reached from block 0, where the temporary is begun, and from the prologue, where it is not.
  const second = prologue => graph(1, [[[live(2)], goto(1)], [[use(2)], done()]], prologue);
  assert.deepEqual(found(second([[], goto(1)])), [finding(1, 0, 2)], "the second start brings no temporary");
  assert.deepEqual(found(second([[live(2)], goto(1)])), []);
  assert.deepEqual(found(second([[], goto(0)])), [], "through block 0 the temporary is begun on every path");
});

test("storage: where paths meet a local is live only if every path brings it", () => {
  const diamond = (first, second) => graph(1, [[[], either(1, 2)], [first, goto(3)], [second, goto(3)], [[use(2), use(2)], done()]]);
  const both = [finding(3, 0, 2), finding(3, 1, 2)];
  assert.deepEqual(found(diamond([live(2)], [])), both, "one arm does not begin it");
  assert.deepEqual(found(diamond([], [live(2)])), both, "the other arm does not begin it");
  assert.deepEqual(found(diamond([live(2)], [live(2), dead(2)])), both, "one arm ends it again");
  assert.deepEqual(found(diamond([live(2)], [live(2)])), []);
  assert.deepEqual(found(diamond([live(2), dead(2), live(2)], [live(2)])), [], "the last marker of an arm decides what it brings");
});

test("storage: findings a block decides from its own markers come first, then those that depend on a block's start", () => {
  // Block 0's use depends on its start; block 1's use follows its own end marker. Today's order is kept.
  assert.deepEqual(found(graph(2, [[[use(2)], goto(1)], [[live(3), dead(3), use(3)], done()]])), [finding(1, 2, 3), finding(0, 0, 2)]);
});

test("storage: a back edge that brings less than its header assumed lowers the header and what follows it", () => {
  const loop = back => graph(1, [[[live(2)], goto(1)], [[use(2)], either(2, 3)], [back, goto(1)], [[], done()]]);
  assert.deepEqual(found(loop([dead(2)])), [finding(1, 0, 2), finding(2, 0, 2)], "ended in the loop: the header's use and the second end");
  assert.deepEqual(found(loop([dead(2), live(2)])), []);
  assert.deepEqual(found(loop([])), []);
  // A block that is its own successor; its two uses of the local await the same start.
  const self = statements => graph(1, [[[live(2)], goto(1)], [statements, either(1, 2)], [[], done()]]);
  assert.deepEqual(found(self([use(2), dead(2)])), [finding(1, 0, 2), finding(1, 1, 2)]);
  assert.deepEqual(found(self([use(2), dead(2), live(2)])), []);
  // Block 0 is a start and a loop header: its start is the entry set met with what the back edge brings.
  assert.deepEqual(found(graph(0, [[[use(0)], either(1, 2)], [[dead(0)], goto(0)], [[], done()]])), [finding(0, 0, 0), finding(1, 0, 0)]);
  assert.deepEqual(found(graph(1, [[[live(2), use(2)], either(1, 2)], [[dead(2)], goto(0)], [[], done()]])), []);
});

test("storage: nested loops and a cycle entered at two blocks reach the same fixed point", () => {
  // Outer header 1, inner header 2. The inner back edge (block 3) ends local 3, the outer one (block 5) ends local 2.
  const nested = (inner, outer) => graph(2, [[[live(2), live(3)], goto(1)], [[use(2)], goto(2)], [[use(3)], either(3, 4)], [inner, goto(2)],
    [[], either(5, 6)], [outer, goto(1)], [[], done()]]);
  assert.deepEqual(found(nested([dead(3)], [dead(2)])), [finding(1, 0, 2), finding(2, 0, 3), finding(3, 0, 3), finding(5, 0, 2)]);
  assert.deepEqual(found(nested([dead(3)], [])), [finding(2, 0, 3), finding(3, 0, 3)], "only the inner loop loses its local");
  assert.deepEqual(found(nested([dead(3), live(3)], [dead(2), live(2)])), []);
  // The cycle of blocks 1 and 2 is entered at both from block 0.
  const entered = second => graph(1, [[[live(2)], either(1, 2)], [[use(2)], either(2, 3)], [second, goto(1)], [[], done()]]);
  assert.deepEqual(found(entered([dead(2)])), [finding(1, 0, 2), finding(2, 0, 2)]);
  assert.deepEqual(found(entered([use(2)])), []);
});

test("storage: a block no start reaches is not judged and brings nothing", () => {
  // Block 1 is unreachable. Its own findings are not reported, and its edge into block 0 does not lower block 0.
  assert.deepEqual(found(graph(1, [[[use(0)], done()], [[dead(0), dead(2), use(2)], goto(0)]])), []);
});

test("storage: sets wider than one word keep each local apart", () => {
  // 72 locals: a set is a tree of three levels over four words. Locals 2, 40, 70 and 100 lie in different words.
  assert.deepEqual(found(graph(100, [[[live(2), live(40), live(70), live(100), use(2), use(40), use(70), use(100)], goto(1)],
    [[use(2), use(40), use(70), use(100), use(41), use(101)], done()]])), [finding(1, 4, 41), finding(1, 5, 101)]);
  // The arms bring different locals of different words; the merge has only what both bring.
  const arms = (first, second) => graph(100, [[[live(2)], either(1, 2)], [first, goto(3)], [second, goto(3)],
    [[use(2), use(40), use(70), use(100)], done()]]);
  assert.deepEqual(found(arms([live(40), live(70)], [live(70), live(100)])), [finding(3, 1, 40), finding(3, 3, 100)]);
  assert.deepEqual(found(arms([live(40), live(70), live(100)], [live(40)])), [finding(3, 2, 70), finding(3, 3, 100)], "the second arm brings less");
  assert.deepEqual(found(arms([live(40)], [live(40), live(70), live(100)])), [finding(3, 2, 70), finding(3, 3, 100)], "the first arm brings less");
  assert.deepEqual(found(arms([live(40), live(70), live(100)], [live(100), live(70), live(40)])), []);
  // Ended and begun again in separate blocks of a loop: the back edge brings the header's own set.
  assert.deepEqual(found(graph(100, [[[live(40), live(100)], goto(1)], [[use(40), use(100)], either(2, 3)], [[dead(100)], goto(4)], [[], done()],
    [[live(100)], goto(1)]])), []);
});

// Every body made by `graph` with t temporaries has 2 + t locals, one place on each, so it costs, besides what each
// case names: the empty set (1); the place pass, one visit and one root per place (2 + t, and 2 + t); and at each use,
// 2 per operand that is a place (its one node and its one local); the prologue's write of `o` is one such operand (2).
// That is 4 + 2t + 2 + 1 = 2t + 7 before the uses of the blocks, written below as "base".
test("storage work: every set node entered is charged, and a body is refused at every limit below its need", () => {
  // Base 7; `p` and `o` enter the entry set (2); the prologue's write of `o` is looked up (1): 10.
  exactly(graph(0, [[[], done()]]), 10, [], "no temporary");
  // Base 9, entry 2, prologue lookup 1; one marker (1); the use `x = x` has two operands on local 2 (4) and follows the
  // marker in its block, so no lookup: 17.
  exactly(graph(1, [[[live(2), use(2)], done()]]), 17, [], "begun and used in one block");
  // The same without the marker (-1), and the use depends on the start of block 0 (1): 17.
  exactly(graph(1, [[[use(2)], done()]]), 17, [finding(0, 0, 2)], "used without a marker");
  // Base 11, entry 2, prologue lookup 1; three uses of two operands each (12); two uses of one local in one block are
  // one lookup, two locals are two (2): 28.
  exactly(graph(2, [[[use(2), use(2), use(3)], done()]]), 28, [finding(0, 0, 2), finding(0, 1, 2), finding(0, 2, 3)], "one lookup per local per block");
  // A diamond whose arms bring different sets: base 11, entry 2, prologue lookup 1; markers 2, 3 (2); one meet at block 3
  // (1); the use in block 3 (4) and its lookup (1): 22.
  exactly(graph(2, [[[live(2)], either(1, 2)], [[live(3)], goto(3)], [[], goto(3)], [[use(2)], done()]]), 22, [], "a meet of two different sets");
  // The same contents on both edges are the same object: the meet enters nothing. Markers 2, 3 and 3 again (3), no
  // meet: 21.
  exactly(graph(2, [[[live(2)], either(1, 2)], [[live(3), dead(3)], goto(3)], [[], goto(3)], [[use(2)], done()]]), 21, [], "equal contents meet for nothing");
});

test("storage work: a lowered loop header costs a further sweep, and equal contents on a back edge cost none", () => {
  // Order of reading: prologue, 0, 1, 3, 2. First sweep: marker of block 0 (1), marker of block 2 (1), the meet at
  // block 1 that lowers it (1). Second sweep from block 1: three blocks (3); block 1 again has two edges (2) and meets
  // at blocks 2 and 3 (2); block 3 again has no edge; block 2 again has one edge (1) and its marker (1). Lookups: the
  // use in block 1, the end marker in block 2, the prologue (3). With the entry set (2): 17. Base 9 and the use in
  // block 1 (4): 30.
  exactly(graph(1, [[[live(2)], goto(1)], [[use(2)], either(2, 3)], [[dead(2)], goto(1)], [[], done()]]), 30,
    [finding(1, 0, 2), finding(2, 0, 2)], "a local ended on the back edge");
  // Ended in block 2 and begun again in block 4: the back edge brings the header's set, so there is one sweep.
  // Markers 2, 3 in block 0 (2), the end in block 2 (1), the begin in block 4 (1); lookups of 2 and 3 in block 1 (2),
  // of 3 for the end marker in block 2 (1), the prologue (1). With the entry set (2): 10. Base 11 and the two uses in
  // block 1 (8): 29.
  exactly(graph(2, [[[live(2), live(3)], goto(1)], [[use(2), use(3)], either(2, 3)], [[dead(3)], goto(4)], [[], done()], [[live(3)], goto(1)]]), 29,
    [], "equal contents on the back edge");
});

test("storage work: a set of three levels costs three units for each change and lookup", () => {
  // 100 temporaries, 102 locals and places, sets of three levels. The empty set (3); the place pass: 102 visits and
  // 102 roots of three units (306); each operand at a use enumerates three nodes and one local (4). Then: the entry
  // set (2 × 3), one marker (3), the use `x = x` (8), the prologue's write (4) and lookup (3): 3 + 102 + 306 + 6 + 3 + 8
  // + 4 + 3 = 435.
  exactly(graph(100, [[[live(40), use(40)], done()]]), 435, [], "one marker in a wide body");
  // A meet of sets that differ in one word enters the root, the half and the word (3): empty set, places, entry and
  // prologue as above (3 + 408 + 6 + 4 + 3), markers 40, 100 (6), the meet (3), the use (8) and its lookup (3): 444.
  exactly(graph(100, [[[live(40)], either(1, 2)], [[live(100)], goto(3)], [[], goto(3)], [[use(40)], done()]]), 444, [], "a meet in a wide body");
});

test("storage work: the verifier returns the refusal for a body whose storage pass runs out, and never a finding with it", () => {
  // The body with a finding needs 17 units of this pass (above) and none of the other laws.
  const body = graph(1, [[[use(2)], done()]]);
  for (let maximumWork = 0; maximumWork < 17; maximumWork += 1)
    assert.deepEqual(verifyMir(body, contextOf(maximumWork)), { kind: "resource-limit", body: BODY, dimension: "work", maximum: maximumWork });
  assert.deepEqual(verifyMir(body, contextOf(17)), { kind: "complete", violations: [finding(0, 0, 2)] });
});

// ---- the locals a place reaches (K-3293, K-3294) ----------------------------------------------------------------
// Places on locals 0..N, then a chain c_1 = place 0[index place 1], c_i = c_{i-1}[index place i]: c_i reaches
// locals 0..i. All locals are begun in block 0, so nothing is looked up and nothing is found.
const placeUse = place => ({ ...AT, kind: "assign", place, value: { kind: "use", operand: { kind: "place", place } }, step: null });
function chain(n, usedEach) {
  const locals = Array.from({ length: n + 1 }, (_, id) => temporary(id));
  const places = placesOf(locals);
  for (let i = 1; i <= n; i += 1)
    places.push({ id: n + i, storage: T.bool, origin: AT.origin,
      base: { kind: "place", place: i === 1 ? 0 : n + i - 1, projection: { kind: "index", operand: { kind: "place", place: i } } } });
  const uses = usedEach ? Array.from({ length: n }, (_, i) => placeUse(n + i + 1)) : [placeUse(2 * n)];
  return { ...record(locals, [[[...locals.map(local => live(local.id)), ...uses], done()]]), places };
}

test("storage work: a chain of projections is linear in places when one place is used, and pays for each requirement when each is used", () => {
  // Units: the empty set (1); the place pass: 2n + 1 visits, n + 1 roots, and one union per chain place (its base's
  // set and its operand's set differ: one node each), n; the n + 1 markers; at each use `c = c`, two operands, each
  // one node and the i + 1 locals of c_i. One place used: 1 + (2n + 1) + (n + 1) + n + (n + 1) + 2(n + 2) = 7n + 8.
  // Every place used once: 5n + 4 + 2·Σ_{i=1..n}(i + 2) = n² + 10n + 4.
  for (const n of [10, 20]) {
    exactly(chain(n, false), 7 * n + 8, [], `chain of ${n}, last used`);
    exactly(chain(n, true), n * n + 10 * n + 4, [], `chain of ${n}, each used`);
  }
  // The place pass alone for 20 against 10: 7·20 + 8 = 148 against 78, the work doubles with the places (plus the
  // constant); with every place used it grows with the requirements recorded, 604 against 204.
});

test("storage work: a place visited first as an index operand, and a union of sets wider than one word, are charged and refused like every set operation", () => {
  // Place 1 = place 0[index place 2]: the place pass enters place 2 from place 1. Locals 0, 1; places 0 and 2 on them.
  // Units: empty set 1; visits 3; roots 2; one union ({0} and {1}) 1; markers 2; the use of place 1, two operands of one
  // node and two locals each (6): 15.
  const forwardOperand = { ...record([temporary(0), temporary(1)], [[[live(0), live(1), placeUse(1)], done()]]),
    places: [{ id: 0, storage: T.bool, origin: AT.origin, base: { kind: "local", local: 0 } },
      { id: 1, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 0, projection: { kind: "index", operand: { kind: "place", place: 2 } } } },
      { id: 2, storage: T.bool, origin: AT.origin, base: { kind: "local", local: 1 } }] };
  exactly(forwardOperand, 15, [], "an operand place entered from the place that indexes by it");
  // 40 locals, sets of two levels. Place 40 = place 0[index place 33] reaches {0, 33}; place 41 = place 1[index place
  // 34] reaches {1, 34}; place 42 = place 40[index place 41] reaches {0, 1, 33, 34}. Units: empty set 2; visits 43;
  // roots 40 × 2; unions: places 40 and 41 enter only their roots (one side of each half is empty), 1 each; place 42
  // enters the root and both words, 3; markers 4 × 2; the use of place 42, two operands of three nodes and four
  // locals each (14): 2 + 43 + 80 + 5 + 8 + 14 = 152.
  const locals = Array.from({ length: 40 }, (_, id) => temporary(id));
  const index = (id, base, operand) => ({ id, storage: T.bool, origin: AT.origin, base: { kind: "place", place: base, projection: { kind: "index", operand: { kind: "place", place: operand } } } });
  const wide = { ...record(locals, [[[live(0), live(1), live(33), live(34), placeUse(42)], done()]]),
    places: [...placesOf(locals), index(40, 0, 33), index(41, 1, 34), index(42, 40, 41)] };
  exactly(wide, 152, [], "a union of two-level sets that differ in both words");
  const missing = { ...wide, blocks: [{ ...wide.blocks[0], statements: [live(0), live(1), live(33), placeUse(42)] }] };
  assert.deepEqual(pass(missing).findings, [finding(0, 3, 34)], "local 34 through the second index operand");
});

test("storage: a use reaches the locals of every index operand on the way, through index operands of index operands, and through a cycle", () => {
  // Place 3 = place 1[index place 2]; place 4 = place 0[index place 3]: a use of place 4 needs locals 0, 1 and 2.
  const locals = [temporary(0), temporary(1), temporary(2)];
  const nested = (begun) => ({ ...record(locals, [[[...begun.map(live), placeUse(4)], done()]]),
    places: [...placesOf(locals),
      { id: 3, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 1, projection: { kind: "index", operand: { kind: "place", place: 2 } } } },
      { id: 4, storage: T.bool, origin: AT.origin, base: { kind: "checked", place: 0, projection: { kind: "index", operand: { kind: "place", place: 3 } }, tir: AT.tir } }] });
  assert.deepEqual(pass(nested([0, 1, 2])).findings, []);
  assert.deepEqual(pass(nested([0, 1])).findings, [finding(0, 2, 2)], "local 2 through the index operand of an index operand, once for the record");
  // A malformed cycle: place 3 = place 0[index place 4], place 4 = place 1[index place 3]. Each reaches locals 0 and 1.
  const cyclic = begun => ({ ...record([temporary(0), temporary(1)], [[[...begun.map(live), placeUse(3)], done()]]),
    places: [...placesOf([temporary(0), temporary(1)]), { id: 2, storage: T.bool, origin: AT.origin, base: { kind: "static" } },
      { id: 3, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 0, projection: { kind: "index", operand: { kind: "place", place: 4 } } } },
      { id: 4, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 1, projection: { kind: "index", operand: { kind: "place", place: 3 } } } }] });
  assert.deepEqual(pass(cyclic([0])).findings, [finding(0, 1, 1)]);
  assert.deepEqual(pass(cyclic([0, 1])).findings, []);
  // A place whose base comes after it has no location, and neither has a place that reaches it: their uses need nothing.
  const forward = { ...record([temporary(0)], [[[placeUse(1), placeUse(2)], done()]]),
    places: [...placesOf([temporary(0)]), { id: 1, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 2, projection: { kind: "field" } } },
      { id: 2, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 0, projection: { kind: "index", operand: { kind: "place", place: 1 } } } }] };
  assert.deepEqual(pass(forward).findings, []);
  // An index operand outside the body's places: no location, nothing needed.
  const outside = { ...record([temporary(0)], [[[placeUse(1)], done()]]),
    places: [...placesOf([temporary(0)]), { id: 1, storage: T.bool, origin: AT.origin, base: { kind: "place", place: 0, projection: { kind: "index", operand: { kind: "place", place: 7 } } } }] };
  assert.deepEqual(pass(outside).findings, []);
});

test("storage work: a block of many edges read again pays for its known edges before reading them (K-3347)", () => {
  // Block 1 uses local 0 and branches by a switch of 50 targets to block 2, otherwise to block 3; block 2 ends local 0
  // and goes back to block 1. Order of reading 0, 1, 3, 2. Units: the empty set 1; the place pass, one visit and one
  // root 2; the use x = x, two operands of one node and one local 4. First sweep: block 0's marker 1; block 1's 51
  // edges bring one object to block 2 and to block 3, no meet; block 2's marker 1 and its meet at block 1 1, which
  // lowers block 1: a second sweep of three blocks 3. Second sweep: block 1 read again pays its 51 known edges 51,
  // meets block 2 once (the 49 other edges bring the same object, nothing entered) 1 and block 3 once 1; block 3 read
  // again has no edge; block 2 read again pays its one edge 1 and its marker 1, and brings block 1 its own start. The
  // lookups of local 0 in block 1 and in block 2 2. Total 70.
  const locals = [temporary(0)];
  const fanout = { ...AT, kind: "switch", operand: { kind: "constant", constant: 0 },
    targets: Array.from({ length: 50 }, (_, constant) => ({ constant, target: 2 })), otherwise: 3, step: null };
  const body = record(locals, [[[live(0)], goto(1)], [[use(0)], fanout], [[dead(0)], goto(1)], [[], done()]]);
  exactly(body, 70, [finding(1, 0, 0), finding(2, 0, 0)], "a 50-target switch in a lowered loop");
});

// ---- the sets themselves: nothing is entered and nothing is made after the account is exhausted --------------
// The set operations answer null when the account is exhausted (K-3282). These cases call them on sets of the case's
// own: `count` is the pass's counter of nodes made, and the two maps hold every node. A tree of three levels covers
// 128 locals in four words; the empty one is three nodes (the word, a half, the root).
const setsUnder = maximum => {
  const sets = { meter: { spent: 0, maximum, exhausted: false }, leaves: new Map(), pairs: new Map(), count: 0 };
  const word = leafOf(sets, 0);
  const half = pairOf(sets, word, word);
  return { sets, empty: pairOf(sets, half, half) };
};
const held = sets => sets.leaves.size + [...sets.pairs.values()].reduce((sum, byHigh) => sum + byHigh.size, 0);
/** A set of the given locals, added in the order given, under no limit; then the account starts again under `maximum`. */
const built = (sets, empty, locals, maximum) => {
  sets.meter.maximum = Number.MAX_SAFE_INTEGER;
  let set = empty;
  for (const local of locals) set = withLocal(sets, set, 128, local, true);
  sets.meter.spent = 0;
  sets.meter.maximum = maximum;
  return set;
};

test("storage sets: a change that runs out answers null and has made no node; within its need it makes one node per level", () => {
  // Local 70 is in the third word: the root, its second half and that word are entered (3 units), and each is made anew.
  // Local 5 is in the first word: the root and its first half are entered before the word.
  for (const local of [70, 5]) {
    for (const maximum of [0, 1, 2]) {
      const { sets, empty } = setsUnder(maximum);
      assert.equal(withLocal(sets, empty, 128, local, true), null, `local ${local} under ${maximum}`);
      assert.deepEqual([sets.meter.spent, sets.meter.exhausted, sets.count, held(sets), sets.leaves.size, sets.pairs.size], [maximum + 1, true, 3, 3, 1, 2],
        `local ${local} under ${maximum}: stopped at the charge that exhausted the account, nothing made`);
    }
    const { sets, empty } = setsUnder(3);
    const set = withLocal(sets, empty, 128, local, true);
    assert.notEqual(set, null);
    assert.deepEqual([sets.meter.spent, sets.meter.exhausted, sets.count, held(sets), sets.leaves.size], [3, false, 6, 6, 2]);
    // The same contents are the same object, and the empty set is reached again by ending the local.
    sets.meter.maximum = 100;
    assert.equal(withLocal(sets, set, 128, local, true), set);
    assert.equal(withLocal(sets, set, 128, local, false), empty);
    assert.equal(sets.count, 6, "no node is made for contents that exist");
  }
});

test("storage sets: a lookup that runs out answers null; within its need it answers for the one local", () => {
  for (const maximum of [0, 1, 2]) {
    const { sets, empty } = setsUnder(maximum);
    const set = built(sets, empty, [70], maximum);
    assert.equal(liveIn(sets, set, 128, 70), null);
    assert.deepEqual([sets.meter.spent, sets.meter.exhausted], [maximum + 1, true]);
  }
  const { sets, empty } = setsUnder(0);
  const set = built(sets, empty, [70, 5], 12);
  assert.deepEqual([70, 5, 6, 71].map(local => liveIn(sets, set, 128, local)), [true, true, false, false]);
  assert.deepEqual([sets.meter.spent, sets.meter.exhausted], [12, false], "three units for each lookup");
});

test("storage sets: a meet that runs out answers null, keeps what it had paid for and makes nothing after", () => {
  // Words as bit sets: A = [{5,6}, {40}, {73,74}, {}], B = [{5,7}, {40,42}, {73,75}, {100}]. Each is added so that the
  // words of the meet, {5} and {73}, were never made on the way; {40} and the empty word exist.
  // The meet enters, in order: the root (1), the first half (2), word 0 (3: makes {5}), word 1 (4: {40} exists) and
  // makes the first half; the second half (5), word 2 (6: makes {73}), word 3 (7: the empty word exists) and makes
  // the second half; then the root. Seven units, five nodes.
  const madeUnder = [0, 0, 0, 1, 2, 2, 3];
  for (const [maximum, made] of madeUnder.entries()) {
    const { sets, empty } = setsUnder(0);
    const left = built(sets, empty, [6, 5, 40, 74, 73], 0);
    const right = built(sets, empty, [7, 5, 42, 40, 75, 73, 100], maximum);
    const before = [sets.count, held(sets)];
    assert.equal(meetLive(sets, left, right), null, `under ${maximum}`);
    assert.deepEqual([sets.meter.spent, sets.meter.exhausted, sets.count - before[0], held(sets) - before[1]], [maximum + 1, true, made, made],
      `under ${maximum}: ${made} node(s) made before the charge that exhausted the account, none after`);
  }
  const { sets, empty } = setsUnder(0);
  const left = built(sets, empty, [6, 5, 40, 74, 73], 0);
  const right = built(sets, empty, [7, 5, 42, 40, 75, 73, 100], 7);
  const before = sets.count;
  const met = meetLive(sets, left, right);
  assert.deepEqual([sets.meter.spent, sets.meter.exhausted, sets.count - before], [7, false, 5]);
  // The meet is the one object of its contents, in either order, and a set meets a set that holds it for nothing more than the entering.
  sets.meter.maximum = Number.MAX_SAFE_INTEGER;
  assert.equal(met, built(sets, empty, [73, 40, 5], Number.MAX_SAFE_INTEGER));
  assert.equal(meetLive(sets, right, left), met);
  assert.equal(meetLive(sets, met, left), met, "a set is the meet of itself and a set that holds it");
  assert.equal(meetLive(sets, left, left), left);
});

// ---- the pass on records the complete verifier refuses for other reasons ---------------------------------------
// The cases below give the pass bodies with defects that other rules report (a block that does not stand at its own
// position, an edge or an entry to a block the body does not have, a marker that names no local) and edges of the
// kinds a typed source of this file does not produce (unwind, resume, suspension return). Only this pass is asked.
const record = (locals, blocks, entries = [{ provided: 0, block: 0 }]) => ({ body: BODY, bindings: PARAMETRIC, entries, locals, constants: [],
  places: placesOf(locals), blocks: blocks.map(([statements, terminator, id], position) => ({ ...AT, id: id ?? position, statements, terminator })), result: T.void });

test("storage: a block that does not stand at its own position is not read, and what only it reaches is not judged", () => {
  const locals = [temporary(0)];
  // Block 1 carries the identity 7. Block 2 is reached only through it.
  assert.deepEqual(pass(record(locals, [[[], goto(1)], [[use(0)], goto(2), 7], [[use(0)], done()]])).findings, []);
  // With block 1 in its place both uses are judged.
  assert.deepEqual(pass(record(locals, [[[], goto(1)], [[use(0)], goto(2)], [[use(0)], done()]])).findings, [finding(1, 0, 0), finding(2, 0, 0)]);
  // Block 2 is ordered before block 3, the only judged block that reaches it: the walk came to it through block 1.
  // Its start arrives when block 3 is read, and it is read in a further sweep with that start.
  const late = record([temporary(0), temporary(1)], [[[live(0)], either(1, 3)], [[], goto(2), 9], [[use(0), use(1)], goto(3)], [[], either(2, 4)], [[], done()]]);
  assert.deepEqual(pass(late).findings, [finding(2, 1, 1)]);
});

test("storage: an edge, an entry and a marker that name nothing in the body are passed over", () => {
  const locals = [temporary(0)];
  assert.deepEqual(pass(record(locals, [[[live(0), use(0)], goto(5)]])).findings, [], "an edge to a block the body does not have");
  assert.deepEqual(pass(record(locals, [[[use(0)], done()]], [{ provided: 0, block: 0 }, { provided: 0, block: 9 }])).findings, [finding(0, 0, 0)],
    "an entry at a block the body does not have");
  assert.deepEqual(pass(record(locals, [[[live(4), dead(-1), use(0)], done()]])).findings, [finding(0, 2, 0)], "markers of locals the body does not have");
  // Position 1 of the locals holds a local of another identity: a marker that names 1 names no local, and neither
  // record of that position is present on entry.
  const misplaced = [temporary(0), { ...temporary(5), role: { kind: "parameter", index: 0 } }];
  assert.deepEqual(pass(record(misplaced, [[[live(1), live(0), use(0)], done()]])).findings, []);
  assert.deepEqual(pass(record([temporary(0)], [])).findings, [], "a body without blocks");
});

test("storage: receiver and capture locals are present on entry like parameters", () => {
  const locals = [{ ...temporary(0), role: { kind: "receiver" } }, { ...temporary(1), role: { kind: "capture", index: 0 } }, temporary(2)];
  assert.deepEqual(pass(record(locals, [[[use(0), use(1), use(2)], done()]])).findings, [finding(0, 2, 2)]);
});

test("storage: unwind, resume and suspension-return edges bring the block's set like any edge, and their destinations are uses", () => {
  // Block 0 yields: it resumes in block 1, returns through block 2 and unwinds to block 3. Local 0 is the value
  // resumed with, local 1 the completion delivered on the return edge, local 2 the exception; local 3 is begun or not.
  const locals = [temporary(0), temporary(1), temporary(2), temporary(3)];
  const yields = { ...AT, kind: "yield", operand: null, destination: 0, resume: 1, return: { target: 2, destination: 1 },
    unwind: { kind: "handler", target: 3, exception: 2 }, step: null };
  const body = first => record(locals, [[first, yields], [[use(3)], done()], [[use(3)], done()], [[use(3)], done()]]);
  assert.deepEqual(pass(body([live(0), live(1), live(2), live(3)])).findings, []);
  assert.deepEqual(pass(body([live(0), live(1), live(2)])).findings, [finding(1, 0, 3), finding(2, 0, 3), finding(3, 0, 3)], "each edge is followed");
  assert.deepEqual(pass(body([live(3)])).findings, [finding(0, null, 0), finding(0, null, 1), finding(0, null, 2)], "each destination is a use at the terminator");
});
