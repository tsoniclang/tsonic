import type { DataflowAccount, DataflowResult, NaturalLoop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, graphOfMir, naturalLoops, orderRows, predecessors } from "../dataflow/index.js";
import type { BlockId, LocalId, LocalRef, NodeId, NodeRef, PlaceId, TyId } from "../ids/contract.js";
import { admitIntegerKey } from "../ids/index.js";
import type { ElementAccessExpression, ForStatement, Identifier } from "../ir-hir/contract.js";
import type { MirBlock, MirBody, MirOperand, MirStatement, MirTerminator } from "../ir-mir/contract.js";
import { localOwnershipOfMir, visitMirControlEdges, visitMirStorageExposures } from "../ir-mir/index.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { isNativeIntegerPrimitive, nativeIntegerGeometryOf } from "../ir-types/index.js";
import type { BodyInstance, NativeIntegerPrimitive, ReceiverAccess } from "../ir-types/contract.js";
import type { CountedLoopFact, CountedLoopInputs, CountedLoopProofs, CountedLoopsOf, IntegerRange } from "./contract.js";
import { countedGuardStates } from "./counted-guard.js";
import { selectedMirBody } from "./verification.js";

interface LoopBinding {
  readonly local: LocalId;
  readonly start: BlockId;
  readonly latch: BlockId;
  readonly commit: MirStatement;
}

interface CounterStorage {
  readonly roots: readonly (LocalId | null)[];
  readonly exposedLocals: ReadonlySet<LocalId>;
  readonly exposedSources: ReadonlySet<LocalId>;
}

const empty: CountedLoopProofs = { loops: [], ranges: [], refinements: [] };
const absent: { readonly kind: "complete"; readonly value: null } = { kind: "complete", value: null };

type LoopStart =
  | { readonly kind: "inline"; readonly operand: MirOperand | null }
  | { readonly kind: "placed"; readonly instance: BodyInstance };

interface IndexSite {
  readonly block: MirBlock;
  readonly check: Extract<MirTerminator, { readonly kind: "check" }>;
  readonly node: ElementAccessExpression<TypedPhase>;
  readonly key: Identifier<TypedPhase>;
}

interface IndexSites {
  readonly rows: readonly IndexSite[];
  readonly unique: ReadonlyMap<NodeId, BlockId | null>;
}

interface ExtentBound {
  readonly maximum: bigint;
  readonly receiver: PlaceId;
  readonly holding: ReceiverAccess;
  readonly source: LocalRef | null;
}

interface ProofRows {
  readonly ranges: Map<NodeId, IntegerRange>;
  readonly refinements: Map<NodeId, CountedLoopProofs["refinements"][number]>;
}

function reachingAssignment(block: MirBlock, before: number, place: PlaceId, storage: CounterStorage,
  account: DataflowAccount): DataflowResult<Extract<MirStatement, { readonly kind: "assign" }> | null> {
  const setup = chargeWork(account, 1);
  if (setup !== null) return setup;
  const local = storage.roots[place];
  if (local === undefined || local === null || storage.exposedLocals.has(local)) return absent;
  for (let position = before - 1; position >= 0; position -= 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const statement = block.statements[position];
    if (statement === undefined) return absent;
    if (statement.kind !== "assign") {
      if ((statement.kind === "storage-live" || statement.kind === "storage-dead") && statement.local === local) return absent;
      continue;
    }
    if (storage.roots[statement.place] !== local) continue;
    if (statement.place !== place) return absent;
    return { kind: "complete", value: statement };
  }
  return absent;
}

function sourceLocal(expression: ElementAccessExpression<TypedPhase>["expression"]): LocalRef | null {
  return expression.kind === "Identifier" && expression.tsonic.role === "value" && expression.tsonic.resolution.kind === "local"
    ? expression.tsonic.resolution.local : null;
}

