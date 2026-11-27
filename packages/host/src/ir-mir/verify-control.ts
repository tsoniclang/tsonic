import type { Violation } from "../diag/contract.js";
import type { BlockId, BodyId, DefId, NodeId, NodeRef, Origin, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { callableEndpointKey, hasOverloadEndpoints, selectedEndpointRoleFaults } from "../ir-hir/index.js";
import type { ApplicationDecision } from "../ir-infer/contract.js";
import type { BodyInstance } from "../ir-types/contract.js";
import type { ChapterSyntaxSlots, MemberSelection, ResolvedCallee, TirBody, TirChapterSyntax, TirProtocol, TirProtocolStep, TirSyntaxOccurrence, TypedOperation } from "../ir-tir/contract.js";
import { chapterSyntaxSlots, indexChapterSyntax, layoutObservationOf, rawValueTypeOf, tirBodySyntaxOf } from "../ir-tir/index.js";
import { wireText } from "./text.js";
import type { DecisionWires } from "./text-decisions.js";
import type { MirBlock, MirBody, MirControlEdgeKind, MirControlProjection, MirExecutionEdge, MirExecutionPoint, MirFixedControlEdge, MirRule, MirSite, MirTerminator, MirUnwind, MirVerificationContext, MirViolationSite, VisitMirControlEdges } from "./contract.js";
import { prepareExecutionGraph } from "./completion.js";
import type { CleanupDeparture } from "./verify-departure.js";
import { verifyRequiredDepartures } from "./verify-departure.js";

interface EndpointFamily {
  readonly overloaded: boolean;
  readonly members: ReadonlySet<string>;
}

export type ControlEdge = MirFixedControlEdge | MirExecutionEdge;

export type ControlInventory = readonly (readonly ControlEdge[] | undefined)[];

export function controlAt(control: ControlInventory, position: number): readonly ControlEdge[] {
  const row = control[position];
  if (row === undefined) throw new TypeError("A verified block requires its retained control edges.");
  return row;
}

export function edgePosition(edge: ControlEdge): number {
  return "point" in edge ? edge.point : edge.target;
}

export interface ControlFlow {
  readonly qualified: boolean;
  readonly fixed: ControlInventory;
  readonly length: number;
  readonly entries: readonly number[];
  readonly blockAt: (position: number) => MirBlock | undefined;
  readonly edgesAt: (position: number) => readonly ControlEdge[];
}

export function ordinaryControl(body: MirBody, control: ControlInventory): ControlFlow {
  return { qualified: false, fixed: control, length: body.blocks.length, entries: body.entries.map(entry => entry.block),
    blockAt: position => body.blocks[position], edgesAt: position => controlAt(control, position) };
}

function qualifiedControl(fixed: ControlInventory, points: readonly MirExecutionPoint[], roots: readonly number[]): ControlFlow {
  return { qualified: true, fixed, length: points.length, entries: roots,
    blockAt: position => points[position]?.block,
    edgesAt: position => {
      const point = points[position];
      if (point === undefined) throw new TypeError("A qualified MIR point requires its complete successor row.");
      return point.edges;
    } };
}

export function readContinuation(control: ControlFlow, position: number): number {
  const edge = control.edgesAt(position)[0];
  if (edge === undefined) throw new TypeError("A continuing terminator requires its retained successor.");
  return edgePosition(edge);
}

function visitUnwindEdge<Stop>(unwind: MirUnwind, projection: MirControlProjection<Stop>): Stop | null {
  if (unwind.kind !== "handler" && unwind.kind !== "carry") return null;
  const stop = projection.admit();
  if (stop !== null) return stop;
  if (projection.kind === "targets") projection.visit(unwind.target);
  else if (projection.kind === "topology") projection.visit(unwind.kind === "carry" ? "carry" : "unwind", unwind.target);
  else if (unwind.kind === "handler") projection.visit("unwind", unwind.target, unwind.exception);
  else projection.visit("carry", unwind.target, null);
  return null;
}

function visitAdmittedEdge<Stop>(projection: MirControlProjection<Stop>, kind: Exclude<MirControlEdgeKind, "unwind">,
  target: BlockId, write: { readonly destination: PlaceId | null } | null): void {
  if (projection.kind === "targets") projection.visit(target);
  else if (projection.kind === "topology") projection.visit(kind, target);
  else projection.visit(kind, target, write === null ? null : write.destination);
}

export const visitControlEdges: VisitMirControlEdges = (terminator, projection) => {
  switch (terminator.kind) {
    case "goto": case "cleanup-enter": case "cleanup-discard": {
      const stop = projection.admit();
      if (stop !== null) return stop;
      visitAdmittedEdge(projection, "normal", terminator.kind === "cleanup-enter" ? terminator.entry : terminator.target, null);
      return null;
    }
    case "switch": {
      const targets = terminator.targets;
      for (let index = 0; index < targets.length; index += 1) {
        const stop = projection.admit();
        if (stop !== null) return stop;
        const target = targets[index];
        if (target === undefined) throw new TypeError("A MIR switch requires its actual indexed successor.");
        visitAdmittedEdge(projection, "normal", target.target, null);
      }
      const stop = projection.admit();
      if (stop !== null) return stop;
      visitAdmittedEdge(projection, "normal", terminator.otherwise, null);
      return null;
    }
    case "check": case "call": case "invoke": {
      const stop = projection.admit();
      if (stop !== null) return stop;
      visitAdmittedEdge(projection, "normal", terminator.next, terminator.kind === "check" ? null : terminator);
      return visitUnwindEdge(terminator.unwind, projection);
    }
    case "await": case "yield": case "delegate": {
      const stop = projection.admit();
      if (stop !== null) return stop;
      visitAdmittedEdge(projection, "resume", terminator.resume, terminator);
      if (terminator.kind !== "await") {
        const endStop = projection.admit();
        if (endStop !== null) return endStop;
        const returned = terminator.return;
        visitAdmittedEdge(projection, "suspension-return", returned.target, returned);
      }
      return visitUnwindEdge(terminator.unwind, projection);
    }
    case "throw": case "unwind-propagate": return visitUnwindEdge(terminator.unwind, projection);
    case "cleanup-resume": case "return": case "unreachable": return null;
  }
};

/** A block with its position in the body. */
export interface OrderedBlock {
  readonly position: number;
  readonly block: MirBlock;
}

/**
 * The blocks reachable from `roots` along control edges, in reverse postorder of one depth-first walk: a block comes
 * after the source of each of its edges that is not a back edge of that walk. Roots are taken in the order given; a
 * position that holds no block is skipped.
 */
export function reversePostorder(control: ControlFlow, roots: readonly number[]): readonly OrderedBlock[] {
  const postorder: OrderedBlock[] = [];
  const reached = new Uint8Array(control.length);
  for (const root of roots) {
    const start = densePosition(root, reached.length) ? control.blockAt(root) : undefined;
    if (start === undefined || reached[root] === 1) continue;
    reached[root] = 1;
    const frames: SearchFrame[] = [{ position: root, block: start, edges: control.edgesAt(root), next: 0 }];
    for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) {
      const candidate = frame.edges[frame.next];
      if (candidate === undefined) {
        postorder.push({ position: frame.position, block: frame.block });
        frames.pop();
        continue;
      }
      frame.next += 1;
      const target = edgePosition(candidate);
      const block = densePosition(target, reached.length) ? control.blockAt(target) : undefined;
      if (block === undefined || reached[target] === 1) continue;
      reached[target] = 1;
      frames.push({ position: target, block, edges: control.edgesAt(target), next: 0 });
    }
  }
  return postorder.reverse();
}

