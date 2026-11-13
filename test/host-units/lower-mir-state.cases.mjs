// Cases of the lowering state (packages/host/src/lower-mir/state.ts): the size limit of one MIR graph.
// Section 7 part 7 of the lowering specification: "the size of one MIR graph (its count of control points and
// records), charged before allocation"; a refusal for that limit and nothing else. K-3268: a refused record is never
// an identity a caller could use, nothing is recorded after a refusal, and no partly recorded graph leaves the state.
// These cases call the primitives directly, including in ways the producer never does, so that every branch of the
// state is reached. They are loaded by lower-mir.test.mjs, whose coverage gate measures the module.
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
  // After the refusal a known place and a known constant are not answered either (R1): a caller that kept going
  // would otherwise continue with an identity of a graph that is not a body.
  assert.equal(state.placeOfLocal(lowering, 0), null);
  assert.equal(state.constantOperand(lowering, 0, literal), null);
  assert.equal(state.finishBody(lowering), null);
});

test("after a refusal a cached place and a cached constant are not answered (K-3281)", () => {
  // Three records fit: a local, its place and a constant. Both identities are cached before the refusal.
  const lowering = fresh(3);
  const local = state.newLocal(lowering, 0, { kind: "temporary" }, null, origin);
  const place = state.placeOfLocal(lowering, local);
  const constant = state.constantOperand(lowering, 0, literal);
  assert.equal(state.placeOfLocal(lowering, local), place);
  assert.deepEqual(state.constantOperand(lowering, 0, literal), constant);
  assert.deepEqual([place, constant, lowering.records, lowering.refused], [0, { kind: "constant", constant: 0 }, 3, false]);
  // The fourth record is refused for the size limit.
  assert.equal(state.newBlock(lowering, site), null);
  assert.equal(lowering.refused, true);
  const recorded = () => [lowering.locals.length, lowering.places.length, lowering.constants.size, lowering.blocks.length, lowering.entries.length, lowering.records];
  const atRefusal = recorded();
  // Both repeated lookups answer null: no identity lets a caller continue after the refusal.
  assert.equal(state.placeOfLocal(lowering, local), null);
  assert.equal(state.constantOperand(lowering, 0, literal), null);
  assert.deepEqual(recorded(), atRefusal);
  assert.equal(state.finishBody(lowering), null);
});