function indexSites(mir: MirBody, sourceOf: CountedLoopInputs["sourceOf"], account: DataflowAccount): DataflowResult<IndexSites> {
  const setup = chargeResultEntries(account, 3);
  if (setup !== null) return setup;
  const rows: IndexSite[] = [];
  const unique = new Map<NodeId, BlockId | null>();
  for (let position = 0; position < mir.blocks.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const block = mir.blocks[position];
    const check = block?.terminator;
    if (block === undefined || check?.kind !== "check" || check.tir.body !== mir.body) continue;
    const sourceRead = chargeWork(account, 1);
    if (sourceRead !== null) return sourceRead;
    const node = sourceOf(check.tir.node);
    if (node?.kind !== "ElementAccessExpression") continue;
    const key = node.argumentExpression;
    if (key.kind !== "Identifier") continue;
    if (unique.has(key.id)) {
      unique.set(key.id, null);
      continue;
    }
    const retained = chargeResultEntries(account, 3);
    if (retained !== null) return retained;
    unique.set(key.id, block.id);
    rows.push({ block, check, node, key });
  }
  return { kind: "complete", value: { rows, unique } };
}

function integerConstant(mir: MirBody, operand: MirOperand | null, type: TyId, account: DataflowAccount): DataflowResult<bigint | null> {
  const before = chargeWork(account, 1);
  if (before !== null) return before;
  if (operand?.kind !== "constant") return absent;
  const rowWork = chargeWork(account, 2);
  if (rowWork !== null) return rowWork;
  const row = mir.constants[operand.constant];
  if (row?.type !== type) return absent;
  const constant = row.value;
  if (constant.kind !== "literal") return absent;
  const literalWork = chargeWork(account, 1);
  if (literalWork !== null) return literalWork;
  const literal = constant.value;
  if (literal.kind !== "number") return absent;
  const rationalWork = chargeWork(account, 3);
  if (rationalWork !== null) return rationalWork;
  const { numerator, denominator, negativeZero } = literal.value;
  const paid = admitIntegerKey(denominator, work => chargeWork(account, work));
  if (paid !== null) return paid;
  if (denominator !== 1n || negativeZero) return absent;
  return admitIntegerKey(numerator, work => chargeWork(account, work)) ?? { kind: "complete", value: numerator };
}

function startingInteger(mir: MirBody, start: LoopStart, at: NodeRef, type: TyId,
  inputs: CountedLoopInputs, account: DataflowAccount): DataflowResult<bigint | null> {
  if (start.kind === "inline") return integerConstant(mir, start.operand, type, account);
  const read = chargeWork(account, 1 + start.instance.body.length);
  if (read !== null) return read;
  const chosen = selectedMirBody({ instance: start.instance, provided: 0 }, inputs, account);
  if (chosen.kind !== "complete") return chosen;
  const selected = chosen.value;
  if (selected === null) return absent;
  const header = chargeWork(account, 3);
  if (header !== null) return header;
  const entries = selected.entries;
  const entry = entries.length === 1 ? entries[0] : undefined;
  const block = entry?.provided === 0 ? selected.blocks[entry.block] : undefined;
  if (block === undefined || block.statements.length !== 0) return absent;
  const end = block.terminator;
  return end.kind === "return" && end.tir.body === at.body && end.tir.node === at.node
    ? integerConstant(selected, end.value, type, account) : absent;
}

function indexRead(mir: MirBody, site: IndexSite, counter: PlaceId, counterSource: LocalId, storage: CounterStorage,
  account: DataflowAccount): DataflowResult<NodeId | null> {
  const beforePlace = chargeWork(account, 2);
  if (beforePlace !== null) return beforePlace;
  const { block, check, key } = site;
  const checked = mir.places[check.place]?.base;
  if (checked?.kind !== "checked" || checked.projection.kind !== "index" || checked.projection.operand.kind !== "place"
    || checked.tir.body !== mir.body || checked.tir.node !== check.tir.node) return absent;
  const index = checked.projection.operand.place;
  if (index === counter) return absent;
  const projected = mir.places[index];
  const local = projected?.base.kind === "local" ? mir.locals[projected.base.local] : undefined;
  if (local?.role.kind !== "temporary" || local.mode !== "local" || storage.exposedLocals.has(local.id)) return absent;
  const annotation = key.tsonic;
  if (!("resolution" in annotation) || annotation.resolution.kind !== "local"
    || annotation.resolution.local.body !== mir.body || annotation.resolution.local.local !== counterSource) return absent;
  const prior = reachingAssignment(block, block.statements.length, index, storage, account);
  if (prior.kind !== "complete") return prior;
  const row = prior.value;
  return row !== null && row.tir.body === mir.body && row.tir.node === key.id && row.value.kind === "use"
    && row.value.operand.kind === "place" && row.value.operand.place === counter ? { kind: "complete", value: key.id } : absent;
}

