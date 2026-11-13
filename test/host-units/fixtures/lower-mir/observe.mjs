// Readers over a lowered body (MirBody). They report what a reader of the record can observe:
// control points with their failure kinds, the order of records along a chosen path, entries,
// place chains. They compute nothing about what a correct lowering should be.

const EFFECT_KINDS = new Set(["call", "invoke", "await", "yield", "delegate", "throw", "check"]);

export const blockOf = (mir, id) => {
  const block = mir.blocks.find(candidate => candidate.id === id);
  if (block === undefined) throw new Error(`Block ${id} does not exist.`);
  return block;
};

/** "handler" | "escape" | "abort" | "none" | null (the terminator has no failure arm). */
export const failureOf = terminator => {
  if (!("unwind" in terminator)) return null;
  const kind = terminator.unwind.kind;
  return kind === "abort" ? "abort" : kind === "none" ? "none" : kind;
};

/** Every outgoing edge of a terminator, as { edge, target }. */
export function edgesOf(terminator) {
  const unwind = "unwind" in terminator && terminator.unwind.kind === "handler" ? [{ edge: "unwind", target: terminator.unwind.target }] : [];
  switch (terminator.kind) {
    case "goto": return [{ edge: "normal", target: terminator.target }];
    case "switch": return [...terminator.targets.map(target => ({ edge: "case", constant: target.constant, target: target.target })),
      { edge: "otherwise", target: terminator.otherwise }];
    case "call": case "invoke": case "check": return [{ edge: "normal", target: terminator.next }, ...unwind];
    case "await": return [{ edge: "resume", target: terminator.resume }, ...unwind];
    case "yield": case "delegate": return [{ edge: "resume", target: terminator.resume },
      { edge: "return", target: terminator.return.target }, ...unwind];
    case "throw": return unwind;
    case "return": case "unreachable": return [];
    default: throw new Error(`Unknown terminator kind ${terminator.kind}.`);
  }
}

/** The JavaScript value of a literal constant: boolean, bigint, string, or null for absence. */
export function constantValue(mir, id) {
  const constant = mir.constants.find(candidate => candidate.id === id);
  if (constant === undefined || constant.value.kind !== "literal") return undefined;
  const literal = constant.value.value;
  switch (literal.kind) {
    case "boolean": case "string": return literal.value;
    case "number": return literal.value.numerator;
    case "bigint": return literal.value;
    case "absence": return null;
    default: return undefined;
  }
}

const event = (mir, block, record, statement) => ({
  block: block.id, statement, kind: record.kind, node: record.tir.node,
  failure: statement === null ? failureOf(record) : null,
  step: statement === null && "step" in record ? record.step : null, record,
});

/** Every control point of the body, in block order. */
export const controlPoints = mir => mir.blocks.map(block => event(mir, block, block.terminator, null));
export const effects = mir => controlPoints(mir).filter(point => EFFECT_KINDS.has(point.kind));
export const checks = (mir, node = null) =>
  effects(mir).filter(point => point.kind === "check" && (node === null || point.node === node));
export const at = (mir, node, kind = null) =>
  effects(mir).filter(point => point.node === node && (kind === null || point.kind === kind));

/**
 * Follows one path from an entry. `decide(event, mir)` chooses the edge of each control point:
 * "normal" (default), "unwind", "resume", "return", or for a switch the JavaScript value of the
 * constant to take ("otherwise" when none matches). Returns every statement and terminator
 * executed, in order, and how the path ended.
 */
