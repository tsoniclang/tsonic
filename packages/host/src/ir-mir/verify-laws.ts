import type { Violation } from "../diag/contract.js";
import type { AccessLocation, CheckRequirement, ReceiverAccess } from "../ir-infer/contract.js";
import type { BlockId, LocalId, NodeId, PlaceId } from "../ids/contract.js";
import type {
  MirBlock, MirBody, MirClosureCapture, MirLocal, MirOperand, MirPlaceBase, MirProjection, MirRule, MirRvalue, MirStepRef, MirVerificationContext, MirViolationSite,
} from "./contract.js";
import { controlEdges, densePosition, findSourceNode } from "./verify-control.js";
import { chargeWork, read, reversePostorder } from "./verify-control.js";
import type { SourceNode, SourceStep, WireTexts, WorkMeter } from "./verify-control.js";
import type { PlaceLocation } from "./verify-storage.js";

// The graph laws a lowered body satisfies beyond reference and type validity. Every check is a pass over the
// records of the body; none follows paths. Law numbers are those of the lowering specification's list of ten.
// The decisions a record carries or its node selected say whether an operation is pure, whether it writes, how a
// control point fails, whether an access needs a check and how its receiver is reached; the graph agrees with them
// and selects none of it. Law 3 is enforced for every checked place as the contract states it; the stable kind for
// a fixed extent needs the extent field of the element access decision and is added with it.
export function verifyLaws(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>, texts: WireTexts,
  places: ReadonlyMap<PlaceId, PlaceLocation>, meter: WorkMeter,
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  // A site record is built only when a finding is reported.
  const reportBody = (rule: MirRule): void => { violations.push({ rule, site: { kind: "body", body: body.body }, detail: [] }); };
  const reportPlace = (rule: MirRule, place: PlaceId): void => { violations.push({ rule, site: { kind: "place", body: body.body, place }, detail: [] }); };
  const reportAt = (rule: MirRule, block: BlockId, statement: number | null): void => {
    violations.push({ rule, site: { kind: "instruction", body: body.body, block, statement }, detail: [] });
  };

  // Law 7: one entry for each admissible supplied count: the full count first and at the first block, each next
  // count one less, down to the count that omits every trailing parameter the signature lets be omitted.
  let fixed = 0;
  let omissible = 0;
  for (const parameter of context.source.params) {
    if (parameter.role === "rest" || parameter.role === "this") continue;
    fixed += 1;
    omissible = parameter.role === "optional" || parameter.role === "default" ? omissible + 1 : 0;
  }
  let exact = body.entries.length === omissible + 1;
  for (const [position, entry] of body.entries.entries()) {
    if (!Object.is(entry.provided, fixed - position) || !densePosition(entry.block, body.blocks.length)
      || position === 0 && !Object.is(entry.block, 0)) exact = false;
  }
  if (!exact) reportBody("entries-exact");

  const sourceOf = (node: { readonly body: string; readonly node: NodeId }): SourceNode | undefined =>
    node.body === context.source.body ? findSourceNode(nodes, node.node) : undefined;
  const named = (reference: MirStepRef, source: SourceNode): SourceStep | undefined => {
    const row = densePosition(reference.protocol, source.steps.length) ? source.steps[reference.protocol] : undefined;
    return row === undefined || !densePosition(reference.step, row.length) ? undefined : row[reference.step];
  };

  // Per place: the local whose own cell it is (the local's place or a narrowed view of it), and the nearest checked
  // place at or above it. A parent precedes its views, so one pass in order of position gives both.
  const cellOf = new Int32Array(body.places.length).fill(-1);
  const checkedAbove = new Int32Array(body.places.length).fill(-1);
  for (const [position, place] of body.places.entries()) {
    if (place === undefined || !Object.is(place.id, position)) continue;
    if (place.base.kind === "local") {
      if (densePosition(place.base.local, body.locals.length)) cellOf[position] = place.base.local;
      continue;
    }
    if (place.base.kind === "static" || !densePosition(place.base.place, position)) continue;
    if (place.base.projection.kind === "refined") cellOf[position] = read(cellOf, place.base.place, -1);
    checkedAbove[position] = place.base.kind === "checked" ? position : read(checkedAbove, place.base.place, -1);
  }
  const presentOnEntry = (local: MirLocal): boolean => local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture";

  // Every way a local's cell can be written, counted on the local the written place is rooted at: an assignment,
  // a value a terminator delivers, a place handed to a call for writing, an address taken, a capture. `cellWrites`
  // counts only the values written into the local's own cell; `handedOut` marks a local that other code can reach.
  const writes = new Uint32Array(body.locals.length);
  const cellWrites = new Uint32Array(body.locals.length);
  const handedOut = new Uint8Array(body.locals.length);
  const rootOf = (place: PlaceId | null): number | null => {
    if (place === null) return null;
    const location = places.get(place);
    return location === undefined || location.root === null ? null : location.root.id;
  };
  const written = (place: PlaceId | null): void => {
    const root = rootOf(place);
    if (root === null || place === null) return;
    writes[root] = read(writes, root, 0) + 1;
    const own = read(cellOf, place, -1);
    if (own >= 0) cellWrites[own] = read(cellWrites, own, 0) + 1;
  };
  const handed = (place: PlaceId): void => {
    const root = rootOf(place);
    if (root === null) return;
    writes[root] = read(writes, root, 0) + 1;
    handedOut[root] = 1;
  };
  const captured = (captures: readonly MirClosureCapture[]): void => { for (const capture of captures) handed(capture.place); };
  // The locals that hold the result of a completion test (a step of role `done`), each with the record that wrote it.
  const completions = new Map<number, CompletionResult>();
  const completionWrites = new Uint32Array(body.locals.length);
  const completion = (reference: MirStepRef | null, node: NodeId, source: SourceNode | undefined, destination: PlaceId | null,
    block: BlockId, statement: number | null): void => {
    if (reference === null || source === undefined) return;
    const root = rootOf(destination);
    if (root === null || named(reference, source)?.role !== "done") return;
    completions.set(root, { protocol: reference.protocol, step: reference.step, node, block, statement, branched: false });
    completionWrites[root] = read(completionWrites, root, 0) + 1;
  };
  // How often the own cell of each local is read as an operand; counted while the blocks are read for law 3.
  const cellReads = new Uint32Array(body.locals.length);
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind !== "assign") continue;
      written(statement.place);
      if (statement.value.kind === "address-of") handed(statement.value.place);
      else if (statement.value.kind === "closure") captured(statement.value.captures);
      completion(statement.step, statement.tir.node, sourceOf(statement.tir), statement.place, block.id, position);
    }
    const terminator = block.terminator;
    switch (terminator.kind) {
      case "call":
        written(terminator.destination);
        for (const argument of terminator.arguments) {
          if (argument.kind === "place" && argument.passing !== "byref-readonly" && argument.passing !== "borrow-shared") handed(argument.place);
        }
        if (terminator.callee.kind === "body") captured(terminator.callee.captures);
        completion(terminator.step, terminator.tir.node, sourceOf(terminator.tir), terminator.destination, block.id, null);
        break;
      case "invoke":
        written(terminator.destination);
        completion(terminator.step, terminator.tir.node, sourceOf(terminator.tir), terminator.destination, block.id, null);
        break;
      case "await": written(terminator.destination); break;
      case "yield": case "delegate": written(terminator.destination); written(terminator.return.destination); break;
      case "goto": case "switch": case "check": case "throw": case "return": case "unreachable": break;
    }
    if ("unwind" in terminator && terminator.unwind.kind === "handler") written(terminator.unwind.exception);
  }

  // The local of a parameter that is not passed by value or moved is the caller's storage (the source referent, with
  // no dereference at its uses): other code reaches it from entry. It counts as handed out and as written by that
  // code, so it is never stable and never an index. A parameter passed by value or moved is a private cell.
  // The receiver is the row of role `this`, one of these rows: its local is found as a parameter's is, by the source
  // local it names.
  const referents = new Set<LocalId>();
  const notOwned = new Uint8Array(body.locals.length);
  for (const parameter of context.source.params) if (parameter.passing !== "by-value" && parameter.passing !== "move") referents.add(parameter.local);
  for (const local of body.locals) {
    if (local === undefined || local.source === null || local.source.body !== context.source.body || !referents.has(local.source.local)) continue;
    notOwned[local.id] = 1;
    writes[local.id] = read(writes, local.id, 0) + 1;
    cellWrites[local.id] = read(cellWrites, local.id, 0) + 1;
    handedOut[local.id] = 1;
  }

  // Whether a checked place is of the stable kind (the contract's law 3) and the local whose cell it views, and the
  // first checked place of each node.
  const stable = new Uint8Array(body.places.length);
  const stableLocal = new Int32Array(body.places.length);
  // How the check of a checked place fails, by its decision: 1 unwinds, 2 ends the process, 0 when no decision says.
  const failureOf = new Uint8Array(body.places.length);
  const checkedAt = new Map<number, CheckedBase>();
  for (const [position, place] of body.places.entries()) {
    if (place === undefined || place.base.kind !== "place" && place.base.kind !== "checked") continue;
    if (place.base.kind === "checked" && Object.is(place.id, position)) {
      if (place.base.tir.body === context.source.body) {
        // One node can carry checks of several kinds (an element that is also narrowed); each kind has one view.
        const key = place.base.tir.node * 6 + viewKind(place.base.projection);
        const first = checkedAt.get(key);
        if (first === undefined) checkedAt.set(key, place.base);
        else if (!sameView(first, place.base)) reportPlace("check-place-single", place.id);
      }
      const parent = place.base.projection.kind === "refined" && densePosition(place.base.place, position) ? body.places[place.base.place] : undefined;
      if (parent !== undefined && parent.base.kind === "local" && densePosition(parent.base.local, body.locals.length)) {
        const local = body.locals[parent.base.local];
        const count = read(cellWrites, parent.base.local, 0);
        if (local !== undefined && handedOut[parent.base.local] !== 1 && (presentOnEntry(local) ? count === 0 : count === 1)) {
          stable[position] = 1;
          stableLocal[position] = parent.base.local;
        }
      }
    }
    // A narrowed view of a cell exists only as the result of its check.
    if (place.base.projection.kind === "refined" && place.base.kind !== "checked") reportPlace("refined-under-check", place.id);
    // Laws 1 and 4, from the decision of the view. A view is checked exactly where its decision requires a check
    // ("no check is absent because it might be proved", and none is made up); the check fails as the decision says;
    // a receiver reached by reference is a value captured once: a local's own cell, written once and not handed out.
    const view = decisionOfView(place.base, sourceOf(place.base.tir));
    if (view !== null) {
      if ((view.check.kind === "required") !== (place.base.kind === "checked")) reportPlace("check-place-exact", place.id);
      if (view.check.kind === "required" && Object.is(place.id, position)) failureOf[position] = view.check.failure === "abort" ? 2 : 1;
      if (view.receiver === "by-reference") {
        const cell = read(cellOf, place.base.place, -1);
        const holder = cell >= 0 ? body.locals[cell] : undefined;
        const count = read(cellWrites, cell, 0);
        if (holder === undefined || handedOut[cell] === 1 || (presentOnEntry(holder) ? count !== 0 : count !== 1)) reportPlace("receiver-stable", place.id);
      }
    }
    // Law 4: an index, once evaluated, cannot be changed by a later write. It is a constant, or a local whose cell
    // is written once (an entry-present local that the body never writes counts as written once, at entry).
    if (place.base.projection.kind === "index" && place.base.projection.operand.kind === "place") {
      const operand = densePosition(place.base.projection.operand.place, body.places.length) ? body.places[place.base.projection.operand.place] : undefined;
      if (operand !== undefined && operand.base.kind === "local") {
        const local = densePosition(operand.base.local, body.locals.length) ? body.locals[operand.base.local] : undefined;
        const count = read(writes, operand.base.local, 0);
        if (!(local !== undefined && presentOnEntry(local) ? count === 0 : count === 1)) reportPlace("index-operand-stable", place.id);
      } else if (operand !== undefined) reportPlace("index-operand-stable", place.id);
    }
  }

  // Law 3: a checked place is used only where its check is known to have succeeded. Availability is read forwards
  // as the contract states it, and the contract states the cost. Each block and record is visited once; a use is
  // one test of a stamp; within a chain of blocks a set is ended by advancing a counter.
  const incoming = new Uint32Array(body.blocks.length);
  const edge = (target: BlockId): void => { incoming[target] = read(incoming, target, 0) + 1; };
  for (const entry of body.entries) edge(entry.block);
  for (const block of body.blocks) if (block !== undefined) for (const out of controlEdges(block.terminator)) edge(out.target);
  /** The block a terminator continues to, or -1. */
  const continues = (block: MirBlock): number => {
    const terminator = block.terminator;
    switch (terminator.kind) {
      case "goto": return terminator.target;
      case "check": case "call": case "invoke": return terminator.next;
      case "await": case "yield": case "delegate": return terminator.resume;
      case "switch": case "throw": case "return": case "unreachable": return -1;
    }
  };
  /** That block when it has no other incoming edge and is not an entry: it is read as part of the same chain. */
  const continuation = (block: MirBlock): number => {
    const target = continues(block);
    return densePosition(target, incoming.length) && incoming[target] === 1 ? target : -1;
  };
  const inherits = new Uint8Array(body.blocks.length);
  for (const block of body.blocks) {
    if (block === undefined) continue;
    const next = continuation(block);
    if (next >= 0) inherits[next] = 1;
  }

  // A mutable place is available when its stamp is the current mutable count. The stable places available now are
  // `log[0 .. visible)`: a prefix of a list that is only appended to, each place stamped with the list's count and
  // with its position. A count whose stamps were overwritten is superseded: its list is copied before it is read again.
  let clock = 2;
  let mutableNow = 1;
  let stableNow = 2;
  let log: PlaceId[] = [];
  let visible = 0;
  const stamp = new Uint32Array(body.places.length);
  const slot = new Uint32Array(body.places.length);
  const mutableLocals = new Uint32Array(body.locals.length);
  const stableLocals = new Uint32Array(body.locals.length);
  const superseded = new Set<number>();
  const charge = (units: number): void => { chargeWork(meter, units); };
  const endMutable = (): void => { clock += 1; mutableNow = clock; };
  const endStable = (): void => { clock += 1; stableNow = clock; log = []; visible = 0; };
  const available = (checked: number): boolean => stable[checked] === 1
    ? stamp[checked] === stableNow && read(slot, checked, 0) < visible
    : stamp[checked] === mutableNow;
  const use = (place: PlaceId, block: BlockId, statement: number | null): void => {
    const checked = read(checkedAbove, place, -1);
    if (checked >= 0 && !available(checked)) reportAt("checked-place-available", block, statement);
  };
  const useOperand = (operand: MirOperand | null, block: BlockId, statement: number | null): void => {
    if (operand === null || operand.kind !== "place") return;
    const own = read(cellOf, operand.place, -1);
    if (own >= 0) cellReads[own] = read(cellReads, own, 0) + 1;
    use(operand.place, block, statement);
  };
  const useValue = (value: MirRvalue, block: BlockId, statement: number): void => {
    switch (value.kind) {
      case "use": case "unary": case "convert": useOperand(value.operand, block, statement); break;
      case "binary": useOperand(value.left, block, statement); useOperand(value.right, block, statement); break;
      case "aggregate": {
        const aggregate = value.aggregate;
        switch (aggregate.kind) {
          case "object": case "record": for (const field of aggregate.fields) useOperand(field.value, block, statement); break;
          case "array": case "tuple": case "fixed-array": for (const element of aggregate.elements) useOperand(element, block, statement); break;
        }
        break;
      }
      case "address-of": use(value.place, block, statement); break;
      case "closure": for (const capture of value.captures) use(capture.place, block, statement); break;
    }
  };
  const touched = (local: number): void => {
    if (mutableLocals[local] === mutableNow) endMutable();
    if (stableLocals[local] === stableNow) endStable();
  };
  const stored = (place: PlaceId | null): void => {
    if (place === null) return;
    const own = read(cellOf, place, -1);
    if (own >= 0) touched(own);
    if (own < 0 || handedOut[own] === 1) endMutable();
  };
  /** A terminator delivers a value into `place`: never a checked place or a place under one. */
  const delivered = (place: PlaceId | null, block: BlockId): void => {
    if (place !== null && read(checkedAbove, place, -1) >= 0) reportAt("checked-place-destination", block, null);
    stored(place);
  };
  /** Stamps, for a mutable place, the local it is rooted at and each local that indexes it. */
  const depend = (checked: PlaceId): void => {
    const location = places.get(checked);
    if (location === undefined) return;
    if (location.root !== null) mutableLocals[location.root.id] = mutableNow;
    for (let index = location.indices; index !== null; index = index.parent) {
      const root = rootOf(index.place);
      if (root !== null) mutableLocals[root] = mutableNow;
    }
  };
  /** Makes a stable place available: appended to the list when this view ends it, otherwise to a copy of the view. */
  const hold = (checked: PlaceId): void => {
    if (stamp[checked] === stableNow) {
      if (read(slot, checked, 0) < visible) return;
      copyView();
    } else if (log.length !== visible) copyView();
    const old = read(stamp, checked, 0);
    if (old !== 0) superseded.add(old);
    stamp[checked] = stableNow;
    slot[checked] = log.length;
    log.push(checked);
    visible = log.length;
    // A stable place is the narrowed view of a local's own cell: it depends on that local and on no index. A count
    // whose stamp on the local is overwritten is superseded with it.
    const root = read(stableLocal, checked, 0);
    const before = read(stableLocals, root, 0);
    if (before !== 0 && before !== stableNow) superseded.add(before);
    stableLocals[root] = stableNow;
  };
  const copyView = (): void => {
    const facts = log;
    const count = visible;
    endStable();
    charge(count);
    if (meter.exhausted) return;
    for (const fact of facts.slice(0, count)) hold(fact);
  };
  const begin = (checked: PlaceId): void => {
    const place = densePosition(checked, body.places.length) ? body.places[checked] : undefined;
    if (place === undefined || place.base.kind !== "checked" || !Object.is(place.id, checked)) return;
    const above = read(checkedAbove, place.base.place, -1);
    if (above >= 0 && !available(above)) return;
    if (stable[checked] === 1) { hold(checked); return; }
    stamp[checked] = mutableNow;
    depend(checked);
  };
  // What an edge hands to a block that is not continued into, and the sets handed to each block not yet read.
  const nothing: StableSet = { log: [], visible: 0, count: 0 };
  let lastSet: StableSet = nothing;
  const snapshot = (): StableSet => {
    if (visible === 0) return nothing;
    if (lastSet.log !== log || lastSet.visible !== visible || lastSet.count !== stableNow) lastSet = { log, visible, count: stableNow };
    return lastSet;
  };
  const arriving: (StableSet[] | undefined)[] = [];
  const give = (target: number, facts: StableSet): void => {
    if (!densePosition(target, incoming.length)) return;
    const sets = arriving[target];
    if (sets === undefined) arriving[target] = [facts]; else sets.push(facts);
  };
  /** What a failure or suspension-return edge carries: nothing, if the value it delivers is written into a local a stable place depends on. */
  const carried = (now: StableSet, place: PlaceId, block: BlockId): StableSet => {
    if (read(checkedAbove, place, -1) >= 0) reportAt("checked-place-destination", block, null);
    const root = rootOf(place);
    return root !== null && stableLocals[root] === stableNow ? nothing : now;
  };
  const visited = new Uint8Array(body.blocks.length);
  const arrivals = new Uint32Array(body.places.length);
  const arrivedAt = new Uint32Array(body.places.length);
  let merges = 0;
  /** Starts a block that is not continued into: no mutable place, and the stable places every incoming edge brings. */
  const enter = (head: number): void => {
    endMutable();
    const sets = arriving[head];
    arriving[head] = undefined;
    const first = sets === undefined ? undefined : sets[0];
    // An entry, and an edge whose source is not read yet, hand over no set: the count of sets falls short of the
    // count of incoming edges and nothing is kept.
    if (sets === undefined || first === undefined || sets.length !== incoming[head]) { endStable(); return; }
    charge(sets.length);
    if (meter.exhausted) return;
    let one = true;
    let shortest = first.visible;
    for (const set of sets) {
      if (set.log !== first.log || set.count !== first.count) one = false;
      if (set.visible < shortest) shortest = set.visible;
    }
    if (shortest === 0) { endStable(); return; }
    if (one) {
      // Prefixes of one list: the shortest is what all of them bring.
      stableNow = first.count;
      log = first.log;
      visible = shortest;
      if (superseded.has(first.count)) copyView();
      return;
    }
    merges += 1;
    for (const set of sets) {
      charge(set.visible);
      if (meter.exhausted) return;
      for (const fact of set.log.slice(0, set.visible)) {
        if (arrivedAt[fact] !== merges) { arrivedAt[fact] = merges; arrivals[fact] = 0; }
        arrivals[fact] = read(arrivals, fact, 0) + 1;
      }
    }
    endStable();
    for (const fact of first.log.slice(0, first.visible)) if (arrivals[fact] === sets.length) hold(fact);
  };
  const chain = (head: number): void => {
    if (meter.exhausted) return;
    enter(head);
    for (let position = head; position >= 0 && visited[position] !== 1 && !meter.exhausted;) {
      visited[position] = 1;
      const block = body.blocks[position];
      if (block === undefined) return;
      for (const [index, statement] of block.statements.entries()) {
        if (statement.kind === "assign") {
          useValue(statement.value, block.id, index);
          use(statement.place, block.id, index);
          stored(statement.place);
        } else if (densePosition(statement.local, body.locals.length)) touched(statement.local);
      }
      const terminator = block.terminator;
      switch (terminator.kind) {
        case "goto": case "unreachable": break;
        case "switch":
          useOperand(terminator.operand, block.id, null);
          for (const target of terminator.targets) give(target.target, snapshot());
          give(terminator.otherwise, snapshot());
          break;
        case "return": useOperand(terminator.value, block.id, null); break;
        case "throw": useOperand(terminator.operand, block.id, null); break;
        case "check": {
          // The check reads the parent of its place and the index; the place itself is what it makes available.
          const place = densePosition(terminator.place, body.places.length) ? body.places[terminator.place] : undefined;
          if (place === undefined || place.base.kind !== "checked") { use(terminator.place, block.id, null); break; }
          use(place.base.place, block.id, null);
          if (place.base.projection.kind === "index") useOperand(place.base.projection.operand, block.id, null);
          break;
        }
        case "call":
          if (terminator.callee.kind === "indirect") useOperand(terminator.callee.operand, block.id, null);
          else if (terminator.callee.kind === "body") for (const capture of terminator.callee.captures) use(capture.place, block.id, null);
          useOperand(terminator.receiver, block.id, null);
          for (const argument of terminator.arguments) {
            if (argument.kind === "value") useOperand(argument.operand, block.id, null);
            else if (argument.kind === "place") use(argument.place, block.id, null);
          }
          break;
        case "invoke":
          for (const operand of terminator.operands) useOperand(operand, block.id, null);
          break;
        case "await": case "yield":
          useOperand(terminator.operand, block.id, null);
          break;
        case "delegate":
          useOperand(terminator.iterator, block.id, null);
          break;
      }
      // The failure edge and the return edge of a suspension leave before the effect; the place of a failing
      // check is not available on its failure edge.
      if ("unwind" in terminator && terminator.unwind.kind === "handler")
        give(terminator.unwind.target, carried(snapshot(), terminator.unwind.exception, block.id));
      if (terminator.kind === "yield" || terminator.kind === "delegate")
        give(terminator.return.target, carried(snapshot(), terminator.return.destination, block.id));
      switch (terminator.kind) {
        case "invoke": {
          // An invocation that only reads ends nothing; one that writes existing storage ends mutable availability.
          const execution = terminator.operation.decision.execution;
          if (execution.kind === "invocation" && execution.writesStorage) endMutable();
          delivered(terminator.destination, block.id);
          break;
        }
        case "call": case "await": case "yield": case "delegate":
          endMutable();
          delivered(terminator.destination, block.id);
          break;
        case "check": begin(terminator.place); break;
        case "goto": case "switch": case "throw": case "return": case "unreachable": break;
      }
      const next = continuation(block);
      const target = continues(block);
      if (next < 0 && target >= 0) give(target, snapshot());
      position = next;
    }
  };
  // Blocks are read in reverse postorder of the control edges, from the entries and then from every block not
  // reached, so that the sources of a block's forward edges are read before it. A chain is read from its head.
  const roots: number[] = [];
  for (const entry of body.entries) roots.push(entry.block);
  for (const position of body.blocks.keys()) roots.push(position);
  for (const ordered of reversePostorder(body, roots)) if (inherits[ordered.position] !== 1 && visited[ordered.position] !== 1) chain(ordered.position);
  // Blocks left over form a closed ring that nothing enters; each is read once all the same.
  for (const [position, block] of body.blocks.entries()) if (block !== undefined && visited[position] !== 1) chain(position);

  // Past the limit the body has no answer: what follows is not read.
  if (meter.exhausted) return violations;

  // Law 6: a protocol step names its step. A record that names a step executes that step's callee or operation, and
  // a record that executes the callee or operation of a step of its node's protocols names it. A record that names
  // a step and carries no selection of its own (a call of an internal body, an assignment without an operation) is
  // held to the step's form only.
  const step = (reference: MirStepRef | null, source: SourceNode | undefined, callee: string | null, operation: string | null,
    destination: PlaceId | null, block: BlockId, statement: number | null): void => {
    if (source === undefined) return;
    if (reference === null) {
      if (callee === null && operation === null) return;
      for (const row of source.steps) for (const candidate of row) {
        if (callee !== null ? candidate.callee === callee : candidate.callee === null && candidate.operation === operation) {
          reportAt("protocol-step-exact", block, statement);
          return;
        }
      }
      return;
    }
    const selected = named(reference, source);
    if (selected === undefined || (callee !== null ? selected.callee !== callee
      : selected.callee !== null || operation !== null && selected.operation !== operation)) reportAt("protocol-step-exact", block, statement);
    if (selected === undefined || selected.role !== "done") return;
    // The result of a completion test goes into a local's own place that nothing else writes: the completion
    // branch is found by that local.
    const place = destination !== null && densePosition(destination, body.places.length) ? body.places[destination] : undefined;
    const own = place !== undefined && place.base.kind === "local" && densePosition(place.base.local, writes.length) ? place.base.local : -1;
    if (own < 0 || writes[own] !== completionWrites[own]) reportAt("protocol-step-exact", block, statement);
  };
  const hasRole = (source: SourceNode, role: SourceStep["role"]): boolean => source.steps.some(row => row.some(candidate => candidate.role === role));
  /** The completion test whose result an operand reads, if it reads one. */
  const completionOf = (operand: MirOperand): CompletionResult | undefined =>
    operand.kind === "place" ? completions.get(read(cellOf, operand.place, -1)) : undefined;

  const effects = new Set<string>();
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind === "assign") {
        const source = sourceOf(statement.tir);
        const value = statement.value;
        // Law 2: a statement executes only an operation whose decision says it is pure.
        // An aggregate executes the construction its node selected.
        if ((value.kind === "unary" || value.kind === "binary" || value.kind === "convert") && value.operation.decision.execution.kind !== "pure"
          || value.kind === "aggregate" && source !== undefined && !pureConstruction(source)) reportAt("statement-pure", block.id, position);
        if (source === undefined || statement.step === null && source.steps.length === 0) continue;
        step(statement.step, source, null, value.kind === "unary" || value.kind === "binary" || value.kind === "convert"
          ? texts.operation(value.operation) : null, statement.place, block.id, position);
        continue;
      }
      // Law 8: a marker is about a slot the body owns. Storage the body does not own carries none, begin or end.
      if (read(notOwned, statement.local, 0) === 1) {
        reportAt("storage-marker-exact", block.id, position);
        continue;
      }
      if (statement.kind === "storage-dead") continue;
      // Law 8: a local that is present on entry carries no begin marker.
      const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
      if (local !== undefined && (local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture"))
        reportAt("storage-marker-exact", block.id, position);
    }
    const terminator = block.terminator;
    const source = sourceOf(terminator.tir);
    // Law 1: a check is a control point whose failure goes to a handler, out of the body, or ends the process. The
    // terminators that run code of their own can only unwind.
    switch (terminator.kind) {
      case "check": {
        if (terminator.unwind.kind === "none") reportAt("failure-kind-exact", block.id, null);
        const place = densePosition(terminator.place, body.places.length) ? body.places[terminator.place] : undefined;
        if (place === undefined || place.base.kind !== "checked" || place.base.tir.body !== terminator.tir.body
          || !Object.is(place.base.tir.node, terminator.tir.node)) reportAt("check-place-exact", block.id, null);
        // The check fails as its decision says: it unwinds, or it ends the process.
        const failure = read(failureOf, terminator.place, 0);
        if (failure === 1 && terminator.unwind.kind === "abort" || failure === 2 && terminator.unwind.kind !== "abort") reportAt("failure-kind-exact", block.id, null);
        break;
      }
      case "call": case "await": case "yield": case "delegate": case "throw":
        if (terminator.unwind.kind !== "handler" && terminator.unwind.kind !== "escape") reportAt("failure-kind-exact", block.id, null);
        break;
      case "invoke": {
        // Laws 1 and 2: a control point executes an operation whose decision says it is an invocation, and fails as
        // that decision says: not at all, by unwinding, or by ending the process.
        const execution = terminator.operation.decision.execution;
        if (execution.kind === "pure") reportAt("statement-pure", block.id, null);
        else if (execution.failure === "none" ? terminator.unwind.kind !== "none" : execution.failure === "abort" ? terminator.unwind.kind !== "abort"
          : terminator.unwind.kind !== "handler" && terminator.unwind.kind !== "escape") reportAt("failure-kind-exact", block.id, null);
        break;
      }
      case "goto": case "switch": case "return": case "unreachable": break;
    }
    // Laws 5 and 9: no effect occurrence, and no completion branch, is emitted twice. The occurrence is the node, the
    // step and the selection executed.
    let occurrence: string | null = null;
    switch (terminator.kind) {
      case "call": {
        const callee = terminator.callee.kind === "body" ? null : texts.callee(terminator.callee.resolution);
        step(terminator.step, source, callee, null, terminator.destination, block.id, null);
        occurrence = terminator.callee.kind === "body" ? `body:${terminator.callee.instance.body}` : `call:${callee}`;
        break;
      }
      case "invoke": {
        const operation = texts.operation(terminator.operation);
        step(terminator.step, source, null, operation, terminator.destination, block.id, null);
        occurrence = `invoke:${operation}`;
        break;
      }
      case "await": {
        occurrence = terminator.kind;
        // Law 5: a suspension stands only in a body that can suspend.
        if (!context.source.asynchronous) reportAt("suspension-admitted", block.id, null);
        if (source === undefined) break;
        // An await at a node whose protocols list an await step is that step; where the node's await protocol lists
        // no step, the await names the protocol.
        const reference = terminator.step;
        if (reference === null) {
          if (hasRole(source, "await") || source.protocols.some(protocol => protocol.kind === "await")) reportAt("protocol-step-exact", block.id, null);
          break;
        }
        const selected = named(reference, source);
        const protocol = densePosition(reference.protocol, source.protocols.length) ? source.protocols[reference.protocol] : undefined;
        const agrees = selected !== undefined ? selected.role === "await"
          : protocol !== undefined && protocol.kind === "await" && protocol.steps.length === 0 && reference.step === 0;
        if (!agrees) reportAt("protocol-step-exact", block.id, null);
        break;
      }
      case "yield": case "delegate": {
        occurrence = terminator.kind;
        if (!context.source.generator) reportAt("suspension-admitted", block.id, null);
        if (source === undefined) break;
        // The suspension of a yield or a delegation is the protocol itself: it names the protocol, and the step it
        // performs if one is listed.
        const reference = terminator.step;
        if (reference === null) {
          if (source.protocols.some(protocol => protocol.kind === terminator.kind)) reportAt("protocol-step-exact", block.id, null);
          break;
        }
        const protocol = densePosition(reference.protocol, source.protocols.length) ? source.protocols[reference.protocol] : undefined;
        if (protocol === undefined || protocol.kind !== terminator.kind || reference.step !== 0 && named(reference, source) === undefined)
          reportAt("protocol-step-exact", block.id, null);
        break;
      }
      case "switch": {
        const result = completionOf(terminator.operand);
        if (terminator.step === null) {
          // A branch on the result of a completion test is the completion branch and names the step.
          if (result !== undefined) reportAt("protocol-step-exact", block.id, null);
          break;
        }
        // The branch names the `done` step whose result it reads: the same step, at the same node.
        if (result === undefined || result.protocol !== terminator.step.protocol || result.step !== terminator.step.step
          || !Object.is(result.node, terminator.tir.node)) reportAt("protocol-step-exact", block.id, null);
        else result.branched = true;
        // Law 6: the completion branch of an iteration has one canonical shape.
        const only = terminator.targets.length === 1 ? terminator.targets[0] : undefined;
        const constant = only !== undefined && densePosition(only.constant, body.constants.length) ? body.constants[only.constant] : undefined;
        const complete = constant !== undefined && constant.value.kind === "literal" && constant.value.value.kind === "boolean"
          && constant.value.value.value === true;
        if (only === undefined || !complete || Object.is(only.target, terminator.otherwise)) reportAt("completion-branch-canonical", block.id, null);
        // Law 5: the completion of a handle is one record, so a step has one completion branch.
        occurrence = "completion";
        break;
      }
      case "throw": occurrence = terminator.kind; break;
      case "check": case "goto": case "return": case "unreachable": break;
    }
    if (occurrence === null) continue;
    const identity = "step" in terminator && terminator.step !== null ? `${terminator.step.protocol}.${terminator.step.step}` : "-";
    const key = `${terminator.tir.node}\u0000${identity}\u0000${occurrence}`;
    if (effects.has(key)) reportAt("effect-site-unique", block.id, null);
    effects.add(key);
  }
  // Law 6: the result of a completion test is read by exactly one record, the branch that names its step; a test
  // whose result is never branched on, or is read elsewhere, has no completion edge a reader could identify.
  for (const [local, result] of completions) {
    if (!result.branched || read(cellReads, local, 0) !== 1) reportAt("protocol-step-exact", result.block, result.statement);
  }
  return violations;
}

