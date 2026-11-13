import type { Violation } from "../diag/contract.js";
import type { LocalId, NodeId, PlaceId, SigId, TyId } from "../ids/contract.js";
import { localId, placeId } from "../ids/index.js";
import type { LiteralTypeValue, LiteralValue, TypeTerm } from "../ir-types/contract.js";
import type { MirBlock, MirBody, MirLocal, MirOperand, MirRule, MirRvalue, MirTerminator, MirVerificationContext, MirViolationSite } from "./contract.js";
import { chargeWork, controlEdges, densePosition, findSourceNode, read, reversePostorder } from "./verify-control.js";
import type { SourceNode, WorkMeter } from "./verify-control.js";

export function rvalueOperands(value: MirRvalue): readonly MirOperand[] {
  switch (value.kind) {
    case "use": case "unary": case "convert": return [value.operand];
    case "binary": return [value.left, value.right];
    case "aggregate":
      switch (value.aggregate.kind) {
        case "array": case "tuple": case "fixed-array": return value.aggregate.elements;
        case "object": case "record": return value.aggregate.fields.map(field => field.value);
      }
    case "address-of": return [{ kind: "place", place: value.place }];
    case "closure": return value.captures.map(capture => ({ kind: "place", place: capture.place }));
  }
}

export function terminatorOperands(terminator: MirTerminator): readonly MirOperand[] {
  const operands: MirOperand[] = [];
  switch (terminator.kind) {
    case "goto": case "unreachable": return operands;
    case "return": if (terminator.value !== null) operands.push(terminator.value); return operands;
    case "switch": return [terminator.operand];
    case "call":
      if (terminator.callee.kind === "indirect") operands.push(terminator.callee.operand);
      if (terminator.receiver !== null) operands.push(terminator.receiver);
      if (terminator.callee.kind === "body") for (const capture of terminator.callee.captures) operands.push({ kind: "place", place: capture.place });
      for (const argument of terminator.arguments) {
        if (argument.kind === "value") operands.push(argument.operand);
        else if (argument.kind === "place") operands.push({ kind: "place", place: argument.place });
      }
      if (terminator.destination !== null) operands.push({ kind: "place", place: terminator.destination });
      break;
    case "invoke":
      for (const operand of terminator.operands) operands.push(operand);
      if (terminator.destination !== null) operands.push({ kind: "place", place: terminator.destination });
      break;
    case "check": operands.push({ kind: "place", place: terminator.place }); break;
    case "await": operands.push(terminator.operand, { kind: "place", place: terminator.destination }); break;
    case "yield":
      if (terminator.operand !== null) operands.push(terminator.operand);
      operands.push({ kind: "place", place: terminator.destination }, { kind: "place", place: terminator.return.destination });
      break;
    case "delegate":
      operands.push(terminator.iterator, { kind: "place", place: terminator.destination }, { kind: "place", place: terminator.return.destination });
      break;
    case "throw": operands.push(terminator.operand); break;
  }
  if (terminator.unwind.kind === "handler") operands.push({ kind: "place", place: terminator.unwind.exception });
  return operands;
}

interface IndexChain {
  readonly place: PlaceId;
  readonly parent: IndexChain | null;
}

export interface PlaceLocation {
  readonly root: MirLocal | null;
  readonly indices: IndexChain | null;
}

export function placeLocations(body: MirBody): ReadonlyMap<PlaceId, PlaceLocation> {
  const locations = new Map<PlaceId, PlaceLocation>();
  for (const [position, place] of body.places.entries()) {
    if (place === undefined || !Object.is(place.id, position)) continue;
    switch (place.base.kind) {
      case "static": locations.set(place.id, { root: null, indices: null }); break;
      case "local": {
        const local = densePosition(place.base.local, body.locals.length) ? body.locals[place.base.local] : undefined;
        if (local === undefined || !Object.is(local.id, place.base.local)) continue;
        locations.set(place.id, { root: local, indices: null });
        break;
      }
      case "place": case "checked": {
        if (!densePosition(place.base.place, position)) continue;
        const parent = locations.get(place.base.place);
        if (parent === undefined) continue;
        locations.set(place.id, { root: parent.root, indices: place.base.projection.kind === "index" && place.base.projection.operand.kind === "place"
          ? { place: place.base.projection.operand.place, parent: parent.indices } : parent.indices });
        break;
      }
    }
  }
  return locations;
}

/**
 * The locals whose storage is live at one point of a body: a leaf holds one word for 32 locals, a node above holds two
 * halves. A set is never changed after it is made, and within one pass there is one object for each contents
 * (`LiveSets`), so two sets are the same object exactly when they hold the same locals, and `meetLive(a, b)` is `a`
 * itself exactly when every local of `a` is in `b`.
 */
