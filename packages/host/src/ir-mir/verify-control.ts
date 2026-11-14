import type { Violation } from "../diag/contract.js";
import type { BlockId, BodyId, DefId, NodeId, NodeRef, Origin, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { callableEndpointKey, childrenOfSyntax, hasOverloadEndpoints, selectedEndpointRoleFaults, walkSyntaxTree } from "../ir-hir/index.js";
import type { ApplicationDecision } from "../ir-infer/contract.js";
import type { BodyInstance } from "../ir-types/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody, TirNode, TirProtocol, TirProtocolStep, TypedOperation } from "../ir-tir/contract.js";
import { wireText } from "./text.js";
import type { DecisionWires } from "./text-decisions.js";
import type { MirBlock, MirBody, MirRule, MirSite, MirTerminator, MirUnwind, MirVerificationContext, MirViolationSite } from "./contract.js";

interface EndpointFamily {
  readonly overloaded: boolean;
  readonly members: ReadonlySet<string>;
}

export interface ControlEdge {
  readonly kind: "normal" | "unwind" | "resume" | "suspension-return";
  readonly target: BlockId;
  readonly destination: PlaceId | null;
}

function unwindEdge(unwind: MirUnwind): readonly ControlEdge[] {
  return unwind.kind === "handler" ? [{ kind: "unwind", target: unwind.target, destination: unwind.exception }] : [];
}

export function controlEdges(terminator: MirTerminator): readonly ControlEdge[] {
  switch (terminator.kind) {
    case "goto": return [{ kind: "normal", target: terminator.target, destination: null }];
    case "switch": return [
      ...terminator.targets.map((target): ControlEdge => ({ kind: "normal", target: target.target, destination: null })),
      { kind: "normal", target: terminator.otherwise, destination: null },
    ];
    case "check": return [{ kind: "normal", target: terminator.next, destination: null }, ...unwindEdge(terminator.unwind)];
    case "call": case "invoke": return [
      { kind: "normal", target: terminator.next, destination: terminator.destination }, ...unwindEdge(terminator.unwind),
    ];
    case "await": return [
      { kind: "resume", target: terminator.resume, destination: terminator.destination }, ...unwindEdge(terminator.unwind),
    ];
    case "yield": case "delegate": return [
      { kind: "resume", target: terminator.resume, destination: terminator.destination },
      { kind: "suspension-return", target: terminator.return.target, destination: terminator.return.destination },
      ...unwindEdge(terminator.unwind),
    ];
    case "throw": return unwindEdge(terminator.unwind);
    case "return": case "unreachable": return [];
  }
}

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
export function reversePostorder(body: MirBody, roots: readonly number[]): readonly OrderedBlock[] {
  const postorder: OrderedBlock[] = [];
  const reached = new Uint8Array(body.blocks.length);
  for (const root of roots) {
    const start = densePosition(root, reached.length) ? body.blocks[root] : undefined;
    if (start === undefined || reached[root] === 1) continue;
    reached[root] = 1;
    const frames: SearchFrame[] = [{ position: root, block: start, edges: controlEdges(start.terminator), next: 0 }];
    for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) {
      const candidate = frame.edges[frame.next];
      if (candidate === undefined) {
        postorder.push({ position: frame.position, block: frame.block });
        frames.pop();
        continue;
      }
      frame.next += 1;
      const block = densePosition(candidate.target, reached.length) ? body.blocks[candidate.target] : undefined;
      if (block === undefined || reached[candidate.target] === 1) continue;
      reached[candidate.target] = 1;
      frames.push({ position: candidate.target, block, edges: controlEdges(block.terminator), next: 0 });
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

export function verifyEdges(body: MirBody): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const entry = body.blocks[0];
  if (entry === undefined || !Object.is(entry.id, 0)) violations.push({ rule: "entry-block-zero",
    site: { kind: "body", body: body.body }, detail: [] });
  for (const block of body.blocks) {
    if (block === undefined) continue;
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    for (const edge of controlEdges(block.terminator)) {
      const target = densePosition(edge.target, body.blocks.length) ? body.blocks[edge.target] : undefined;
      if (target === undefined || !Object.is(target.id, edge.target)) violations.push({ rule: "edge-target-resolves", site,
        detail: [{ kind: "text", value: edge.kind }, { kind: "number", value: edge.target }] });
    }
    if (block.terminator.kind !== "switch") continue;
    const selected = new Set<string>();
    let previous: number | null = null;
    for (const target of block.terminator.targets) {
      const key = encodeKey(target.constant);
      if (selected.has(key)) violations.push({ rule: "switch-target-unique", site,
        detail: [{ kind: "number", value: target.constant }] });
      selected.add(key);
      if (previous !== null && !(previous < target.constant)) violations.push({ rule: "switch-targets-order", site,
        detail: [{ kind: "number", value: previous }, { kind: "number", value: target.constant }] });
      previous = target.constant;
    }
  }
  return violations;
}

export interface SourceNode {
  readonly node: TirNode;
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
  meter.spent += units;
  if (meter.spent > meter.maximum) meter.exhausted = true;
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

function bodyBoundaries(node: TirNode): ReadonlySet<NodeId> {
  const excluded = new Set<NodeId>();
  if (node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression" || node.kind === "ArrowFunction"
    || node.kind === "Constructor" || node.kind === "MethodDeclaration" || node.kind === "GetAccessor" || node.kind === "SetAccessor") {
    if (node.body !== null) excluded.add(node.body.id);
    for (const parameter of node.parameters.nodes) excluded.add(parameter.id);
  }
  if ((node.kind === "PropertyDeclaration" || node.kind === "PropertySignature" || node.kind === "EnumMember")
    && node.initializer !== null) excluded.add(node.initializer.id);
  if (node.kind === "ClassStaticBlockDeclaration") excluded.add(node.body.id);
  if (node.kind === "ModuleDeclaration" && node.body !== null) excluded.add(node.body.id);
  return excluded;
}

export function sourceNodes(source: TirBody, texts: WireTexts): ReadonlyMap<NodeId, SourceNode> {
  const visited = new Set<NodeId>();
  const boundaries = new Set<NodeId>();
  const pending: TirNode[] = [source.root];
  for (const node of pending) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    const children = childrenOfSyntax(node);
    const excluded = bodyBoundaries(node);
    for (const id of excluded) boundaries.add(id);
    for (const child of children) if (!excluded.has(child.id)) pending.push(child);
  }
  const nodes = new Map<NodeId, SourceNode>();
  for (const node of walkSyntaxTree(source.root, [...boundaries])) {
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
      if ("protocols" in payload) for (const protocol of payload.protocols) if (protocol.kind === "decided") protocols.push(protocol.decision);
      // The bodies a node executes by a call of its own: the initializer of the binding, parameter or storage it
      // declares. A template is the body of a closure or a declaration, which a call of an internal body never runs.
      if ("initializer" in payload && payload.initializer !== null) bodies.add(payload.initializer);
    }
    const steps: SourceStep[][] = [];
    for (const protocol of protocols) {
      const row: SourceStep[] = [];
      for (const step of protocol.steps) {
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
  return nodes;
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
  for (const parameter of context.source.params) if (parameter.initializer !== null) parameterDefaults.add(parameter.initializer);
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
    if (constant.value.kind === "observation") reference(constant.value.at, site);
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