/** One block on the path of the depth-first walk, with the edge it looks at next. */
interface SearchFrame {
  readonly position: number;
  readonly block: MirBlock;
  readonly edges: readonly ControlEdge[];
  next: number;
}

/**
 * The number a table holds at a position, or `outside` for a position the table does not have. The verifier's tables
 * are sized by the body's rows, so a position outside one comes only from a record that names a row the body does
 * not have; that defect is reported by the rule that owns the reference.
 */
export function read(table: ArrayLike<number>, position: number, outside: number): number {
  const value = table[position];
  return value === undefined ? outside : value;
}

export function densePosition(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value < length;
}

export function verifyEdges(body: MirBody, meter: WorkMeter): {
  readonly control: ControlInventory;
  readonly ordinary: ControlFlow;
  readonly completion: boolean;
  readonly violations: readonly Violation<MirRule, MirViolationSite>[];
} | null {
  if (!admitWork(meter, 1)) return null;
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const control: (readonly ControlEdge[] | undefined)[] = [];
  let completion = false;
  const entry = body.blocks[0];
  if (entry === undefined || !Object.is(entry.id, 0)) violations.push({ rule: "entry-block-zero",
    site: { kind: "body", body: body.body }, detail: [] });
  const blocks = body.blocks;
  for (let position = 0; position < blocks.length; position += 1) {
    if (!admitWork(meter, 1)) return null;
    const block = blocks[position];
    if (block === undefined) continue;
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    const terminator = block.terminator;
    const row: ControlEdge[] = [];
    const stopped = visitControlEdges(terminator, { kind: "edges",
      admit: () => admitWork(meter, 1) ? null : true,
      visit: (kind, target, destination) => { row.push({ kind, target, destination }); } });
    if (stopped !== null) return null;
    completion ||= isCompletionControl(terminator);
    control[position] = row;
    for (const edge of row) {
      if (!admitWork(meter, 1)) return null;
      const target = densePosition(edge.target, blocks.length) ? blocks[edge.target] : undefined;
      if (target === undefined || !Object.is(target.id, edge.target)) violations.push({ rule: "edge-target-resolves", site,
        detail: [{ kind: "text", value: edge.kind }, { kind: "number", value: edge.target }] });
    }
    if (terminator.kind !== "switch") continue;
    const selected = new Set<string>();
    let previous: number | null = null;
    const targets = terminator.targets;
    for (let index = 0; index < targets.length; index += 1) {
      if (!admitWork(meter, 1)) return null;
      const target = targets[index];
      if (target === undefined) throw new TypeError("A MIR switch requires its actual indexed successor.");
      const key = encodeKey(target.constant);
      if (selected.has(key)) violations.push({ rule: "switch-target-unique", site,
        detail: [{ kind: "number", value: target.constant }] });
      selected.add(key);
      if (previous !== null && !(previous < target.constant)) violations.push({ rule: "switch-targets-order", site,
        detail: [{ kind: "number", value: previous }, { kind: "number", value: target.constant }] });
      previous = target.constant;
    }
  }
  if (!admitWork(meter, body.entries.length)) return null;
  return { control, ordinary: ordinaryControl(body, control), completion, violations };
}