export interface LiveSet {
  readonly id: number;
  readonly bits: number;
  readonly low: LiveSet | null;
  readonly high: LiveSet | null;
}

/**
 * The sets of one pass over one body, and the body's account. Every node a change, a meet or a lookup enters is one
 * unit of that account, charged before the node is read; the unit also pays for the one node (and the one map of a
 * new first half) that entering it may make. An operation that finds the account exhausted answers null at once:
 * no further node is entered and nothing more is made, at any depth. `count` is the number of nodes made.
 */
export interface LiveSets {
  readonly meter: WorkMeter;
  readonly leaves: Map<number, LiveSet>;
  readonly pairs: Map<number, Map<number, LiveSet>>;
  count: number;
}

export function leafOf(sets: LiveSets, bits: number): LiveSet {
  let found = sets.leaves.get(bits);
  if (found === undefined) {
    found = { id: sets.count, bits, low: null, high: null };
    sets.count += 1;
    sets.leaves.set(bits, found);
  }
  return found;
}

export function pairOf(sets: LiveSets, low: LiveSet, high: LiveSet): LiveSet {
  let byHigh = sets.pairs.get(low.id);
  if (byHigh === undefined) {
    byHigh = new Map();
    sets.pairs.set(low.id, byHigh);
  }
  let found = byHigh.get(high.id);
  if (found === undefined) {
    found = { id: sets.count, bits: 0, low, high };
    sets.count += 1;
    byHigh.set(high.id, found);
  }
  return found;
}

/** The set with one local made live or not; `span` is the number of locals the set's tree covers. Null: the account is exhausted. */
export function withLocal(sets: LiveSets, set: LiveSet, span: number, local: number, live: boolean): LiveSet | null {
  chargeWork(sets.meter, 1);
  if (sets.meter.exhausted) return null;
  if (set.low === null || set.high === null) return leafOf(sets, live ? set.bits | (1 << local) : set.bits & ~(1 << local));
  const half = span / 2;
  if (local < half) {
    const low = withLocal(sets, set.low, half, local, live);
    return low === null ? null : pairOf(sets, low, set.high);
  }
  const high = withLocal(sets, set.high, half, local - half, live);
  return high === null ? null : pairOf(sets, set.low, high);
}

/** The locals in both sets. Where both sides are the same object nothing is entered. Null: the account is exhausted. */
export function meetLive(sets: LiveSets, left: LiveSet, right: LiveSet): LiveSet | null {
  if (left === right) return left;
  chargeWork(sets.meter, 1);
  if (sets.meter.exhausted) return null;
  if (left.low === null || left.high === null || right.low === null || right.high === null) return leafOf(sets, left.bits & right.bits);
  const low = meetLive(sets, left.low, right.low);
  if (low === null) return null;
  const high = meetLive(sets, left.high, right.high);
  return high === null ? null : pairOf(sets, low, high);
}

/** Whether the local is in the set. Null: the account is exhausted. */
export function liveIn(sets: LiveSets, set: LiveSet, span: number, local: number): boolean | null {
  let current = set;
  let width = span;
  let position = local;
  for (;;) {
    chargeWork(sets.meter, 1);
    if (sets.meter.exhausted) return null;
    if (current.low === null || current.high === null) return (current.bits & (1 << position)) !== 0;
    width /= 2;
    if (position < width) current = current.low;
    else {
      current = current.high;
      position -= width;
    }
  }
}

/** The locals in either set. Where the sets are the same object, or one is the empty set, nothing is entered. Null: the account is exhausted. */
export function joinLive(sets: LiveSets, left: LiveSet, right: LiveSet, empty: LiveSet): LiveSet | null {
  if (left === right || right === empty) return left;
  if (left === empty) return right;
  chargeWork(sets.meter, 1);
  if (sets.meter.exhausted) return null;
  if (left.low === null || left.high === null || right.low === null || right.high === null || empty.low === null || empty.high === null)
    return leafOf(sets, left.bits | right.bits);
  const low = joinLive(sets, left.low, right.low, empty.low);
  if (low === null) return null;
  const high = joinLive(sets, left.high, right.high, empty.high);
  return high === null ? null : pairOf(sets, low, high);
}

/**
 * Calls `visit` for each local of the set in ascending order. One unit for each node entered (an empty subtree is not
 * entered) and one for each local visited, each charged before. False: the account is exhausted.
 */
export function eachLive(sets: LiveSets, set: LiveSet, empty: LiveSet, span: number, visit: (local: number) => void): boolean {
  const walk = (node: LiveSet, blank: LiveSet, offset: number, width: number): boolean => {
    if (node === blank) return true;
    chargeWork(sets.meter, 1);
    if (sets.meter.exhausted) return false;
    if (node.low === null || node.high === null || blank.low === null || blank.high === null) {
      for (let bit = 0; bit < 32; bit += 1) {
        if ((node.bits & (1 << bit)) === 0) continue;
        chargeWork(sets.meter, 1);
        if (sets.meter.exhausted) return false;
        visit(offset + bit);
      }
      return true;
    }
    const half = width / 2;
    return walk(node.low, blank.low, offset, half) && walk(node.high, blank.high, offset + half, half);
  };
  return walk(set, empty, 0, span);
}