test("assembly: constants take their canonical order and every reference to a constant follows, in every record that holds one", async () => {
  const { constantKeyOfMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const lowering = fresh(1000);
  const constantOf = value => state.constantOperand(lowering, 0, { kind: "literal", value });
  // Three constants recorded in an order that is not the canonical one.
  const values = [{ kind: "string", value: "x" }, { kind: "boolean", value: true }, { kind: "boolean", value: false }];
  const [text, yes, no] = values.map(constantOf);
  const local = state.newLocal(lowering, 0, { kind: "temporary" }, null, origin);
  const place = state.placeOfLocal(lowering, local);
  const operation = { decision: { kind: "selected", operation: { kind: "boolean-operator", operator: "!" }, operands: [0], result: 0, execution: { kind: "pure" } },
    permissionScope: null };
  const member = { decision: { key: { kind: "text", value: "x" } }, getter: null, setter: null };
  const indexed = state.newPlace(lowering, { kind: "checked", place, projection: { kind: "index", operand: no }, tir: site.tir }, 0, origin);
  state.newPlace(lowering, { kind: "place", place, projection: { kind: "index", operand: { kind: "place", place } }, tir: site.tir }, 0, origin);
  state.newPlace(lowering, { kind: "place", place, projection: { kind: "field", member }, tir: site.tir }, 0, origin);
  const assign = value => ({ ...site, kind: "assign", place, value, step: null });
  const instance = { body: BODY, bindings: { kind: "parametric" } };
  const callee = { decision: {}, activation: null, captures: [] };
  const statements = [assign({ kind: "use", operand: yes }), assign({ kind: "unary", operation, operand: no }),
    assign({ kind: "convert", operation, operand: text, to: 0 }), assign({ kind: "binary", operation, left: yes, right: no }),
    assign({ kind: "aggregate", type: 0, aggregate: { kind: "array", elements: [yes, { kind: "place", place }] } }),
    assign({ kind: "aggregate", type: 0, aggregate: { kind: "object", fields: [{ member, value: no }] } }),
    assign({ kind: "address-of", place, type: 0 }), assign({ kind: "closure", instance, captures: [] }), { ...site, kind: "storage-live", local }];
  const terminators = [
    next => ({ ...site, kind: "switch", operand: yes, targets: [{ constant: text.constant, target: next }, { constant: yes.constant, target: next }, { constant: no.constant, target: next }],
      otherwise: next, step: null }),
    next => ({ ...site, kind: "call", callee: { kind: "indirect", operand: no, resolution: callee }, receiver: text,
      arguments: [{ kind: "value", passing: "by-value", operand: yes }, { kind: "place", passing: "byref-readwrite", place }, { kind: "omitted" }],
      destination: null, next, unwind: { kind: "escape" }, step: null }),
    next => ({ ...site, kind: "call", callee: { kind: "direct", resolution: callee }, receiver: null, arguments: [], destination: null, next,
      unwind: { kind: "escape" }, step: null }),
    next => ({ ...site, kind: "invoke", operation, operands: [text, { kind: "place", place }], destination: null, next, unwind: { kind: "none" }, step: null }),
    next => ({ ...site, kind: "await", operand: yes, destination: place, resume: next, unwind: { kind: "escape" }, step: null }),
    next => ({ ...site, kind: "yield", operand: null, destination: place, resume: next, return: { destination: place, target: next }, unwind: { kind: "escape" }, step: null }),
    next => ({ ...site, kind: "yield", operand: no, destination: place, resume: next, return: { destination: place, target: next }, unwind: { kind: "escape" }, step: null }),
    next => ({ ...site, kind: "delegate", iterator: text, destination: place, resume: next, return: { destination: place, target: next }, unwind: { kind: "escape" }, step: null }),
    () => ({ ...site, kind: "throw", operand: yes, unwind: { kind: "escape" } }),
    () => ({ ...site, kind: "return", value: null }),
    () => ({ ...site, kind: "return", value: text }),
    next => ({ ...site, kind: "goto", target: next }),
    next => ({ ...site, kind: "check", place: indexed, next, unwind: { kind: "abort" } }),
    () => ({ ...site, kind: "unreachable" }),
  ];
  const recorded = [];
  for (const [position, make] of terminators.entries()) {
    const block = state.newBlock(lowering, site);
    state.enterBlock(lowering, block);
    const inBlock = position === 0 ? statements : [];
    for (const statement of inBlock) assert.equal(state.emitStatement(lowering, statement), true);
    const terminator = make(position + 1);
    state.terminate(lowering, terminator);
    recorded.push({ statements: inBlock, terminator });
  }
  const body = state.finishBody(lowering);
  // The constants in the order of their canonical keys.
  const keys = body.constants.map(constant => constantKeyOfMir(constant.type, constant.value));
  assert.deepEqual(keys, [...keys].sort());
  assert.deepEqual(body.constants.map(constant => constant.id), [0, 1, 2]);
  // Independently of the assembly: every constant reference in the recorded records, replaced by the identity of the
  // constant with the same value, gives the assembled records; switch targets follow their constant's order.
  const finalOf = provisional => body.constants.findIndex(constant => constant.value.value.kind === values[provisional].kind
    && constant.value.value.value === values[provisional].value);
  const renumber = value => {
    if (Array.isArray(value)) return value.map(renumber);
    if (value === null || typeof value !== "object") return value;
    if (value.kind === "constant" && typeof value.constant === "number") return { kind: "constant", constant: finalOf(value.constant) };
    if (typeof value.constant === "number" && typeof value.target === "number") return { constant: finalOf(value.constant), target: value.target };
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, renumber(inner)]));
  };
  for (const [position, block] of body.blocks.entries()) {
    const expected = renumber(recorded[position]);
    if (expected.terminator.kind === "switch") expected.terminator.targets.sort((left, right) => left.constant - right.constant);
    assert.deepEqual(block.statements, expected.statements, `block ${position}`);
    assert.deepEqual(block.terminator, expected.terminator, `block ${position}`);
  }
  assert.deepEqual(body.places.map(place => place.base), renumber(lowering.places.map(place => place.base)));
});

test("misuse of the state by its caller is a defect of lower-mir", () => {
  const defect = (run, message) => assert.throws(run, error => error instanceof Error && error.cause !== undefined && error.cause.owner === "lower-mir"
    && error.message === message, message);
  let lowering = fresh(100);
  defect(() => state.placeOfLocal(lowering, 9), "a place was asked for a local that does not exist");
  const incomplete = { kind: "instantiated", bindings: { classBindings: [undefined], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  defect(() => state.constantOperand(lowering, 0, { kind: "definition", definition: "D[M[P[p];m];f]", bindings: incomplete }), "a constant's bindings are not complete");
  defect(() => state.emitStatement(lowering, { ...site, kind: "storage-live", local: 0 }), "a statement was emitted with no open block");
  defect(() => state.terminate(lowering, { ...site, kind: "unreachable" }), "a terminator was emitted with no open block");
  defect(() => state.enterBlock(lowering, 0), "a block was entered that cannot receive statements");
  const first = state.newBlock(lowering, site);
  const second = state.newBlock(lowering, site);
  state.enterBlock(lowering, first);
  defect(() => state.enterBlock(lowering, second), "a block was entered while another block was open");
  state.terminate(lowering, { ...site, kind: "unreachable" });
  defect(() => state.enterBlock(lowering, first), "a block was entered that cannot receive statements");
  defect(() => state.finishBody(lowering), "a block was left without a terminator");
  lowering = fresh(100);
  state.enterBlock(lowering, state.newBlock(lowering, site));
  state.terminate(lowering, { ...site, kind: "return", value: { kind: "constant", constant: 7 } });
  defect(() => state.finishBody(lowering), "an operand names a constant that was never emitted");
});

test("a known constant is one record, and asking for it again is not charged", () => {
  const lowering = fresh(1);
  const first = state.constantOperand(lowering, 0, literal);
  assert.deepEqual(state.constantOperand(lowering, 0, literal), first);
  assert.equal(lowering.records, 1);
  assert.equal(lowering.refused, false);
});
