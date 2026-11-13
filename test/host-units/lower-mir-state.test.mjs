// Cases of the lowering state (packages/host/src/lower-mir/state.ts): the size limit of one MIR graph.
// Section 7 part 7 of the lowering specification: "the size of one MIR graph (its count of control points and
// records), charged before allocation"; a refusal for that limit and nothing else. K-3268: a refused record is never
// an identity a caller could use, nothing is recorded after a refusal, and no partly recorded graph leaves the state.
// The producer that calls these primitives (lowerToMir) does not exist yet; these cases call the primitives as it will.
import assert from "node:assert/strict";
import { before, test } from "node:test";

let state;
const BODY = "B[D[M[P[p];m];f];function;0]";
const origin = { module: "M[P[p];m]", start: 0, length: 1, derived: [] };
const site = { origin, tir: { body: BODY, node: 0 } };
const literal = { kind: "literal", value: { kind: "boolean", value: true } };

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "lowering state cases require a guarded admission");
  state = await import("../../packages/host/dist/lower-mir/state.js");
});

/** One small graph, written as a lowering would: a local, its place, a constant, a block with one statement and a return. */
function record(lowering) {
  const steps = [];
  const local = state.newLocal(lowering, 0, { kind: "temporary" }, null, origin);
  steps.push(["local", local]);
  // A caller uses an identity only when it was given one.
  const place = local === null ? null : state.placeOfLocal(lowering, local);
  steps.push(["place", place]);
  const constant = state.constantOperand(lowering, 0, literal);
  steps.push(["constant", constant]);
  const block = state.newBlock(lowering, site);
  steps.push(["block", block]);
  if (block !== null) state.enterBlock(lowering, block);
  const emitted = place !== null && constant !== null
    && state.emitStatement(lowering, { ...site, kind: "assign", place, value: { kind: "use", operand: constant }, step: null });
  steps.push(["statement", emitted]);
  state.terminate(lowering, { ...site, kind: "return", value: null });
  if (block !== null) state.addEntry(lowering, { provided: 0, block });
  return steps;
}
const fresh = maximumRecords => state.createState(BODY, { kind: "parametric" }, 0, { maximumRecords });

test("at its limit a graph is recorded whole; the limit counts each record once and a block with its terminator once", () => {
  // The graph of `record` is five records: a local, a place, a constant, a block, a statement.
  const lowering = fresh(5);
  const steps = record(lowering);
  assert.deepEqual(steps.map(([, value]) => value !== null && value !== false), [true, true, true, true, true]);
  assert.equal(lowering.refused, false);
  const body = state.finishBody(lowering);
  assert.notEqual(body, null);
  assert.deepEqual([body.locals.length, body.places.length, body.constants.length, body.blocks.length, body.blocks[0].statements.length, body.entries.length],
    [1, 1, 1, 1, 1, 1]);
  assert.equal(body.blocks[0].terminator.kind, "return");
});

test("one below its limit the lowering is refused, and no body leaves the state", () => {
  for (let maximumRecords = 0; maximumRecords < 5; maximumRecords += 1) {
    const lowering = fresh(maximumRecords);
    const steps = record(lowering);
    // Every primitive up to the limit answers; the first past it and all after it answer null or false.
    assert.deepEqual(steps.map(([, value]) => value !== null && value !== false),
      [0, 1, 2, 3, 4].map(position => position < maximumRecords), `limit ${maximumRecords}`);
    assert.equal(lowering.refused, true);
    assert.equal(lowering.records, maximumRecords);
    assert.equal(state.finishBody(lowering), null, "what was recorded until the refusal is not a body");
  }
});

test("after a refusal nothing is recorded, entered, ended or added", () => {
  // Three records fit: the local, its place and the constant. The block does not.
  const lowering = fresh(3);
  record(lowering);
  const recorded = () => [lowering.locals.length, lowering.places.length, lowering.constants.size, lowering.blocks.length, lowering.entries.length, lowering.records];
  const beforeMore = recorded();
  assert.deepEqual(beforeMore, [1, 1, 1, 0, 0, 3]);
  // A later caller that kept going would get no identity to use and would change nothing.
  assert.equal(state.newLocal(lowering, 0, { kind: "temporary" }, null, origin), null);
  assert.equal(state.newPlace(lowering, { kind: "local", local: 0 }, 0, origin), null);
  assert.equal(state.newBlock(lowering, site), null);
  assert.equal(state.constantOperand(lowering, 0, { kind: "literal", value: { kind: "boolean", value: false } }), null);
  assert.equal(state.emitStatement(lowering, { ...site, kind: "storage-live", local: 0 }), false);
  state.enterBlock(lowering, 0);
  state.terminate(lowering, { ...site, kind: "unreachable" });
  state.addEntry(lowering, { provided: 0, block: 0 });
  assert.equal(lowering.current, null, "no block was entered: position 0 holds no block of this refused state");
  assert.deepEqual(recorded(), beforeMore);
});

test("a refusal while a block is open leaves that block as it was and is not a defect of the caller", () => {
  // Four records fit: the local, its place, the constant and the block. The statement does not.
  const lowering = fresh(4);
  const steps = record(lowering);
  assert.deepEqual(steps.at(-1), ["statement", false]);
  assert.equal(lowering.blocks[0].statements.length, 0);
  assert.equal(lowering.blocks[0].terminator, null, "the terminator after the refusal was not recorded");
  // The place of a local that has none yet cannot be made any more; the known one is still answered.
  assert.equal(state.placeOfLocal(lowering, 0), 0);
  assert.equal(state.finishBody(lowering), null);
});

test("a known constant is one record, and asking for it again is not charged", () => {
  const lowering = fresh(1);
  const first = state.constantOperand(lowering, 0, literal);
  assert.deepEqual(state.constantOperand(lowering, 0, literal), first);
  assert.equal(lowering.records, 1);
  assert.equal(lowering.refused, false);
});