/**
 * The locals each place's use reaches: its root local, and the locals of every index operand on the way from the
 * root to it, including those of the index operands' own places. One pass over the place graph (an edge from a
 * projected place to its base place and to its index operand place), with its strongly connected parts found once,
 * so each place's set is made once and shared: a part's set is the union of its successor parts' sets and the local
 * of each member that is a place on a local. A part that holds a place without a location, or reaches one, has no set (null). One unit
 * of the body's account for each place visited, and the set operations' own units. "exhausted": the account ran out.
 */
function placeSets(
  body: MirBody, places: ReadonlyMap<PlaceId, PlaceLocation>, sets: LiveSets, empty: LiveSet, span: number,
): readonly (LiveSet | null)[] | "exhausted" {
  const count = body.places.length;
  const order = new Int32Array(count).fill(-1);
  const low = new Int32Array(count);
  const onStack = new Uint8Array(count);
  const part = new Int32Array(count).fill(-1);
  const result: (LiveSet | null)[] = [];
  const stack: number[] = [];
  const successors = (position: number): readonly number[] => {
    const place = body.places[position];
    if (place === undefined || !Object.is(place.id, position) || place.base.kind === "static" || place.base.kind === "local") return [];
    const next = [place.base.place];
    if (place.base.projection.kind === "index" && place.base.projection.operand.kind === "place") next.push(place.base.projection.operand.place);
    return next;
  };
  let visited = 0;
  let parts = 0;
  for (let root = 0; root < count; root += 1) {
    if (order[root] !== -1) continue;
    const frames: { readonly position: number; readonly next: readonly number[]; edge: number }[] = [];
    const enter = (position: number): boolean => {
      chargeWork(sets.meter, 1);
      if (sets.meter.exhausted) return false;
      order[position] = visited;
      low[position] = visited;
      visited += 1;
      stack.push(position);
      onStack[position] = 1;
      frames.push({ position, next: successors(position), edge: 0 });
      return true;
    };
    if (!enter(root)) return "exhausted";
    for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) {
      const target = frame.next[frame.edge];
      if (target !== undefined) {
        frame.edge += 1;
        // A target outside the body's places has no location: it is a part of its own with no set.
        if (!densePosition(target, count)) continue;
        if (read(order, target, -1) === -1) { if (!enter(target)) return "exhausted"; }
        else if (onStack[target] === 1) low[frame.position] = Math.min(read(low, frame.position, 0), read(order, target, 0));
        continue;
      }
      frames.pop();
      const parent = frames.at(-1);
      if (parent !== undefined) low[parent.position] = Math.min(read(low, parent.position, 0), read(low, frame.position, 0));
      if (low[frame.position] !== order[frame.position]) continue;
      // The part rooted here: its members are on the stack above it.
      const members: number[] = [];
      for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
        onStack[member] = 0;
        part[member] = parts;
        members.push(member);
        if (member === frame.position) break;
      }
      let set: LiveSet | null = empty;
      for (const member of members) {
        const location = places.get(placeId(member));
        if (location === undefined) { set = null; break; }
        const next = successors(member);
        for (const target of next) {
          const other = densePosition(target, count) ? read(part, target, -1) : -1;
          if (other === parts) continue;
          const joined = other === -1 ? undefined : result[other];
          if (joined === undefined || joined === null) { set = null; break; }
          const union = joinLive(sets, set, joined, empty);
          if (union === null) return "exhausted";
          set = union;
        }
        if (set === null) break;
        // A projected place's root is its base's, already in the base's set: only a place on a local (no successor) adds it.
        if (location.root === null || next.length > 0) continue;
        const rooted = withLocal(sets, set, span, location.root.id, true);
        if (rooted === null) return "exhausted";
        set = rooted;
      }
      result.push(set);
      parts += 1;
    }
  }
  return Array.from(part, owner => result[owner] ?? null);
}

interface StorageChange {
  readonly local: LocalId;
  readonly live: boolean;
}

interface StorageUse {
  readonly local: LocalId;
  readonly site: MirViolationSite;
}