export function isCompletionControl(terminator: MirTerminator): boolean {
  return terminator.kind === "cleanup-enter" || terminator.kind === "cleanup-resume" || terminator.kind === "cleanup-discard"
    || terminator.kind === "unwind-propagate" || "unwind" in terminator && terminator.unwind.kind === "carry";
}

export function verifyCompletionControl(body: MirBody, control: ControlInventory, nodes: ReadonlyMap<NodeId, SourceNode>, meter: WorkMeter):
  { readonly kind: "complete"; readonly control: ControlFlow } | { readonly kind: "invalid"; readonly violation: Violation<MirRule, MirViolationSite> }
  | { readonly kind: "resource-stop" } {
  const invalid = (block: BlockId, reason: string): { readonly kind: "invalid"; readonly violation: Violation<MirRule, MirViolationSite> } =>
    ({ kind: "invalid", violation: { rule: "cleanup-control-exact", site: { kind: "instruction", body: body.body, block, statement: null },
      detail: [{ kind: "text", value: reason }] } });
  const admit = (work: number, retained: number): "stop" | null => {
    chargeWork(meter, work + retained);
    return meter.exhausted ? "stop" : null;
  };
  if (admit(1, 3) !== null) return { kind: "resource-stop" };
  const entries = new Map<NodeId, BlockId>();
  const departures = new Map<BlockId, CleanupDeparture>();
  const roots: BlockId[] = [];
  for (let position = 0; position < body.entries.length; position += 1) {
    if (admit(1, 1) !== null) return { kind: "resource-stop" };
    const row = body.entries[position];
    if (row === undefined) continue;
    roots.push(row.block);
  }
  for (let position = 0; position < body.blocks.length; position += 1) {
    if (admit(1, 0) !== null) return { kind: "resource-stop" };
    const block = body.blocks[position];
    if (block === undefined) continue;
    const terminator = block.terminator;
    if (terminator.kind !== "cleanup-enter" && terminator.kind !== "cleanup-resume" && terminator.kind !== "cleanup-discard") continue;
    if (admit(5, 0) !== null) return { kind: "resource-stop" };
    const target = body.blocks[terminator.entry];
    const node = target?.tir.body === body.body ? nodes.get(target.tir.node)?.node : undefined;
    const owner = node?.parent === null || node?.parent === undefined ? undefined : nodes.get(node.parent)?.node;
    if (target?.id !== terminator.entry || node?.kind !== "Block" || owner?.kind !== "TryStatement" || owner.finallyBlock !== node)
      return invalid(block.id, "source-cleanup-entry");
    if (terminator.tir.body !== body.body) return invalid(block.id, "cleanup-source-owner");
    if (terminator.kind === "cleanup-resume") {
      if (terminator.tir.node !== owner.id) return invalid(block.id, "source-cleanup-resume");
    } else {
      if (admit(1, 0) !== null) return { kind: "resource-stop" };
      let site = nodes.get(terminator.tir.node)?.node;
      while (site !== undefined && site.id !== owner.id && site.parent !== owner.id && site.parent !== null) {
        if (admit(1, 0) !== null) return { kind: "resource-stop" };
        site = nodes.get(site.parent)?.node;
      }
      const isProtected = site === owner || site === owner.tryBlock || site === owner.catchClause;
      if (terminator.kind === "cleanup-enter" ? !isProtected : site !== node) return invalid(block.id, "cleanup-source-region");
    }
    const entry = entries.get(node.id);
    if (entry !== undefined && entry !== target.id) return invalid(block.id, "duplicate-source-entry");
    if (entry === undefined) {
      if (admit(1, 1) !== null) return { kind: "resource-stop" };
      entries.set(node.id, target.id);
    }
    if (terminator.kind !== "cleanup-resume") {
      if (admit(2, 0) !== null) return { kind: "resource-stop" };
      const continuation = terminator.kind === "cleanup-enter" ? terminator.continuation : terminator.target;
      const destination = body.blocks[continuation];
      if (destination?.tir.body !== body.body || destination.tir.node !== terminator.tir.node)
        return invalid(block.id, "cleanup-continuation-source");
      const previous = departures.get(continuation);
      if (previous !== undefined) {
        if (previous.kind !== "cleanup-enter" || terminator.kind !== "cleanup-enter" || previous.entry !== target.id
          || previous.source !== terminator.tir.node) return invalid(block.id, "cleanup-continuation-source");
        continue;
      }
      if (admit(1, 2) !== null) return { kind: "resource-stop" };
      departures.set(continuation, { from: block.id, entry: target.id, source: terminator.tir.node, owner, kind: terminator.kind });
    }
  }
  const result = prepareExecutionGraph(body, roots, block => controlAt(control, block), admit);
  if (result.kind === "resource-stop") return { kind: "resource-stop" };
  if (result.kind === "invalid") return invalid(result.block, result.reason);
  const departure = verifyRequiredDepartures(body.body, result.points, result.roots, id => nodes.get(id)?.node, entries, departures, admit);
  if (departure === "stop") return { kind: "resource-stop" };
  if (departure !== null) return invalid(departure.block, departure.reason);
  return { kind: "complete", control: qualifiedControl(control, result.points, result.roots) };
}