function nativeExtent(
  mir: MirBody, header: MirBlock, right: MirOperand, source: ForStatement<TypedPhase>["condition"],
  carrier: NativeIntegerPrimitive, storage: CounterStorage, inputs: CountedLoopInputs, account: DataflowAccount,
): DataflowResult<ExtentBound | null> {
  const setup = chargeWork(account, 3);
  if (setup !== null) return setup;
  if (source?.kind !== "PropertyAccessExpression" || source.tsonic.role !== "array-extent"
    || source.tsonic.operation.kind !== "decided" || right.kind !== "place") return absent;
  const row = reachingAssignment(header, header.statements.length - 1, right.place, storage, account);
  if (row.kind !== "complete") return row;
  const assignment = row.value;
  if (assignment?.tir.body !== mir.body || assignment.tir.node !== source.id || assignment.value.kind !== "unary"
    || assignment.value.operand.kind !== "place") return absent;
  const { decision } = assignment.value.operation;
  const selected = source.tsonic.operation.decision.decision;
  if (decision.operation.kind !== "array-extent" || selected.operation.kind !== "array-extent"
    || decision.result !== selected.result || decision.operation.holding !== selected.operation.holding) return absent;
  let stop: ReturnType<typeof chargeWork> = null;
  const geometry = nativeIntegerGeometryOf(carrier, inputs.nativeFacts, work => (stop = chargeWork(account, work)) === null);
  if (stop !== null) return stop;
  if (geometry.kind !== "integer") return absent;
  const retained = chargeResultEntries(account, 1);
  return retained ?? { kind: "complete", value: { maximum: geometry.maximum, receiver: assignment.value.operand.place,
    holding: decision.operation.holding, source: sourceLocal(source.expression) } };
}

function extentReceiver(mir: MirBody, extent: ExtentBound, storage: CounterStorage, account: DataflowAccount): DataflowResult<LocalId | null> {
  const setup = chargeWork(account, 2);
  if (setup !== null) return setup;
  const base = mir.places[extent.receiver]?.base;
  const receiver = base?.kind === "local" ? mir.locals[base.local] : undefined;
  if (receiver === undefined || extent.source === null || extent.source.body !== mir.body
    || receiver.source?.body !== extent.source.body || receiver.source.local !== extent.source.local
    || localOwnershipOfMir(receiver.mode) !== "body" || storage.exposedLocals.has(receiver.id)
    || storage.exposedSources.has(receiver.source.local)) return absent;
  return { kind: "complete", value: receiver.id };
}

function sameReceiver(mir: MirBody, site: IndexSite, extent: ExtentBound, storage: CounterStorage,
  account: DataflowAccount): DataflowResult<boolean> {
  const setup = chargeWork(account, 3);
  if (setup !== null) return setup;
  const base = mir.places[site.check.place]?.base;
  const annotation = site.node.tsonic;
  const expression = site.node.expression;
  const local = sourceLocal(expression);
  if (base?.kind !== "checked" || !("index" in annotation) || annotation.index.holding !== extent.holding
    || local === null || local.body !== mir.body || extent.source?.local !== local.local || extent.source.body !== local.body)
    return { kind: "complete", value: false };
  if (base.place === extent.receiver) return { kind: "complete", value: true };
  if (extent.holding !== "by-reference") return { kind: "complete", value: false };
  const parent = mir.places[base.place];
  const saved = parent?.base.kind === "local" ? mir.locals[parent.base.local] : undefined;
  if (saved?.role.kind !== "temporary" || saved.mode !== "local") return { kind: "complete", value: false };
  const reached = reachingAssignment(site.block, site.block.statements.length, base.place, storage, account);
  if (reached.kind !== "complete") return reached;
  const row = reached.value;
  return { kind: "complete", value: row?.tir.body === mir.body && row.tir.node === expression.id
    && row.value.kind === "use" && row.value.operand.kind === "place" && row.value.operand.place === extent.receiver };
}

