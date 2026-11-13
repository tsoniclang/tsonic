import type { Violation } from "../diag/contract.js";
import type { BlockId, NodeId, PlaceId } from "../ids/contract.js";
import type {
  MirBlock, MirBody, MirClosureCapture, MirLocal, MirOperand, MirPlace, MirRule, MirRvalue, MirStepRef, MirVerificationContext, MirViolationSite,
} from "./contract.js";
import { controlEdges, densePosition, findSourceNode } from "./verify-control.js";
import type { SourceNode, SourceStep, WireTexts } from "./verify-control.js";
import type { PlaceLocation } from "./verify-storage.js";

// The graph laws a lowered body satisfies beyond reference and type validity. Every check is a pass over the
// records of the body; none follows paths. Law numbers are those of the lowering specification's list of ten.
// Law 2 (a statement executes only a pure decision), the receiver half of law 4 and the agreement of a failure
// kind with its decision need the execution fields of the decision records and are added with them. Law 3 is
// enforced for every checked place as the contract states it; the stable kind for a fixed extent needs the extent
// field of the element access decision and is added with it.
export function verifyLaws(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>, texts: WireTexts,
  places: ReadonlyMap<PlaceId, PlaceLocation>,
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
    if (place.base.projection.kind === "refined") cellOf[position] = cellOf[place.base.place] ?? -1;
    checkedAbove[position] = place.base.kind === "checked" ? position : checkedAbove[place.base.place] ?? -1;
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
    writes[root] = (writes[root] ?? 0) + 1;
    const own = cellOf[place] ?? -1;
    if (own >= 0) cellWrites[own] = (cellWrites[own] ?? 0) + 1;
  };
  const handed = (place: PlaceId): void => {
    const root = rootOf(place);
    if (root === null) return;
    writes[root] = (writes[root] ?? 0) + 1;
    handedOut[root] = 1;
  };
  const captured = (captures: readonly MirClosureCapture[]): void => { for (const capture of captures) handed(capture.place); };
  // The locals that hold the result of a completion test (a step of role `done`).
  const completions = new Set<number>();
  const completion = (reference: MirStepRef | null, source: SourceNode | undefined, destination: PlaceId | null): void => {
    if (reference === null || source === undefined) return;
    const root = rootOf(destination);
    if (root !== null && named(reference, source)?.role === "done") completions.add(root);
  };
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const statement of block.statements) {
      if (statement.kind !== "assign") continue;
      written(statement.place);
      if (statement.value.kind === "address-of") handed(statement.value.place);
      else if (statement.value.kind === "closure") captured(statement.value.captures);
      completion(statement.step, sourceOf(statement.tir), statement.place);
    }
    const terminator = block.terminator;
    switch (terminator.kind) {
      case "call":
        written(terminator.destination);
        for (const argument of terminator.arguments) {
          if (argument.kind === "place" && argument.passing !== "byref-readonly" && argument.passing !== "borrow-shared") handed(argument.place);
        }
        if (terminator.callee.kind === "body") captured(terminator.callee.captures);
        completion(terminator.step, sourceOf(terminator.tir), terminator.destination);
        break;
      case "invoke":
        written(terminator.destination);
        completion(terminator.step, sourceOf(terminator.tir), terminator.destination);
        break;
      case "await": written(terminator.destination); break;
      case "yield": case "delegate": written(terminator.destination); written(terminator.return.destination); break;
      case "goto": case "switch": case "check": case "throw": case "return": case "unreachable": break;
    }
    if ("unwind" in terminator && terminator.unwind.kind === "handler") written(terminator.unwind.exception);
  }

  // Whether a checked place is of the stable kind (the contract's law 3), and the first checked place of each node.
  const stable = new Uint8Array(body.places.length);
  const checkedAt = new Map<NodeId, MirPlace>();
  for (const [position, place] of body.places.entries()) {
    if (place === undefined || place.base.kind !== "place" && place.base.kind !== "checked") continue;
    if (place.base.kind === "checked" && Object.is(place.id, position)) {
      if (place.base.tir.body === context.source.body) {
        const first = checkedAt.get(place.base.tir.node);
        if (first === undefined) checkedAt.set(place.base.tir.node, place);
        else if (!sameView(first, place)) reportPlace("check-place-single", place.id);
      }
      const parent = place.base.projection.kind === "refined" && densePosition(place.base.place, position) ? body.places[place.base.place] : undefined;
      if (parent !== undefined && parent.base.kind === "local" && densePosition(parent.base.local, body.locals.length)) {
        const local = body.locals[parent.base.local];
        const count = cellWrites[parent.base.local] ?? 0;
        if (local !== undefined && handedOut[parent.base.local] !== 1 && (presentOnEntry(local) ? count === 0 : count === 1)) stable[position] = 1;
      }
    }
    // A narrowed view of a cell exists only as the result of its check.
    if (place.base.projection.kind === "refined" && place.base.kind !== "checked") reportPlace("refined-under-check", place.id);
    // Law 4: an index, once evaluated, cannot be changed by a later write. It is a constant, or a local whose cell
    // is written once (an entry-present local that the body never writes counts as written once, at entry).
    if (place.base.projection.kind === "index" && place.base.projection.operand.kind === "place") {
      const operand = densePosition(place.base.projection.operand.place, body.places.length) ? body.places[place.base.projection.operand.place] : undefined;
      if (operand !== undefined && operand.base.kind === "local") {
        const local = densePosition(operand.base.local, body.locals.length) ? body.locals[operand.base.local] : undefined;
        const count = densePosition(operand.base.local, writes.length) ? writes[operand.base.local] ?? 0 : 0;
        if (!(local !== undefined && presentOnEntry(local) ? count === 0 : count === 1)) reportPlace("index-operand-stable", place.id);
      } else if (operand !== undefined) reportPlace("index-operand-stable", place.id);
    }
  }

  // Law 3: a checked place is used only where its check is known to have succeeded. Availability is read forwards
  // as the contract states it. Each block and record is visited once. Within a chain of blocks a set is cleared by
  // advancing a counter, and making a place available costs the number of index projections in its chain. Where an
  // edge is not continued along, the stable places available at its source are copied for its target, which keeps
  // those that arrive on every incoming edge: edges of that kind times stable places, in the worst case.
  const incoming = new Uint32Array(body.blocks.length);
  const edge = (target: BlockId): void => { if (densePosition(target, incoming.length)) incoming[target] = (incoming[target] ?? 0) + 1; };
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
  // A checked place is available when it was stamped with the current count of its kind.
  let clock = 2;
  let mutableNow = 1;
  let stableNow = 2;
  const stamp = new Uint32Array(body.places.length);
  const mutableLocals = new Uint32Array(body.locals.length);
  const stableLocals = new Uint32Array(body.locals.length);
  const endMutable = (): void => { clock += 1; mutableNow = clock; };
  // The stable places available now, in the order they became so; and, for each block not yet read, the lists
  // that have arrived on its incoming edges.
  const held: PlaceId[] = [];
  const arriving: (PlaceId[][] | undefined)[] = [];
  const nothing: PlaceId[] = [];
  const endStable = (): void => { clock += 1; stableNow = clock; held.length = 0; };
  const give = (target: number, facts: PlaceId[]): void => {
    if (!densePosition(target, incoming.length)) return;
    const lists = arriving[target];
    if (lists === undefined) arriving[target] = [facts]; else lists.push(facts);
  };
  /** What a failure or suspension-return edge carries: the stable places, unless the value the edge delivers is written into a local one of them depends on. */
  const carried = (now: PlaceId[], delivered: PlaceId): PlaceId[] => {
    const root = rootOf(delivered);
    return root !== null && stableLocals[root] === stableNow ? nothing : now;
  };
  const available = (checked: number): boolean => stamp[checked] === (stable[checked] === 1 ? stableNow : mutableNow);
  const use = (place: PlaceId | null, block: BlockId, statement: number | null): void => {
    if (place === null || !densePosition(place, checkedAbove.length)) return;
    const checked = checkedAbove[place] ?? -1;
    if (checked >= 0 && !available(checked)) reportAt("checked-place-available", block, statement);
  };
  const useOperand = (operand: MirOperand | null, block: BlockId, statement: number | null): void => {
    if (operand !== null && operand.kind === "place") use(operand.place, block, statement);
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
    if (place === null || !densePosition(place, cellOf.length)) return;
    const own = cellOf[place] ?? -1;
    if (own >= 0) touched(own);
    if (own < 0 || handedOut[own] === 1) endMutable();
  };
  const delivered = (place: PlaceId | null, block: BlockId): void => { use(place, block, null); stored(place); };
  const begin = (checked: PlaceId): void => {
    const place = densePosition(checked, body.places.length) ? body.places[checked] : undefined;
    if (place === undefined || place.base.kind !== "checked" || !Object.is(place.id, checked)) return;
    const above = densePosition(place.base.place, checkedAbove.length) ? checkedAbove[place.base.place] ?? -1 : -1;
    if (above >= 0 && !available(above)) return;
    const kind = stable[checked] === 1;
    const now = kind ? stableNow : mutableNow;
    const locals = kind ? stableLocals : mutableLocals;
    if (kind && stamp[checked] !== now) held.push(checked);
    stamp[checked] = now;
    const location = places.get(checked);
    if (location === undefined) return;
    if (location.root !== null) locals[location.root.id] = now;
    for (let index = location.indices; index !== null; index = index.parent) {
      const root = rootOf(index.place);
      if (root !== null) locals[root] = now;
    }
  };
  const visited = new Uint8Array(body.blocks.length);
  const arrivals = new Uint32Array(body.places.length);
  const arrivedAt = new Uint32Array(body.places.length);
  let merges = 0;
  const chain = (head: number): void => {
    endMutable();
    endStable();
    // The stable places that arrive on every incoming edge. An entry, and an edge whose source is not read yet,
    // deliver no list, so the count of lists falls short of the count of edges and nothing is kept.
    const lists = arriving[head];
    arriving[head] = undefined;
    const first = lists === undefined ? undefined : lists[0];
    if (lists !== undefined && first !== undefined && lists.length === incoming[head]) {
      merges += 1;
      for (const list of lists) for (const fact of list) {
        if (arrivedAt[fact] !== merges) { arrivedAt[fact] = merges; arrivals[fact] = 0; }
        arrivals[fact] = (arrivals[fact] ?? 0) + 1;
      }
      for (const fact of first) if (arrivals[fact] === lists.length) begin(fact);
    }
    for (let position = head; position >= 0 && visited[position] !== 1;) {
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
      // What the edges that leave before the terminator's effect carry: built once, and only if such an edge exists.
      let before: PlaceId[] | null = null;
      const now = (): PlaceId[] => {
        if (before === null) before = held.length === 0 ? nothing : held.slice();
        return before;
      };
      switch (terminator.kind) {
        case "goto": case "unreachable": break;
        case "switch":
          useOperand(terminator.operand, block.id, null);
          for (const target of terminator.targets) give(target.target, now());
          give(terminator.otherwise, now());
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
      if ("unwind" in terminator && terminator.unwind.kind === "handler") give(terminator.unwind.target, carried(now(), terminator.unwind.exception));
      if (terminator.kind === "yield" || terminator.kind === "delegate") give(terminator.return.target, carried(now(), terminator.return.destination));
      switch (terminator.kind) {
        case "call": case "invoke": case "await": case "yield": case "delegate":
          endMutable();
          delivered(terminator.destination, block.id);
          break;
        case "check": begin(terminator.place); break;
        case "goto": case "switch": case "throw": case "return": case "unreachable": break;
      }
      const next = continuation(block);
      const target = continues(block);
      if (next < 0 && target >= 0) give(target, held.length === 0 ? nothing : held.slice());
      position = next;
    }
  };
  // Blocks are read in reverse postorder of the control edges, from the entries and then from every block not
  // reached, so that the sources of a block's forward edges are read before it. A chain is read from its head.
  const postorder: number[] = [];
  const reached = new Uint8Array(body.blocks.length);
  const search = (root: number): void => {
    const start = densePosition(root, reached.length) ? body.blocks[root] : undefined;
    if (start === undefined || reached[root] === 1) return;
    reached[root] = 1;
    const path: number[] = [root];
    const edges: (readonly { readonly target: BlockId }[])[] = [controlEdges(start.terminator)];
    const cursor: number[] = [0];
    while (path.length > 0) {
      const top = path.length - 1;
      const out = edges[top];
      const at = cursor[top] ?? 0;
      const candidate = out === undefined ? undefined : out[at];
      if (candidate === undefined) {
        const done = path.pop();
        if (done !== undefined) postorder.push(done);
        edges.pop();
        cursor.pop();
        continue;
      }
      cursor[top] = at + 1;
      const block = densePosition(candidate.target, reached.length) ? body.blocks[candidate.target] : undefined;
      if (block === undefined || reached[candidate.target] === 1) continue;
      reached[candidate.target] = 1;
      path.push(candidate.target);
      edges.push(controlEdges(block.terminator));
      cursor.push(0);
    }
  };
  for (const entry of body.entries) search(entry.block);
  for (const position of body.blocks.keys()) search(position);
  for (let index = postorder.length - 1; index >= 0; index -= 1) {
    const position = postorder[index];
    if (position !== undefined && inherits[position] !== 1 && visited[position] !== 1) chain(position);
  }
  // Blocks left over form a closed ring that nothing enters; each is read once all the same.
  for (const [position, block] of body.blocks.entries()) if (block !== undefined && visited[position] !== 1) chain(position);

  // Law 6: a protocol step names its step. A record that names a step executes that step's callee or operation, and
  // a record that executes the callee or operation of a step of its node's protocols names it. A record that names
  // a step and carries no selection of its own (a call of an internal body, an assignment without an operation) is
  // held to the step's form only.
  const step = (reference: MirStepRef | null, source: SourceNode | undefined, callee: string | null, operation: string | null,
    block: BlockId, statement: number | null): void => {
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
  };
  const hasRole = (source: SourceNode, role: SourceStep["role"]): boolean => source.steps.some(row => row.some(candidate => candidate.role === role));
  const completionOperand = (operand: MirOperand): boolean => {
    const root = operand.kind === "place" ? rootOf(operand.place) : null;
    return root !== null && completions.has(root);
  };

  const effects = new Set<string>();
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind === "assign") {
        const source = sourceOf(statement.tir);
        if (source === undefined || statement.step === null && source.steps.length === 0) continue;
        const value = statement.value;
        step(statement.step, source, null, value.kind === "unary" || value.kind === "binary" || value.kind === "convert"
          ? texts.operation(value.operation) : null, block.id, position);
        continue;
      }
      // Law 8: a local that is present on entry carries no begin marker.
      if (statement.kind !== "storage-live") continue;
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
        break;
      }
      case "call": case "await": case "yield": case "delegate": case "throw":
        if (terminator.unwind.kind !== "handler" && terminator.unwind.kind !== "escape") reportAt("failure-kind-exact", block.id, null);
        break;
      case "invoke": case "goto": case "switch": case "return": case "unreachable": break;
    }
    // Laws 5 and 9: no effect occurrence, and no completion branch, is emitted twice. The occurrence is the node, the
    // step and the selection executed.
    let occurrence: string | null = null;
    switch (terminator.kind) {
      case "call": {
        const callee = terminator.callee.kind === "body" ? null : texts.callee(terminator.callee.resolution);
        step(terminator.step, source, callee, null, block.id, null);
        occurrence = terminator.callee.kind === "body" ? `body:${terminator.callee.instance.body}` : `call:${callee}`;
        break;
      }
      case "invoke": {
        const operation = texts.operation(terminator.operation);
        step(terminator.step, source, null, operation, block.id, null);
        occurrence = `invoke:${operation}`;
        break;
      }
      case "await": {
        occurrence = terminator.kind;
        if (source === undefined) break;
        // An await at a node whose protocols list an await step is that step.
        if (terminator.step === null ? hasRole(source, "await") : named(terminator.step, source)?.role !== "await")
          reportAt("protocol-step-exact", block.id, null);
        break;
      }
      case "yield": case "delegate": {
        occurrence = terminator.kind;
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
        if (terminator.step === null) {
          // A branch on the result of a completion test is the completion branch and names the step.
          if (completionOperand(terminator.operand)) reportAt("protocol-step-exact", block.id, null);
          break;
        }
        if (source !== undefined && named(terminator.step, source)?.role !== "done") reportAt("protocol-step-exact", block.id, null);
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
  return violations;
}

/** Whether two checked places of one node are the same view: one parent and, for an element, one index. */
function sameView(first: MirPlace, second: MirPlace): boolean {
  if (first.base.kind !== "checked" || second.base.kind !== "checked" || !Object.is(first.base.place, second.base.place)) return false;
  const one = first.base.projection;
  const other = second.base.projection;
  if (one.kind === "index" && other.kind === "index") {
    return one.operand.kind === "place" ? other.operand.kind === "place" && Object.is(one.operand.place, other.operand.place)
      : other.operand.kind === "constant" && Object.is(one.operand.constant, other.operand.constant);
  }
  if (one.kind === "element" && other.kind === "element") return Object.is(one.index, other.index);
  return one.kind === other.kind;
}