export interface SourceNode {
  readonly node: TirSyntaxOccurrence;
  readonly operations: ReadonlySet<string>;
  readonly callees: ReadonlySet<string>;
  readonly protocols: readonly TirProtocol[];
  /** Per protocol of the node, per step: the text of its selected operation and of its callee, if it has one. */
  readonly steps: readonly (readonly SourceStep[])[];
  readonly bodies: ReadonlySet<BodyId>;
}

/** The account of one body's verification (`MirVerificationLimits`). A pass stops reading once it is exhausted. */
export interface WorkMeter {
  spent: number;
  readonly maximum: number;
  exhausted: boolean;
}

export function chargeWork(meter: WorkMeter, units: number): void {
  if (meter.exhausted) return;
  if (units > meter.maximum - meter.spent) {
    meter.exhausted = true;
    return;
  }
  meter.spent += units;
}

export function admitWork(meter: WorkMeter, units: number): boolean {
  chargeWork(meter, units);
  return !meter.exhausted;
}

export interface SourceStep {
  readonly role: TirProtocolStep["role"];
  readonly operation: string;
  readonly callee: string | null;
}

/** The text of a selected callee or operation, computed once per record and shared by every rule that compares it. */
export interface WireTexts {
  readonly callee: (selected: ResolvedCallee) => string;
  readonly operation: (selected: TypedOperation) => string;
}