function collectRanges(mir: MirBody, range: IntegerRange, counter: PlaceId, counterLocal: LocalId,
  source: LocalId, storage: CounterStorage, sites: IndexSites, rows: ProofRows,
  extent: ExtentBound | null, entry: BlockId, header: MirBlock, first: BlockId,
  guard: NodeId, inputs: CountedLoopInputs, account: DataflowAccount): DataflowResult<null> {
  let flow: ReturnType<typeof countedGuardStates> | null = null;
  for (let position = 0; position < sites.rows.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const site = sites.rows[position];
    if (site === undefined || site.block.id === header.id || sites.unique.get(site.key.id) !== site.block.id) continue;
    const known = indexRead(mir, site, counter, source, storage, account);
    if (known.kind !== "complete") return known;
    if (known.value === null) continue;
    if (flow === null) {
      const receiver = extent === null || range.minimum < 0n ? absent : extentReceiver(mir, extent, storage, account);
      if (receiver.kind !== "complete") return receiver;
      const held = chargeResultEntries(account, 1);
      if (held !== null) return held;
      flow = countedGuardStates(mir, { entry, header, success: first, counter: counterLocal, receiver: receiver.value },
        storage.roots, inputs.summaryAt, account);
    }
    if (flow.kind !== "complete") return flow;
    const strength = flow.value?.get(site.block.id);
    if (strength === undefined || strength === "unproved") continue;
    if (!rows.ranges.has(known.value)) {
      const retained = chargeResultEntries(account, 1);
      if (retained !== null) return retained;
      rows.ranges.set(known.value, range);
    }
    if (extent === null || strength !== "extent" || rows.refinements.has(site.node.id)) continue;
    const exact = sameReceiver(mir, site, extent, storage, account);
    if (exact.kind !== "complete") return exact;
    if (!exact.value) continue;
    const retained = chargeResultEntries(account, 3);
    if (retained !== null) return retained;
    rows.refinements.set(site.node.id, { kind: "proven", node: site.node.id, guards: [guard] });
  }
  return absent;
}

function counterStorage(mir: MirBody, account: DataflowAccount): DataflowResult<CounterStorage> {
  const capacity = chargeResultEntries(account, 4 + mir.places.length);
  if (capacity !== null) return capacity;
  const roots: (LocalId | null)[] = [];
  for (let position = 0; position < mir.places.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const base = mir.places[position]?.base;
    roots.push(base === undefined || base.kind === "static" ? null : base.kind === "local" ? base.local
      : base.projection.kind === "deref" ? null : roots[base.place] ?? null);
  }
  const exposedLocals = new Set<LocalId>();
  const exposedSources = new Set<LocalId>();
  const add = (rows: Set<LocalId>, local: LocalId | null): ReturnType<typeof chargeWork> => {
    const read = chargeWork(account, 1);
    if (read !== null || local === null || rows.has(local)) return read;
    const growth = chargeResultEntries(account, 1);
    if (growth === null) rows.add(local);
    return growth;
  };
  const address = (place: PlaceId) => add(exposedLocals, roots[place] ?? null);
  const stopped = visitMirStorageExposures(mir, {
    admit: () => chargeWork(account, 1),
    address,
    capture: capture => {
      if (capture.capture === "captured-value") return null;
      const paid = address(capture.place) ?? chargeWork(account, 1 + capture.local.body.length);
      return paid ?? (capture.local.body === mir.body ? add(exposedSources, capture.local.local) : null);
    },
  });
  return stopped ?? { kind: "complete", value: { roots, exposedLocals, exposedSources } };
}

function validateBindings(
  mir: MirBody, loop: NaturalLoop, roles: LoopBinding, roots: CounterStorage["roots"], account: DataflowAccount,
): DataflowResult<boolean> {
  const writesCounter = (place: PlaceId | null): boolean => place !== null && roots[place] === roles.local;
  for (let position = 0; position < loop.members.length; position += 1) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    const member = loop.members[position];
    const block = member === undefined ? undefined : mir.blocks[member];
    if (block === undefined) return { kind: "complete", value: false };
    for (let index = 0; index < block.statements.length; index += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const statement = block.statements[index];
      if (statement === undefined || (statement.kind === "assign"
        ? writesCounter(statement.place) && statement !== roles.commit
        : (statement.kind === "storage-live" || statement.kind === "storage-dead") && statement.local === roles.local))
        return { kind: "complete", value: false };
    }
    let crossing = false;
    const edge = visitMirControlEdges(block.terminator, {
      kind: "edges", admit: () => chargeWork(account, 1),
      visit: (_kind, target, destination) => {
        crossing ||= writesCounter(destination) || (target === loop.header && block.id !== roles.latch)
          || target === roles.start;
      },
    });
    if (edge !== null) return edge;
    if (crossing) return { kind: "complete", value: false };
  }
  return { kind: "complete", value: true };
}