export function walk(mir, { entry = 0, decide = () => "normal", limit = 2000 } = {}) {
  const entries = mir.entries;
  let current = entries === undefined ? 0 : entries[entry].block;
  const events = [];
  for (let steps = 0; steps < limit; steps += 1) {
    const block = blockOf(mir, current);
    block.statements.forEach((statement, index) => events.push(event(mir, block, statement, index)));
    const terminator = block.terminator;
    const point = event(mir, block, terminator, null);
    events.push(point);
    if (terminator.kind === "return") return { events, end: "return" };
    if (terminator.kind === "unreachable") return { events, end: "unreachable" };
    const choice = decide(point, mir);
    if (terminator.kind === "switch") {
      const target = terminator.targets.find(candidate => constantValue(mir, candidate.constant) === choice);
      current = target === undefined ? terminator.otherwise : target.target;
      continue;
    }
    if (terminator.kind === "throw" || choice === "unwind") {
      if (point.failure === "handler") { current = terminator.unwind.target; continue; }
      return { events, end: point.failure === "abort" ? "abort" : "unwind" };
    }
    const edge = edgesOf(terminator).find(candidate => candidate.edge === choice) ??
      edgesOf(terminator).find(candidate => candidate.edge === "normal" || candidate.edge === "resume");
    if (edge === undefined) throw new Error(`No edge ${choice} at block ${block.id}.`);
    current = edge.target;
  }
  throw new Error("The path did not end within the walk limit.");
}

/** The control points on a walked path that execute an effect or a check, as { kind, node, failure, step }. */
export const effectsOn = path => path.events.filter(item => item.statement === null && EFFECT_KINDS.has(item.kind));
export const nodesOn = (path, kinds = EFFECT_KINDS) =>
  path.events.filter(item => item.statement === null && kinds.has(item.kind)).map(item => item.node);

export const placeOf = (mir, id) => {
  const place = mir.places.find(candidate => candidate.id === id);
  if (place === undefined) throw new Error(`Place ${id} does not exist.`);
  return place;
};
/** The chain of a place from its root: [{ base }, { projection, access, resolved }, …]. */
export function chainOf(mir, id) {
  const place = placeOf(mir, id);
  if (place.base.kind === "local" || place.base.kind === "static") return [{ root: place.base, place: id }];
  return [...chainOf(mir, place.base.place),
    { projection: place.base.projection, access: place.base.tir, resolved: place.base.kind === "checked", place: id }];
}
export const rootLocalOf = (mir, id) => {
  const root = chainOf(mir, id)[0].root;
  return root.kind === "local" ? root.local : null;
};
export const localOf = (mir, id) => {
  const local = mir.locals.find(candidate => candidate.id === id);
  if (local === undefined) throw new Error(`Local ${id} does not exist.`);
  return local;
};
/** How many records write exactly this local (assign statements and terminator destinations). */
export function writesOf(mir, local) {
  const isLocalPlace = id => id !== null && id !== undefined && placeOf(mir, id).base.kind === "local" && placeOf(mir, id).base.local === local;
  let count = 0;
  for (const block of mir.blocks) {
    for (const statement of block.statements) if (statement.kind === "assign" && isLocalPlace(statement.place)) count += 1;
    if (isLocalPlace(block.terminator.destination)) count += 1;
  }
  return count;
}
/** The place a check control point resolves, with its parent root local and its index operand. */
export function checkedPlace(mir, point) {
  const place = placeOf(mir, point.record.place);
  const projection = place.base.projection;
  return { place: place.id, projection: projection.kind, parentRoot: rootLocalOf(mir, place.base.place),
    index: projection.kind === "index" ? projection.operand : null, access: place.base.tir };
}
/** A deep copy with every failure arm of a check or invocation replaced by one marker. */
export function withoutFailureKinds(mir) {
  const copy = structuredClone(mir);
  for (const block of copy.blocks) {
    const terminator = block.terminator;
    if ((terminator.kind === "check" || terminator.kind === "invoke") && "unwind" in terminator) terminator.unwind = { kind: "*" };
  }
  return copy;
}
export const entriesOf = mir => mir.entries;
export const invert = labels => new Map([...labels].map(([label, id]) => [id, label]));

/** The declaration name of the Core or library operation an invoke executes, or null. */
export const operationName = record => {
  if (record.kind !== "invoke") return null;
  const identity = record.operation.decision.operation;
  return identity.kind === "core" || identity.kind === "library" ? identity.declaration : null;
};
/** True when `point` is a switch whose operand was produced by an invoke of the named operation. */
export function branchesOn(mir, point, declaration) {
  if (point.kind !== "switch" || point.record.operand.kind !== "place") return false;
  return mir.blocks.some(block => operationName(block.terminator) === declaration && block.terminator.destination === point.record.operand.place);
}
/**
 * Every path from an entry, taking each alternative of each switch the first time its block is reached. A block
 * reached again takes an alternative other than its first one, so that every loop is left. Bounded by `limit` paths.
 */