export function createWireTexts(wires: DecisionWires): WireTexts {
  const callees = new Map<ResolvedCallee, string>();
  const operations = new Map<TypedOperation, string>();
  return {
    callee: selected => {
      let text = callees.get(selected);
      if (text === undefined) { text = wireText(wires.calleeWire, selected); callees.set(selected, text); }
      return text;
    },
    operation: selected => {
      let text = operations.get(selected);
      if (text === undefined) { text = wireText(wires.operationWire, selected); operations.set(selected, text); }
      return text;
    },
  };
}

export function findSourceNode(nodes: ReadonlyMap<NodeId, SourceNode>, identity: NodeId): SourceNode | undefined {
  return Number.isSafeInteger(identity) && !Object.is(identity, -0) && identity >= 0 ? nodes.get(identity) : undefined;
}

const mirOccurrenceSlots: ChapterSyntaxSlots = function* (subject) {
  const { kind } = subject.node;
  const callable = kind === "FunctionDeclaration" || kind === "FunctionExpression" || kind === "ArrowFunction"
    || kind === "Constructor" || kind === "MethodDeclaration" || kind === "GetAccessor" || kind === "SetAccessor";
  const initializer = kind === "PropertyDeclaration" || kind === "PropertySignature" || kind === "EnumMember"
    || kind === "VariableDeclaration" || kind === "Parameter";
  for (const slot of chapterSyntaxSlots(subject)) {
    const field = slot.fields[0];
    if (field === "parameters" && callable || field === "initializer" && initializer
      || field === "body" && (callable || kind === "ClassStaticBlockDeclaration" || kind === "ModuleDeclaration")) continue;
    yield slot;
  }
};