/** What one block contributes, and what the forward reading knows of it. */
interface StorageReading {
  readonly rank: number;
  readonly block: MirBlock;
  /** The last marker of each local in the block. */
  readonly changes: readonly StorageChange[];
  /** Findings the block's own markers decide. */
  readonly decided: readonly Violation<MirRule, MirViolationSite>[];
  /** Uses that no marker of the block precedes: they need the local live where the block starts. */
  readonly awaiting: readonly StorageUse[];
  /** The locals live where the block starts, as far as the edges read so far bring them; null until one arrives. */
  start: LiveSet | null;
  /** The start set the block still has to be read with; null when it is not waiting. */
  waiting: LiveSet | null;
  read: boolean;
  /** The next block in the order of reading; null for the last. A sweep that begins later walks from here, copying nothing. */
  next: StorageReading | null;
}

/**
 * Storage liveness (`storage-live-before-use`): a record uses a local only where its storage is live on every path
 * from a start of the body. One forward fixed point over the judged blocks in reverse postorder: a block's start is
 * the meet of what its incoming edges bring, a start set only loses locals, and a block is read again only when its
 * start lost one. The body's account is charged one unit for each node of the empty set as it is made; for each place
 * visited when the locals each place reaches are found (`placeSets`); for each set node entered by a change, a union,
 * a meet of two different sets, an enumeration of an operand's locals, and the lookup of a use that depends on its
 * block's start; for each local an enumeration visits; for each block of a sweep after the first; and for each
 * outgoing edge of a block read again. When the account is exhausted nothing is reported.
 */
export function verifyStorage(
  body: MirBody, places: ReadonlyMap<PlaceId, PlaceLocation>, meter: WorkMeter,
): readonly Violation<MirRule, MirViolationSite>[] {
  // The empty set of the body's width, one node for each level, each charged before it is made; the locals present
  // where an execution starts; and the locals each place's use reaches.
  const sets: LiveSets = { meter, leaves: new Map(), pairs: new Map(), count: 0 };
  chargeWork(meter, 1);
  if (meter.exhausted) return [];
  let span = 32;
  let empty = leafOf(sets, 0);
  while (span < body.locals.length) {
    chargeWork(meter, 1);
    if (meter.exhausted) return [];
    empty = pairOf(sets, empty, empty);
    span *= 2;
  }
  let entry = empty;
  for (const [position, local] of body.locals.entries()) {
    if (local === undefined || !Object.is(local.id, position)) continue;
    if (local.role.kind !== "parameter" && local.role.kind !== "receiver" && local.role.kind !== "capture") continue;
    const present = withLocal(sets, entry, span, local.id, true);
    if (present === null) return [];
    entry = present;
  }
  const reaches = placeSets(body, places, sets, empty, span);
  if (reaches === "exhausted") return [];
  const finding = (local: LocalId, site: MirViolationSite): Violation<MirRule, MirViolationSite> =>
    ({ rule: "storage-live-before-use", site, detail: [{ kind: "number", value: local }] });
  // An execution starts at block 0 or at the block of any entry. A block that does not stand at its own position is
  // not read, so what is reachable only through it gets no start and is not judged.
  const starts = [0, ...body.entries.map(entry => entry.block)];
  const rankOf = new Int32Array(body.blocks.length).fill(-1);
  const readings: StorageReading[] = [];
  // Per local, for the block or the record being read: `markedIn` and `usedIn` hold the number of the block and of
  // the record that last marked and last used the local, `liveAfter` what its last marker left.
  const markedIn = new Int32Array(body.locals.length);
  const liveAfter = new Uint8Array(body.locals.length);
  const usedIn = new Int32Array(body.locals.length);
  let record = 0;
  let last: StorageReading | null = null;
  for (const ordered of reversePostorder(body, starts)) {
    const block = ordered.block;
    if (!Object.is(block.id, ordered.position)) continue;
    const serial = readings.length + 1;
    const marked: LocalId[] = [];
    const decided: Violation<MirRule, MirViolationSite>[] = [];
    const awaiting: StorageUse[] = [];
    const requireLive = (local: LocalId, site: MirViolationSite): void => {
      if (markedIn[local] !== serial) awaiting.push({ local, site });
      else if (liveAfter[local] === 0) decided.push(finding(local, site));
    };
    // Within one record, operands in their order, each operand's locals in ascending order, each local once. False:
    // the account is exhausted.
    const use = (operands: readonly MirOperand[], site: MirViolationSite): boolean => {
      record += 1;
      for (const operand of operands) {
        if (operand.kind === "constant") continue;
        const selected = densePosition(operand.place, reaches.length) ? reaches[operand.place] : undefined;
        if (selected === undefined || selected === null) continue;
        const completed = eachLive(sets, selected, empty, span, local => {
          if (usedIn[local] === record) return;
          usedIn[local] = record;
          requireLive(localId(local), site);
        });
        if (!completed) return false;
      }
      return true;
    };
    for (const [position, statement] of block.statements.entries()) {
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      if (statement.kind === "assign") {
        if (!use([{ kind: "place", place: statement.place }, ...rvalueOperands(statement.value)], site)) return [];
      } else {
        const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
        if (local === undefined || !Object.is(local.id, statement.local)) continue;
        if (statement.kind === "storage-dead") requireLive(local.id, site);
        if (markedIn[local.id] !== serial) marked.push(local.id);
        markedIn[local.id] = serial;
        liveAfter[local.id] = statement.kind === "storage-live" ? 1 : 0;
      }
    }
    if (!use(terminatorOperands(block.terminator), { kind: "instruction", body: body.body, block: block.id, statement: null })) return [];
    rankOf[ordered.position] = readings.length;
    const reading: StorageReading = { rank: readings.length, block, changes: marked.map(local => ({ local, live: liveAfter[local] === 1 })),
      decided, awaiting, start: null, waiting: null, read: false, next: null };
    if (last !== null) last.next = reading;
    last = reading;
    readings.push(reading);
  }
  for (const start of starts) {
    const reading = readings[read(rankOf, start, -1)];
    if (reading === undefined) continue;
    reading.start = entry;
    reading.waiting = entry;
  }
  for (let from = readings[0] ?? null; from !== null;) {
    // The lowest block made to wait at or behind its reader: where the next sweep begins.
    let again: StorageReading | null = null;
    for (let reading: StorageReading | null = from; reading !== null; reading = reading.next) {
      const arrived = reading.waiting;
      if (arrived === null) continue;
      reading.waiting = null;
      const edges = controlEdges(reading.block.terminator);
      if (reading.read) {
        chargeWork(meter, edges.length);
        if (meter.exhausted) return [];
      }
      reading.read = true;
      let leaving = arrived;
      for (const change of reading.changes) {
        const changed = withLocal(sets, leaving, span, change.local, change.live);
        if (changed === null) return [];
        leaving = changed;
      }
      for (const edge of edges) {
        const target = readings[read(rankOf, edge.target, -1)];
        if (target === undefined) continue;
        const before = target.start;
        const met = before === null ? leaving : meetLive(sets, before, leaving);
        if (met === null) return [];
        if (met === before) continue;
        target.start = met;
        target.waiting = met;
        if (target.rank <= reading.rank && (again === null || target.rank < again.rank)) again = target;
      }
    }
    if (again !== null) {
      chargeWork(meter, readings.length - again.rank);
      if (meter.exhausted) return [];
    }
    from = again;
  }
  // Findings in the order of the blocks: what each block's own markers decide, then what depends on its start.
  // One lookup for each local the uses of a block await, however many of them there are.
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const late: Violation<MirRule, MirViolationSite>[] = [];
  const answeredIn = new Int32Array(body.locals.length);
  const answer = new Uint8Array(body.locals.length);
  for (const position of body.blocks.keys()) {
    const reading = readings[read(rankOf, position, -1)];
    if (reading === undefined || reading.start === null) continue;
    for (const violation of reading.decided) violations.push(violation);
    const serial = reading.rank + 1;
    for (const use of reading.awaiting) {
      if (answeredIn[use.local] !== serial) {
        answeredIn[use.local] = serial;
        const live = liveIn(sets, reading.start, span, use.local);
        if (live === null) return [];
        answer[use.local] = live ? 1 : 0;
      }
      if (answer[use.local] === 0) late.push(finding(use.local, use.site));
    }
  }
  for (const violation of late) violations.push(violation);
  return violations;
}