/** What the decision of a projected place says: whether it requires a check, and how its receiver is reached where the decision is an access. */
interface ViewDecision {
  readonly check: CheckRequirement;
  readonly receiver: ReceiverAccess | null;
}

/** An access through an accessor is a call, not a view: it decides nothing about a place. */
function decisionOfLocation(location: AccessLocation): ViewDecision | null {
  return location.kind === "data" ? { check: location.check, receiver: location.receiver } : null;
}

/**
 * The decision of a view. A field carries its member decision. A narrowed view is decided by the narrowing of its
 * node. Every other view is decided by the access its node selected, when the node selected one.
 */
function decisionOfView(base: ProjectedBase, source: SourceNode | undefined): ViewDecision | null {
  if (base.projection.kind === "field") return decisionOfLocation(base.projection.member.decision.location);
  if (source === undefined) return null;
  const payload = source.node.tsonic;
  if (base.projection.kind === "refined") {
    const narrowing = payload !== null && "narrowing" in payload ? payload.narrowing : null;
    return { check: narrowing !== null && narrowing.kind === "narrowed" ? { kind: "required", failure: narrowing.failure } : { kind: "none" }, receiver: null };
  }
  if (payload === null || !("selection" in payload) || payload.selection === null || payload.selection.kind !== "decided") return null;
  return decisionOfLocation(payload.selection.decision.decision.location);
}