export function allPaths(mir, { entry = 0, decide = () => "normal", limit = 256 } = {}) {
  const results = [];
  const explore = script => {
    if (results.length >= limit) return;
    let position = 0;
    let undecided = null;
    const first = new Map();
    const path = walk(mir, { entry, decide: (point, body) => {
      if (point.kind !== "switch") return decide(point, body);
      const options = [...point.record.targets.map(target => constantValue(mir, target.constant)), "otherwise"];
      if (first.has(point.block)) return options[first.get(point.block) === 0 ? options.length - 1 : 0];
      let choice = 0;
      if (position < script.length) choice = script[position];
      else if (undecided === null) undecided = options.length;
      position += 1;
      first.set(point.block, choice);
      return options[choice];
    } });
    if (undecided === null) { results.push(path); return; }
    for (let option = 0; option < undecided; option += 1) explore([...script, option]);
  };
  explore([]);
  return results;
}

// ---- readers of record shapes: the cases name facts, these functions know where a record holds them ----
const lastLink = (mir, place) => chainOf(mir, place).at(-1);
/** The member key of the last projection of a place, or null when it is not a field. */
export const fieldKeyOf = (mir, place) => {
  const link = lastLink(mir, place);
  return link.projection !== undefined && link.projection.kind === "field" ? link.projection.member.decision.key.value : null;
};
const isAssign = item => item.statement !== null && item.kind === "assign";
/** The kind of value an assignment computes ("use", "binary", "closure", …), or null for another record. */
export const valueKindOf = item => isAssign(item) ? item.record.value.kind : null;
/** True when the statement copies the value of a place whose last projection is the named field. */
export const readsField = (mir, item, key) => valueKindOf(item) === "use" && item.record.value.operand.kind === "place" &&
  fieldKeyOf(mir, item.record.value.operand.place) === key;
/** True when the statement stores into a place whose last projection is the named field. */
export const storesField = (mir, item, key) => isAssign(item) && fieldKeyOf(mir, item.record.place) === key;
export const storedRootOf = (mir, item) => rootLocalOf(mir, item.record.place);
export const storedChainLengthOf = (mir, item) => chainOf(mir, item.record.place).length;
export const isCall = item => item.statement === null && item.kind === "call";
export const isInternalCall = item => isCall(item) && item.record.callee.kind === "body";
export const internalCallsOn = path => path.events.filter(isInternalCall);
/** The body an internal call executes, or the declaration a selected callee names. */
export const calleeNameOf = item => isInternalCall(item) ? item.record.callee.instance.body
  : item.record.callee.resolution.decision.advertised.declaration;
export const argumentKindsOf = item => item.record.arguments.map(argument => argument.kind);
export const destinationRootOf = (mir, item) => rootLocalOf(mir, item.record.destination);
export const destinationChainOf = (mir, item) => chainOf(mir, item.record.destination);
export const destinationBaseOf = (mir, item) => item.record.destination === null ? null : placeOf(mir, item.record.destination).base;
export const destinationFieldOf = (mir, item) => fieldKeyOf(mir, item.record.destination);
export const capturedLocalsOf = item => item.record.callee.captures.map(capture => capture.local);
export const capturedRootsOf = (mir, item) => item.record.callee.captures.map(capture => rootLocalOf(mir, capture.place));
/** The root local of a call's receiver, or null when the receiver is not a place. */
export const receiverRootOf = (mir, item) => item.record.receiver !== null && item.record.receiver.kind === "place"
  ? rootLocalOf(mir, item.record.receiver.place) : null;
export const operationKindOf = item => item.record.operation.decision.operation.kind;
/** True when the record creates the closure of its node, as a statement or as a control point. */
export const createsClosure = item => item.statement === null ? item.kind === "invoke" : valueKindOf(item) === "closure";
export const blocksWithStatementAt = (mir, node) => mir.blocks.filter(block => block.statements.some(statement => statement.tir.node === node));
export const providedCountsOf = mir => entriesOf(mir).map(entry => entry.provided);