export function sourceNodes(source: TirBody, texts: WireTexts, meter: WorkMeter):
  { readonly nodes: ReadonlyMap<NodeId, SourceNode>; readonly cleanup: boolean } | null {
  if (!admitWork(meter, 1)) return null;
  function* roots(): Generator<TirChapterSyntax> {
    if (!admitWork(meter, 1)) return;
    yield tirBodySyntaxOf(source.root);
    const params = source.params;
    for (let position = 0; position < params.length; position += 1) {
      if (!admitWork(meter, 1)) return;
      const node = params[position];
      if (node === undefined) throw new TypeError("The selected source requires its actual indexed formal.");
      yield { kind: "formal", node };
    }
  }
  const nodes = new Map<NodeId, SourceNode>();
  let cleanup = false;
  for (const subject of indexChapterSyntax(roots(), mirOccurrenceSlots, () => admitWork(meter, 1))) {
    if (subject.kind === "checked") continue;
    if (!admitWork(meter, 1)) return null;
    const node = subject.node;
    cleanup ||= node.kind === "TryStatement" && node.finallyBlock !== null;
    if (nodes.has(node.id)) throw new TypeError("The selected source roots contain conflicting syntax occurrences.");
    const operations = new Set<string>();
    const callees = new Set<string>();
    const protocols: TirProtocol[] = [];
    const bodies = new Set<BodyId>();
    const operation = (selected: TypedOperation): void => { operations.add(texts.operation(selected)); };
    const selection = (selected: MemberSelection): void => {
      if (selected.getter !== null) callees.add(texts.callee(selected.getter));
      if (selected.setter !== null) callees.add(texts.callee(selected.setter));
    };
    const payload = node.tsonic;
    if (payload !== null) {
      if ("operation" in payload && payload.operation !== null && payload.operation.kind === "decided") operation(payload.operation.decision);
      if ("calculation" in payload && payload.calculation !== null && payload.calculation.kind === "decided") operation(payload.calculation.decision);
      if ("construction" in payload && payload.construction.kind === "decided") operation(payload.construction.decision);
      // Both arms of a conversion carry the operation that performs it: the conversion identity, or the core or
      // library operation that backs it.
      if ("conversion" in payload && (payload.conversion.kind === "convert" || payload.conversion.kind === "backed-convert"))
        operation(payload.conversion.operation);
      if ("application" in payload && payload.application !== null && payload.application.kind === "decided"
        && "callee" in payload.application.decision) callees.add(texts.callee(payload.application.decision.callee));
      if ("selection" in payload && payload.selection !== null && payload.selection.kind === "decided") {
        selection(payload.selection.decision);
      }
      if ("member" in payload && payload.member.kind === "decided") selection(payload.member.decision);
      if ("protocol" in payload && payload.protocol.kind === "decided") protocols.push(payload.protocol.decision);
      if ("protocols" in payload) {
        const offered = payload.protocols;
        for (let position = 0; position < offered.length; position += 1) {
          if (!admitWork(meter, 1)) return null;
          const protocol = offered[position];
          if (protocol !== undefined && protocol.kind === "decided") protocols.push(protocol.decision);
        }
      }
      // The bodies a node executes by a call of its own: the initializer of the binding, parameter or storage it
      // declares. A template is the body of a closure or a declaration, which a call of an internal body never runs.
      if ("initializer" in payload && payload.initializer !== null) bodies.add(payload.initializer);
    }
    const steps: SourceStep[][] = [];
    for (const protocol of protocols) {
      const row: SourceStep[] = [];
      const selected = protocol.steps;
      for (let position = 0; position < selected.length; position += 1) {
        if (!admitWork(meter, 1)) return null;
        const step = selected[position];
        if (step === undefined) throw new TypeError("The selected source protocol requires its actual indexed step.");
        const operationText = texts.operation(step.operation);
        const calleeText = step.callee === null ? null : texts.callee(step.callee);
        operations.add(operationText);
        if (calleeText !== null) callees.add(calleeText);
        row.push({ role: step.role, operation: operationText, callee: calleeText });
      }
      steps.push(row);
    }
    nodes.set(node.id, { node, operations, callees, protocols, steps, bodies });
  }
  return meter.exhausted ? null : { nodes, cleanup };
}

export function validOrigin(origin: Origin): boolean {
  return Number.isSafeInteger(origin.start) && !Object.is(origin.start, -0) && origin.start >= 0
    && Number.isSafeInteger(origin.length) && !Object.is(origin.length, -0) && origin.length >= 0
    && Number.isSafeInteger(origin.start + origin.length);
}