function loopFact(
  account: DataflowAccount, mir: MirBody, entryBlock: BlockId, storage: CounterStorage, loop: NaturalLoop, node: ForStatement<TypedPhase>,
  incoming: readonly (readonly number[])[], inputs: CountedLoopInputs, checkedIndices: () => DataflowResult<IndexSites>,
  proofs: ProofRows,
): DataflowResult<CountedLoopFact | null> {
  const admission = chargeWork(account, 5);
  if (admission !== null) return admission;
  const initializer = node.initializer;
  const condition = node.condition;
  const increment = node.incrementor;
  if (initializer?.kind !== "VariableDeclarationList" || initializer.declarations.nodes.length !== 1
    || condition?.kind !== "BinaryExpression" || condition.operatorToken.kind !== "LessThanToken"
    || (increment?.kind !== "PrefixUnaryExpression" && increment?.kind !== "PostfixUnaryExpression")
    || increment.operator !== "PlusPlusToken" || loop.backEdges.length !== 1) return absent;
  const variable = initializer.declarations.nodes[0];
  if (variable === undefined || !("declaration" in variable.tsonic)) return absent;
  const binding = variable.tsonic.declaration;
  const start = variable.initializer;
  if (binding.kind !== "local" || binding.local.body !== mir.body || start === null
    || condition.left.kind !== "Identifier"
    || increment.operand.kind !== "Identifier") return absent;
  const sameCounter = (reference: typeof condition.left | typeof increment.operand): boolean => {
    const annotation = reference.tsonic;
    return "resolution" in annotation && annotation.resolution.kind === "local"
      && annotation.resolution.local.body === mir.body && annotation.resolution.local.local === binding.local.local;
  };
  if (!sameCounter(condition.left) || !sameCounter(increment.operand)) return absent;
  const header = mir.blocks[loop.header];
  const backEdge = loop.backEdges[0];
  const latch = backEdge === undefined ? undefined : mir.blocks[backEdge];
  if (header === undefined) return absent;
  const branch = header.terminator;
  if (branch?.kind !== "switch" || branch.tir.node !== node.id || branch.step !== null || branch.targets.length !== 1
    || branch.operand.kind !== "place" || latch?.terminator.kind !== "goto" || latch.terminator.target !== loop.header) return absent;
  const branchRead = chargeWork(account, 4);
  if (branchRead !== null) return branchRead;
  const whenTrue = branch.targets[0];
  if (whenTrue === undefined) return absent;
  const guardValue = mir.constants[whenTrue.constant]?.value;
  if (guardValue?.kind !== "literal" || guardValue.value.kind !== "boolean" || !guardValue.value.value) return absent;
  const comparison = header.statements.at(-1);
  if (comparison?.kind !== "assign" || comparison.tir.node !== condition.id || comparison.place !== branch.operand.place
    || comparison.value.kind !== "binary" || comparison.value.left.kind !== "place") return absent;
  const { left, right, operation } = comparison.value;
  const decision = operation.decision.operation;
  if (decision.kind !== "native-operator" || decision.operator !== "<" || !isNativeIntegerPrimitive(decision.carrier)) return absent;
  const counter = mir.places[left.place];
  if (counter?.base.kind !== "local" || counter.storage !== variable.tsonic.storage) return absent;
  const local = mir.locals[counter.base.local];
  if (local?.mode !== "local" || local.source?.body !== mir.body || local.source.local !== binding.local.local) return absent;
  const storageOf = (operand: MirOperand) => operand.kind === "place" ? mir.places[operand.place]?.storage : mir.constants[operand.constant]?.type;
  const boundType = storageOf(right);
  if (boundType !== counter.storage) return absent;
  const step = latch.statements.at(-2);
  const commit = latch.statements.at(-1);
  if (step?.kind !== "assign" || step.value.kind !== "unary" || step.value.operand.kind !== "place"
    || commit?.kind !== "assign" || commit.place !== left.place || commit.value.kind !== "use" || commit.value.operand.kind !== "place"
    || commit.value.operand.place !== step.place || commit.tir.node !== increment.id || step.tir.node !== increment.id) return absent;
  const incrementDecision = step.value.operation.decision.operation;
  if (incrementDecision.kind !== "native-operator" || incrementDecision.operator !== "++" || incrementDecision.carrier !== decision.carrier) return absent;
  if (step.value.operand.place !== left.place) {
    const before = chargeWork(account, 2);
    if (before !== null) return before;
    const operand = mir.places[step.value.operand.place];
    const saved = operand?.base.kind === "local" ? mir.locals[operand.base.local] : undefined;
    if (saved?.role.kind !== "temporary" || saved.mode !== "local" || operand?.storage !== counter.storage) return absent;
    const prior = reachingAssignment(latch, latch.statements.length - 2, step.value.operand.place, storage, account);
    if (prior.kind !== "complete") return prior;
    const read = prior.value;
    if (read?.tir.body !== mir.body || read.tir.node !== increment.operand.id || read.value.kind !== "use"
      || read.value.operand.kind !== "place" || read.value.operand.place !== left.place) return absent;
  }
  if (storage.exposedLocals.has(local.id) || storage.exposedSources.has(binding.local.local)) return absent;
  const members = chargeWork(account, loop.members.length) ?? chargeResultEntries(account, loop.members.length + 1);
  if (members !== null) return members;
  const inside = new Set(loop.members);
  if (!inside.has(whenTrue.target) || inside.has(branch.otherwise)) return absent;
  let entry: number | undefined;
  const headerIncoming = incoming[loop.header] ?? [];
  for (let index = 0; index < headerIncoming.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const predecessor = headerIncoming[index];
    if (predecessor === undefined || inside.has(predecessor)) continue;
    if (entry !== undefined) return absent;
    entry = predecessor;
  }
  const prefixRead = chargeWork(account, 4 + mir.entries.length);
  if (prefixRead !== null) return prefixRead;
  const preheader = entry === undefined ? undefined : mir.blocks[entry];
  if (preheader === undefined || preheader.terminator.kind !== "goto" || preheader.terminator.target !== loop.header
    || mir.entries.some(row => row.block === loop.header)) return absent;
  const initializerBody = variable.tsonic.initializer;
  let initialValue: LoopStart;
  if (initializerBody === null) {
    const initial = preheader.statements.at(-1);
    if (initial?.kind !== "assign" || initial.place !== left.place || initial.tir.body !== mir.body
      || initial.tir.node !== variable.id && initial.tir.node !== start.id) return absent;
    initialValue = { kind: "inline", operand: initial.value.kind === "use" ? initial.value.operand : null };
  } else {
    const preheaderIncoming = incoming[preheader.id];
    const origin = preheaderIncoming?.length === 1 ? preheaderIncoming[0] : undefined;
    const call = origin === undefined ? undefined : mir.blocks[origin]?.terminator;
    if (preheader.statements.length !== 0 || call?.kind !== "call" || call.callee.kind !== "body"
      || call.callee.instance.body !== initializerBody || call.tir.node !== variable.id || call.destination !== left.place
      || call.next !== preheader.id || (call.unwind.kind === "handler" || call.unwind.kind === "carry") && call.unwind.target === preheader.id
      || mir.entries.some(row => row.block === preheader.id)) return absent;
    initialValue = { kind: "placed", instance: call.callee.instance };
  }
  const verified = validateBindings(mir, loop, { local: local.id, start: preheader.id, latch: latch.id, commit }, storage.roots, account);
  if (verified.kind !== "complete") return verified;
  if (!verified.value) return absent;
  const retained = chargeResultEntries(account, 2);
  if (retained !== null) return retained;
  const fact: CountedLoopFact = { statement: node.id, counterDeclaration: variable.id,
    start: { body: initializerBody ?? mir.body, node: start.id },
    bound: condition.right.id, body: node.statement.id, direction: "ascending", comparison: "exclusive-upper-bound", step: 1 };
  const upper = integerConstant(mir, right, counter.storage, account);
  if (upper.kind !== "complete") return upper;
  const extent = upper.value === null ? nativeExtent(mir, header, right, condition.right, decision.carrier, storage, inputs, account) : absent;
  if (extent.kind !== "complete") return extent;
  const maximum = upper.value ?? extent.value?.maximum;
  if (maximum === undefined) return { kind: "complete", value: fact };
  const lower = startingInteger(mir, initialValue, fact.start, counter.storage, inputs, account);
  if (lower.kind !== "complete") return lower;
  if (lower.value === null || lower.value >= maximum) return { kind: "complete", value: fact };
  const sites = checkedIndices();
  if (sites.kind !== "complete") return sites;
  const rangeWork = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (rangeWork !== null) return rangeWork;
  const range = { minimum: lower.value, maximum: maximum - 1n };
  const collected = collectRanges(mir, range, counter.id, local.id, binding.local.local, storage, sites.value, proofs,
    extent.value, entryBlock, header, whenTrue.target, condition.id, inputs, account);
  if (collected.kind !== "complete") return collected;
  return { kind: "complete", value: fact };
}

