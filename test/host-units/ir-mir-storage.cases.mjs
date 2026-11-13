// The cases of storage liveness of a lowered body (`storage-live-before-use`; ir-mir/verify-storage.ts). This file is a
// case module of the MIR bank: test/host-units/ir-mir.test.mjs imports it, and its cases run and are counted there.
// It is not a test entry of its own.
//
// Two kinds of case. Findings are asserted through the public `verifyMir` on complete bodies of one typed source,
//   function storage(p: int32, o?: int32): void { return; }
// so that an expected list is the verifier's whole answer. The work a body costs is asserted on the pass itself with
// an account of the case's own, because `verifyMir` adds the units of the other laws to the same account.
//
// Units, as the pass states them: one for each set node entered by a marker's change (also while the entry set is
// built), by a meet of two different sets, and by the lookup of a use that depends on its block's start (one lookup
// per local per block); one for each block of a sweep after the first; one for each outgoing edge of a block read
// again. A body of at most 32 locals has sets of one node, so each change, meet and lookup is one unit.
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

test("storage work: every set node entered is charged, and a body is refused at every limit below its need", () => {
  // Three units in every body here: `p` and `o` enter the entry set (2), and the prologue's write of `o` is looked up (1).
  exactly(graph(0, [[[], done()]]), 3, [], "no temporary");
  // One marker (1); the use follows the marker in its block and needs no lookup.
  exactly(graph(1, [[[live(2), use(2)], done()]]), 4, [], "begun and used in one block");
  // The use depends on the start of block 0 (1).
  exactly(graph(1, [[[use(2)], done()]]), 4, [finding(0, 0, 2)], "used without a marker");
  // Two uses of one local in one block are one lookup; two locals are two.
  exactly(graph(2, [[[use(2), use(2), use(3)], done()]]), 5, [finding(0, 0, 2), finding(0, 1, 2), finding(0, 2, 3)], "one lookup per local per block");
  // A diamond whose arms bring different sets: markers 2, 3 (2), one meet at block 3 (1), the lookup of block 3 (1).
  exactly(graph(2, [[[live(2)], either(1, 2)], [[live(3)], goto(3)], [[], goto(3)], [[use(2)], done()]]), 7, [], "a meet of two different sets");
  // The same contents on both edges are the same object: the meet enters nothing. Markers 2, 3 and 3 again (3), lookup (1).
  exactly(graph(2, [[[live(2)], either(1, 2)], [[live(3), dead(3)], goto(3)], [[], goto(3)], [[use(2)], done()]]), 6, [], "equal contents meet for nothing");
});

test("storage work: a lowered loop header costs a further sweep, and equal contents on a back edge cost none", () => {
  // Order of reading: prologue, 0, 1, 3, 2. First sweep: marker of block 0 (1), marker of block 2 (1), the meet at
  // block 1 that lowers it (1). Second sweep from block 1: three blocks (3); block 1 again has two edges (2) and meets
  // at blocks 2 and 3 (2); block 3 again has no edge; block 2 again has one edge (1) and its marker (1). Lookups: the
  // use in block 1, the end marker in block 2, the prologue (3). With the entry set (2): 17.
  exactly(graph(1, [[[live(2)], goto(1)], [[use(2)], either(2, 3)], [[dead(2)], goto(1)], [[], done()]]), 17,
    [finding(1, 0, 2), finding(2, 0, 2)], "a local ended on the back edge");
  // Ended in block 2 and begun again in block 4: the back edge brings the header's set, so there is one sweep.
  // Markers 2, 3 in block 0 (2), the end in block 2 (1), the begin in block 4 (1); lookups of 2 and 3 in block 1 (2),
  // of 3 for the end marker in block 2 (1), the prologue (1). With the entry set (2): 10.
  exactly(graph(2, [[[live(2), live(3)], goto(1)], [[use(2), use(3)], either(2, 3)], [[dead(3)], goto(4)], [[], done()], [[live(3)], goto(1)]]), 10,
    [], "equal contents on the back edge");
});

test("storage work: a set of three levels costs three units for each change and lookup", () => {
  // 100 temporaries: the entry set (2 × 3), one marker (3), the prologue's lookup (3).
  exactly(graph(100, [[[live(40), use(40)], done()]]), 12, [], "one marker in a wide body");
  // A meet of sets that differ in one word enters the root, the half and the word (3): markers 40, 100 (6), lookup (3).
  exactly(graph(100, [[[live(40)], either(1, 2)], [[live(100)], goto(3)], [[], goto(3)], [[use(40)], done()]]), 21, [], "a meet in a wide body");
});

test("storage work: the verifier returns the refusal for a body whose storage pass runs out, and never a finding with it", () => {
  // The body with a finding needs four units of this pass and none of the other laws.
  const body = graph(1, [[[use(2)], done()]]);
  for (const maximumWork of [0, 1, 2, 3])
    assert.deepEqual(verifyMir(body, contextOf(maximumWork)), { kind: "resource-limit", body: BODY, dimension: "work", maximum: maximumWork });
  assert.deepEqual(verifyMir(body, contextOf(4)), { kind: "complete", violations: [finding(0, 0, 2)] });
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