export interface StorageReference {
  readonly type: TyId;
  readonly site: MirViolationSite;
}

export interface SignatureReference {
  readonly signature: SigId;
  readonly site: MirViolationSite;
}

export interface ValueVerification {
  readonly violations: readonly Violation<MirRule, MirViolationSite>[];
  readonly types: readonly StorageReference[];
  readonly signatures: readonly SignatureReference[];
}

function literalMatches(value: LiteralValue, selected: LiteralTypeValue): boolean {
  switch (value.kind) {
    case "absence": return selected.kind === "absence";
    case "number": return selected.kind === "number" && value.value.numerator === selected.value.numerator
      && value.value.denominator === selected.value.denominator && value.value.negativeZero === selected.value.negativeZero;
    case "bigint": return selected.kind === "bigint" && value.value === selected.value;
    case "string": return selected.kind === "string" && value.value === selected.value;
    case "boolean": return selected.kind === "boolean" && value.value === selected.value;
    case "unique-symbol": return selected.kind === "unique-symbol" && value.declaration === selected.declaration;
  }
}

export function verifyValues(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>,
  places: ReadonlyMap<PlaceId, PlaceLocation>,
): ValueVerification {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const types: StorageReference[] = [];
  const signatures: SignatureReference[] = [];
  const report = (rule: MirRule, site: MirViolationSite): void => { violations.push({ rule, site, detail: [] }); };
  const term = (type: TyId): TypeTerm | null => densePosition(type, context.types.terms.length) ? context.types.terms[type] ?? null : null;
  const placeType = (place: PlaceId, site: MirViolationSite): TyId | null => {
    const selected = densePosition(place, body.places.length) ? body.places[place] : undefined;
    if (selected === undefined || !Object.is(selected.id, place)) { report("operand-resolves", site); return null; }
    return selected.storage;
  };
  const operandType = (operand: MirOperand, site: MirViolationSite): TyId | null => {
    if (operand.kind === "place") return placeType(operand.place, site);
    const constant = densePosition(operand.constant, body.constants.length) ? body.constants[operand.constant] : undefined;
    if (constant === undefined || !Object.is(constant.id, operand.constant)) { report("operand-resolves", site); return null; }
    return constant.type;
  };
  const match = (actual: TyId | null, expected: TyId, rule: MirRule, site: MirViolationSite): void => {
    if (actual !== null && !Object.is(actual, expected)) report(rule, site);
  };
  const selectedType = (node: SourceNode | undefined): TyId | null => {
    if (node === undefined) return null;
    const payload = node.node.tsonic;
    return payload !== null && "convertedType" in payload ? payload.type : null;
  };
  const operationResult = (value: MirRvalue & { readonly kind: "unary" | "binary" | "convert" }, site: MirViolationSite): TyId => {
    const decision = value.operation.decision;
    const operands = rvalueOperands(value);
    for (const type of decision.operands) types.push({ type, site });
    if (decision.operands.length !== operands.length) report("operation-selected", site);
    for (const [position, operand] of operands.entries()) {
      const actual = operandType(operand, site);
      const expected = decision.operands[position];
      if (expected !== undefined) match(actual, expected, "operation-selected", site);
    }
    types.push({ type: decision.result, site });
    if (value.kind === "convert") {
      types.push({ type: value.to, site });
      match(decision.result, value.to, "operation-selected", site);
    }
    return decision.result;
  };
  const rvalueType = (value: MirRvalue, node: SourceNode | undefined, site: MirViolationSite): TyId | null => {
    switch (value.kind) {
      case "use": return operandType(value.operand, site);
      case "unary": case "binary": case "convert": return operationResult(value, site);
      case "aggregate": {
        const expected = selectedType(node);
        if (expected !== null) match(value.type, expected, "operation-selected", site);
        const selected = term(value.type);
        const aggregate = value.aggregate;
        const operands = rvalueOperands(value);
        switch (aggregate.kind) {
          case "array": case "tuple": case "fixed-array": {
            if (selected !== null && selected.kind !== aggregate.kind) report("assignment-type", site);
            if (selected !== null && selected.kind === "fixed-array" && BigInt(aggregate.elements.length) !== selected.extent.length) report("assignment-type", site);
            let requiredTypes: readonly TyId[] | null = null;
            if (selected !== null && selected.kind === "tuple") {
              const prefixTypes: TyId[] = [];
              let required = 0;
              let rest = false;
              let prefix = true;
              for (const element of selected.elements) {
                if (element.kind === "required") {
                  required += 1;
                  if (prefix) prefixTypes.push(element.type);
                } else {
                  prefix = false;
                  if (element.kind === "rest") rest = true;
                }
              }
              if (aggregate.elements.length < required || !rest && aggregate.elements.length > selected.elements.length)
                report("assignment-type", site);
              requiredTypes = prefixTypes;
            }
            for (const [position, operand] of operands.entries()) {
              const actual = operandType(operand, site);
              if (selected !== null && (selected.kind === "array" || selected.kind === "fixed-array")) match(actual, selected.element, "assignment-type", site);
              if (requiredTypes !== null) {
                const expected = requiredTypes[position];
                if (expected !== undefined) match(actual, expected, "assignment-type", site);
              }
            }
            break;
          }
          case "object": case "record":
            for (const field of aggregate.fields) {
              const actual = operandType(field.value, site);
              const member = field.member.decision;
              if (member.read !== null && member.write !== null && Object.is(member.read, member.write))
                match(actual, member.read, "assignment-type", site);
            }
            break;
        }
        types.push({ type: value.type, site });
        return value.type;
      }
      case "address-of": {
        placeType(value.place, site);
        types.push({ type: value.type, site });
        const expected = selectedType(node);
        if (expected !== null) match(value.type, expected, "operation-selected", site);
        return value.type;
      }
      case "closure":
        for (const capture of value.captures) {
          if (placeType(capture.place, site) === null) continue;
          const location = places.get(capture.place);
          if (location === undefined) continue;
          const source = location.root === null ? null : location.root.source;
          if (source === null || source.body !== capture.local.body || !Object.is(source.local, capture.local.local))
            report("capture-location-exact", site);
        }
        return selectedType(node);
    }
  };
  for (const local of body.locals) {
    if (local === undefined) continue;
    const site: MirViolationSite = { kind: "local", body: body.body, local: local.id };
    types.push({ type: local.storage, site });
    if (local.role.kind === "completion") {
      const selected = term(local.storage);
      if (selected !== null && !(selected.kind === "primitive" && selected.primitive === "int32")) report("completion-selector-total", site);
    }
  }
  for (const constant of body.constants) {
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    types.push({ type: constant.type, site });
    const selected = term(constant.type);
    if (constant.value.kind === "literal" && selected !== null && selected.kind === "literal"
      && !literalMatches(constant.value.value, selected.value)) report("constant-type", site);
  }
  for (const [position, place] of body.places.entries()) {
    if (place === undefined) continue;
    const site: MirViolationSite = { kind: "place", body: body.body, place: place.id };
    types.push({ type: place.storage, site });
    if (place.base.kind !== "place" && place.base.kind !== "checked" || !densePosition(place.base.place, position)) continue;
    const parent = body.places[place.base.place];
    if (parent === undefined || !Object.is(parent.id, place.base.place)) continue;
    const parentTerm = term(parent.storage);
    const projection = place.base.projection;
    let projected: TyId | null = null;
    switch (projection.kind) {
      case "field": break;
      case "element":
        if (parentTerm !== null) {
          if (parentTerm.kind === "tuple") {
            const element = densePosition(projection.index, parentTerm.elements.length) ? parentTerm.elements[projection.index] : undefined;
            if (element === undefined) report("projection-valid", site);
            else projected = element.type;
          } else if (parentTerm.kind === "array" || parentTerm.kind === "fixed-array") {
            if (!Number.isSafeInteger(projection.index) || Object.is(projection.index, -0) || projection.index < 0
              || parentTerm.kind === "fixed-array" && BigInt(projection.index) >= parentTerm.extent.length) report("projection-valid", site);
            projected = parentTerm.element;
          } else report("projection-valid", site);
        }
        break;
      case "index":
        operandType(projection.operand, site);
        if (projection.operand.kind === "constant") {
          const constant = densePosition(projection.operand.constant, body.constants.length) ? body.constants[projection.operand.constant] : undefined;
          if (constant !== undefined && Object.is(constant.id, projection.operand.constant) && constant.value.kind === "metadata")
            report("metadata-constant-not-materialised", site);
        }
        if (parentTerm !== null) {
          if (parentTerm.kind === "array" || parentTerm.kind === "fixed-array") projected = parentTerm.element;
          else if (parentTerm.kind !== "shape" && parentTerm.kind !== "declared" && parentTerm.kind !== "construction-reference") report("projection-valid", site);
        }
        break;
      case "capture":
        if (!densePosition(projection.index, context.source.captures.length)) report("capture-location-exact", site);
        break;
      case "deref": break;
      case "refined": {
        // The place is the cell viewed at the type its node's narrowing selected.
        const node = place.base.tir.body === context.source.body ? findSourceNode(nodes, place.base.tir.node) : undefined;
        const expected = selectedType(node);
        if (expected !== null) match(place.storage, expected, "projection-type", site);
        break;
      }
    }
    if (projected !== null) match(place.storage, projected, "projection-type", site);
  }
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      if (statement.kind === "assign") {
        const source = statement.tir.body === context.source.body ? findSourceNode(nodes, statement.tir.node) : undefined;
        const actual = rvalueType(statement.value, source, site);
        const expected = placeType(statement.place, site);
        if (expected !== null) match(actual, expected, "assignment-type", site);
      } else {
        const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
        if (local === undefined || !Object.is(local.id, statement.local)) report("operand-resolves", site);
      }
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    const terminator = block.terminator;
    const sourceNode = terminator.tir.body === context.source.body ? findSourceNode(nodes, terminator.tir.node) : undefined;
    switch (terminator.kind) {
      case "goto": case "unreachable": break;
      case "switch":
        operandType(terminator.operand, site);
        for (const target of terminator.targets) operandType({ kind: "constant", constant: target.constant }, site);
        break;
      case "return":
        if (terminator.value !== null) match(operandType(terminator.value, site), body.result, "assignment-type", site);
        else {
          const result = term(body.result);
          if (result !== null && !(result.kind === "intrinsic" && (result.intrinsic === "void" || result.intrinsic === "absence"))) report("assignment-type", site);
        }
        break;
      case "check": placeType(terminator.place, site); break;
      case "call": {
        if (terminator.callee.kind === "body") {
          // The signature of an internal body is not a record of this context; operands and the destination resolve.
          for (const capture of terminator.callee.captures) placeType(capture.place, site);
          if (terminator.receiver !== null) operandType(terminator.receiver, site);
          if (terminator.arguments.length !== 0) report("call-arguments-total", site);
          if (terminator.destination !== null) placeType(terminator.destination, site);
          break;
        }
        const decision = terminator.callee.resolution.decision;
        signatures.push({ signature: decision.api.signature, site });
        signatures.push({ signature: decision.advertised.signature, site });
        signatures.push({ signature: decision.completion.signature, site });
        const signature = densePosition(decision.api.signature, context.types.signatures.length) ? context.types.signatures[decision.api.signature] : undefined;
        if (terminator.callee.kind === "indirect") {
          const actual = operandType(terminator.callee.operand, site);
          if (sourceNode !== undefined) {
            const node = sourceNode.node;
            if (node.kind === "CallExpression" || node.kind === "NewExpression") {
              const payload = node.expression.tsonic;
              if (payload !== null && "convertedType" in payload) match(actual, payload.convertedType, "operation-selected", site);
            }
            if (node.kind === "TaggedTemplateExpression") {
              const payload = node.tag.tsonic;
              if (payload !== null && "convertedType" in payload) match(actual, payload.convertedType, "operation-selected", site);
            }
          }
        }
        if (signature !== undefined) {
          if (signature.receiver === null) {
            if (terminator.receiver !== null) { operandType(terminator.receiver, site); report("call-receiver-exact", site); }
          } else if (terminator.receiver === null) report("call-receiver-exact", site);
          else match(operandType(terminator.receiver, site), signature.receiver, "call-receiver-exact", site);
          if (signature.parameters.length !== terminator.arguments.length) report("call-arguments-total", site);
          let omitting = false;
          for (const [position, argument] of terminator.arguments.entries()) {
            const parameter = signature.parameters[position];
            if (argument.kind === "omitted") {
              // A call may omit only what the callee's signature lets be omitted.
              if (parameter === undefined || parameter.kind !== "optional" && parameter.kind !== "default") report("omission-admitted", site);
              omitting = true;
              continue;
            }
            // Omitted fixed arguments are a suffix: an entry is named by a count. The rest vector is always supplied.
            if (omitting && (parameter === undefined || parameter.kind !== "rest")) report("omission-admitted", site);
            const actual = argument.kind === "value" ? operandType(argument.operand, site) : placeType(argument.place, site);
            if (parameter !== undefined) {
              if (argument.passing !== parameter.passing || actual !== null && !Object.is(actual, parameter.type))
                violations.push({ rule: "argument-passing-exact", site, detail: [{ kind: "number", value: position }] });
            }
          }
        } else {
          if (terminator.receiver !== null) operandType(terminator.receiver, site);
          for (const argument of terminator.arguments) {
            if (argument.kind === "value") operandType(argument.operand, site);
            else if (argument.kind === "place") placeType(argument.place, site);
          }
        }
        types.push({ type: decision.result, site });
        if (terminator.destination !== null) match(placeType(terminator.destination, site), decision.result, "call-destination-type", site);
        break;
      }
      case "invoke":
        for (const type of terminator.operation.decision.operands) types.push({ type, site });
        if (terminator.operands.length !== terminator.operation.decision.operands.length) report("operation-selected", site);
        for (const [position, operand] of terminator.operands.entries()) {
          const actual = operandType(operand, site);
          const expected = terminator.operation.decision.operands[position];
          if (expected !== undefined) match(actual, expected, "operation-selected", site);
        }
        types.push({ type: terminator.operation.decision.result, site });
        if (terminator.destination !== null) match(placeType(terminator.destination, site), terminator.operation.decision.result, "call-destination-type", site);
        break;
      case "await": case "yield": case "delegate": {
        if (terminator.kind === "delegate") operandType(terminator.iterator, site);
        else if (terminator.operand !== null) operandType(terminator.operand, site);
        const result = selectedType(sourceNode);
        const actual = placeType(terminator.destination, site);
        if (result !== null) match(actual, result, "call-destination-type", site);
        if (terminator.kind !== "await") match(placeType(terminator.return.destination, site), context.source.completion, "call-destination-type", site);
        break;
      }
      case "throw": operandType(terminator.operand, site); break;
    }
    if (terminator.kind !== "goto" && terminator.kind !== "switch" && terminator.kind !== "return" && terminator.kind !== "unreachable"
      && terminator.unwind.kind === "handler") {
      const storage = placeType(terminator.unwind.exception, site);
      if (storage !== null) {
        const selected = term(storage);
        if (selected !== null && !(selected.kind === "intrinsic" && selected.intrinsic === "unknown")) report("exception-destination-type", site);
      }
    }
  }
  const bodySite: MirViolationSite = { kind: "body", body: body.body };
  match(body.result, context.source.completion, "assignment-type", bodySite);
  types.push({ type: body.result, site: bodySite });
  return { violations, types, signatures };
}