export const countedLoops: CountedLoopsOf = (account, mir, provided, inputs) => {
  const admission = chargeWork(account, 1);
  if (admission !== null) return admission;
  const graph = graphOfMir(mir, account);
  if (graph.kind !== "complete") return graph;
  if (graph.value.qualification !== undefined) return { kind: "complete", value: empty };
  const setup = chargeWork(account, mir.entries.length);
  if (setup !== null) return setup;
  const entry = mir.entries.find(row => row.provided === provided);
  if (entry === undefined) return { kind: "complete", value: empty };
  const loops = naturalLoops(graph.value, entry.block, account);
  if (loops.kind !== "complete") return loops;
  if (loops.value.length === 0) return { kind: "complete", value: empty };
  const incoming = predecessors(graph.value, account);
  if (incoming.kind !== "complete") return incoming;
  const storage = counterStorage(mir, account);
  if (storage.kind !== "complete") return storage;
  const retained = chargeResultEntries(account, 4);
  if (retained !== null) return retained;
  const rows: CountedLoopFact[] = [];
  const proofs: ProofRows = { ranges: new Map(), refinements: new Map() };
  let sites: DataflowResult<IndexSites> | null = null;
  const checkedIndices = () => sites ??= indexSites(mir, inputs.sourceOf, account);
  for (let position = 0; position < loops.value.length; position += 1) {
    const admission = chargeWork(account, 2);
    if (admission !== null) return admission;
    const loop = loops.value[position];
    const header = loop === undefined ? undefined : mir.blocks[loop.header];
    if (loop === undefined || header === undefined) continue;
    const node = inputs.sourceOf(header.terminator.tir.node);
    if (node?.kind !== "ForStatement") continue;
    const result = loopFact(account, mir, entry.block, storage.value, loop, node, incoming.value, inputs, checkedIndices, proofs);
    if (result.kind !== "complete") return result;
    if (result.value !== null) rows.push(result.value);
  }
  const ordered = orderRows(rows, (left, right) => left.statement - right.statement, account);
  if (ordered.kind !== "complete") return ordered;
  const output = chargeResultEntries(account, 3 + proofs.ranges.size * 2 + proofs.refinements.size);
  if (output !== null) return output;
  const integerRows: CountedLoopProofs["ranges"][number][] = [];
  for (const [node, range] of proofs.ranges) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    integerRows.push({ node, range });
  }
  const orderedRanges = orderRows(integerRows, (left, right) => left.node - right.node, account);
  if (orderedRanges.kind !== "complete") return orderedRanges;
  const refineWork = chargeWork(account, proofs.refinements.size);
  if (refineWork !== null) return refineWork;
  const refinements = orderRows([...proofs.refinements.values()], (left, right) => left.node - right.node, account);
  return refinements.kind === "complete" ? { kind: "complete",
    value: { loops: ordered.value, ranges: orderedRanges.value, refinements: refinements.value } } : refinements;
};