type ProjectedBase = Extract<MirPlaceBase, { readonly kind: "place" | "checked" }>;

/** Whether the construction a node selected is pure. A node that selected none says nothing against a statement. */
function pureConstruction(source: SourceNode): boolean {
  const payload = source.node.tsonic;
  return payload === null || !("construction" in payload) || payload.construction.kind !== "decided"
    || payload.construction.decision.decision.execution.kind === "pure";
}

/** The record that wrote the result of a completion test, and whether its one branch was found. */
interface CompletionResult {
  readonly protocol: number;
  readonly step: number;
  readonly node: NodeId;
  readonly block: BlockId;
  readonly statement: number | null;
  branched: boolean;
}

/** The stable checked places an edge hands on: `log[0 .. visible)`, stamped with `count`. */
interface StableSet {
  readonly log: PlaceId[];
  readonly visible: number;
  readonly count: number;
}

type CheckedBase = Extract<MirPlaceBase, { readonly kind: "checked" }>;

/** The position of a projection kind among the six kinds. */
function viewKind(projection: MirProjection): number {
  switch (projection.kind) {
    case "field": return 0;
    case "index": return 1;
    case "element": return 2;
    case "deref": return 3;
    case "capture": return 4;
    case "refined": return 5;
  }
}

/** Whether two checked places of one node and one kind are the same view: one parent and, for an element, one index. */
function sameView(first: CheckedBase, second: CheckedBase): boolean {
  if (!Object.is(first.place, second.place)) return false;
  const one = first.projection;
  const other = second.projection;
  if (one.kind === "index" && other.kind === "index") {
    return one.operand.kind === "place" ? other.operand.kind === "place" && Object.is(one.operand.place, other.operand.place)
      : other.operand.kind === "constant" && Object.is(one.operand.constant, other.operand.constant);
  }
  if (one.kind === "element" && other.kind === "element") return Object.is(one.index, other.index);
  return one.kind === other.kind;
}