export function verifySelections(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>, texts: WireTexts,
  internalBody: (instance: BodyInstance) => TirBody | undefined, meter: WorkMeter,
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const report = (rule: MirRule, site: MirViolationSite): void => { violations.push({ rule, site, detail: [] }); };
  const knownNode = (node: NodeId): boolean => findSourceNode(nodes, node) !== undefined;
  const parameterDefaults = new Set<BodyId>();
  for (const parameter of context.source.params) if (parameter.tsonic.initializer !== null) parameterDefaults.add(parameter.tsonic.initializer);
  const reference = (node: NodeRef, site: MirViolationSite): SourceNode | undefined => {
    if (node.body !== context.source.body) { report("cross-owner-qualified", site); return undefined; }
    const selected = findSourceNode(nodes, node.node);
    if (selected === undefined) report("tir-node-resolves", site);
    return selected;
  };
  const at = (instruction: MirSite, site: MirViolationSite): SourceNode | undefined => {
    if (!validOrigin(instruction.origin) || instruction.origin.module !== context.source.root.origin.module) report("origin-valid", site);
    return reference(instruction.tir, site);
  };
  const definitions = new Map<DefId, boolean>();
  const definition = (value: DefId, site: MirViolationSite): void => {
    let known = definitions.get(value);
    if (known === undefined) {
      known = context.declarationOf(value) !== null;
      definitions.set(value, known);
    }
    if (!known) report("definition-resolves", site);
  };
  const families = new Map<DefId, EndpointFamily | null>();
  // Whether the two endpoints of a selection are members of the selected declaration's endpoint family with valid
  // roles. An unresolved declaration has no family to judge and is reported as unresolved by `definition`.
  const validSelection = (decision: ApplicationDecision): boolean => {
    const owner = decision.advertised.declaration;
    let family = families.get(owner);
    if (family === undefined) {
      const declaration = context.declarationOf(owner);
      family = declaration === null ? null : { overloaded: hasOverloadEndpoints(declaration.endpoints),
        members: new Set(declaration.endpoints.map(endpoint => callableEndpointKey(endpoint))) };
      families.set(owner, family);
    }
    return family === null || family.members.has(callableEndpointKey(decision.advertised)) &&
      family.members.has(callableEndpointKey(decision.api)) &&
      selectedEndpointRoleFaults(family.overloaded, decision.advertised, decision.api) === 0;
  };
  const member = (selection: MemberSelection, site: MirViolationSite): void => {
    for (const selected of selection.decision.selectedDeclarations) definition(selected, site);
    if (selection.decision.primary !== null) definition(selection.decision.primary, site);
  };
  const operation = (selected: TypedOperation, source: SourceNode | undefined, site: MirViolationSite): void => {
    // One finding per operation occurrence: it differs from its source, or one of its call steps is not a valid selection.
    let selection = source !== undefined && !source.operations.has(texts.operation(selected));
    if (selection) report("operation-selected", site);
    if (selected.permissionScope !== null && !knownNode(selected.permissionScope)) report("tir-node-resolves", site);
    const identity = selected.decision.operation;
    if (identity.kind === "library" || identity.kind === "core") definition(identity.declaration, site);
    if (identity.kind === "array-extent") definition(identity.declaration.owner, site);
    if (identity.kind === "protocol") for (const step of identity.steps) {
      if (step.operation.kind === "core") definition(step.operation.declaration, site);
      if (step.operation.kind === "call") {
        definition(step.operation.application.api.declaration, site);
        definition(step.operation.application.advertised.declaration, site);
        if (!selection && !validSelection(step.operation.application)) {
          selection = true;
          report("operation-selected", site);
        }
      }
    }
  };
  const callee = (selected: ResolvedCallee, source: SourceNode | undefined, site: MirViolationSite): void => {
    // One finding per callee occurrence: it differs from its source, or it is not a valid selection of its family.
    if (source !== undefined && !source.callees.has(texts.callee(selected)) || !validSelection(selected.decision))
      report("operation-selected", site);
    definition(selected.decision.api.declaration, site);
    definition(selected.decision.advertised.declaration, site);
  };
  for (const constant of body.constants) {
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    if (constant.value.kind !== "observation") continue;
    chargeWork(meter, 1);
    if (meter.exhausted) return [];
    const source = reference(constant.value.at, site);
    if (source === undefined) continue;
    const observation = layoutObservationOf(source.node);
    if (observation === null || !Object.is(rawValueTypeOf(observation), constant.type)) report("observation-source-exact", site);
  }
  for (const place of body.places) {
    if (place === undefined || place.base.kind !== "place" && place.base.kind !== "checked") continue;
    const site: MirViolationSite = { kind: "place", body: body.body, place: place.id };
    // Every projected place names the node of the typed body whose access it implements.
    reference(place.base.tir, site);
    if (place.base.projection.kind === "field") member(place.base.projection.member, site);
  }
  for (const block of body.blocks) {
    if (block === undefined) continue;
    at(block, { kind: "block", body: body.body, block: block.id });
    for (const [position, statement] of block.statements.entries()) {
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      const source = at(statement, site);
      if (statement.kind !== "assign") continue;
      const value = statement.value;
      if (value.kind === "unary" || value.kind === "binary" || value.kind === "convert") operation(value.operation, source, site);
      if (value.kind === "aggregate" && (value.aggregate.kind === "object" || value.aggregate.kind === "record"))
        for (const field of value.aggregate.fields) member(field.member, site);
      if (value.kind === "closure" && source !== undefined) {
        if (source.node.kind !== "ArrowFunction" && source.node.kind !== "FunctionExpression") report("operation-selected", site);
        else {
          // The captured locals of the typed closure are the ones its outcome names: the rows of its decision, or the saved
          // evidence of the deferred closure rule. They are read where they stand, by position.
          const selected = source.node.tsonic;
          const outcome = selected.closure;
          const named = outcome.kind === "decided" ? outcome.decision.captures
            : outcome.deferred.invocation.rule === "closure" ? outcome.deferred.invocation.input.captures : null;
          if (selected.callable.template === null || value.instance.body !== selected.callable.template.body
            || named === null || named.length !== value.captures.length) report("capture-location-exact", site);
          for (const [index, capture] of value.captures.entries()) {
            const expected = named?.[index]?.local;
            if (expected === undefined || expected.body !== capture.local.body || !Object.is(expected.local, capture.local.local)) report("capture-location-exact", site);
            const selectedMode = outcome.kind === "decided" ? outcome.decision.captures[index]?.capture : null;
            if (selectedMode !== undefined && capture.capture !== selectedMode) report("local-storage-exact", site);
            else if (capture.capture === null && body.bindings.kind !== "parametric") report("local-storage-exact", site);
          }
        }
      }
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    const source = at(block.terminator, site);
    if (block.terminator.kind === "invoke") operation(block.terminator.operation, source, site);
    if (block.terminator.kind === "call") {
      // An internal body is executed only where the typed body places it: at the node that names that body, or, for
      // the default of a parameter of this body, in the entry that omits the parameter.
      if (block.terminator.callee.kind !== "body") callee(block.terminator.callee.resolution, source, site);
      else {
        const selected = block.terminator.callee;
        if (source !== undefined && !source.bodies.has(selected.instance.body)
          && !parameterDefaults.has(selected.instance.body)) report("operation-selected", site);
        const target = internalBody(selected.instance);
        if (meter.exhausted) return violations;
        if (target === undefined || target.captures.length !== selected.captures.length) report("capture-location-exact", site);
        for (const [index, capture] of selected.captures.entries()) {
          const expected = target?.captures[index];
          if (expected === undefined || expected.local.body !== capture.local.body || expected.local.local !== capture.local.local)
            report("capture-location-exact", site);
          if (expected !== undefined && expected.capture !== capture.capture
            || capture.capture === null && body.bindings.kind !== "parametric") report("local-storage-exact", site);
        }
      }
    }
  }
  return violations;
}
