import type { Violation } from "../diag/contract.js";
import type { BlockId, DefId, NodeId, NodeRef, Origin, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { childrenOfSyntax, walkSyntaxTree } from "../ir-hir/index.js";
import type { MemberSelection, ResolvedCallee, TirBody, TirNode, TirProtocol, TypedOperation } from "../ir-tir/contract.js";
import { wireText } from "./text.js";
import type { DecisionWires } from "./text-decisions.js";
import type { MirBlock, MirBody, MirRule, MirSite, MirTerminator, MirUnwind, MirVerificationContext, MirViolationSite } from "./contract.js";

export interface ControlEdge {
  readonly kind: "normal" | "unwind" | "resume" | "suspension-return";
  readonly target: BlockId;
  readonly destination: PlaceId | null;
}

function unwindEdge(unwind: MirUnwind): readonly ControlEdge[] {
  return unwind.kind === "escape" ? [] : [{ kind: "unwind", target: unwind.target, destination: unwind.exception }];
}

export function controlEdges(terminator: MirTerminator): readonly ControlEdge[] {
  switch (terminator.kind) {
    case "goto": return [{ kind: "normal", target: terminator.target, destination: null }];
    case "switch": return [
      ...terminator.targets.map((target): ControlEdge => ({ kind: "normal", target: target.target, destination: null })),
      { kind: "normal", target: terminator.otherwise, destination: null },
    ];
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

export function densePosition(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value < length;
}

export interface ControlGraph {
  readonly vertices: readonly ControlVertex[];
  readonly reachable: ReadonlySet<number>;
}

export interface ControlVertex {
  readonly id: number;
  readonly block: MirBlock;
  readonly successors: readonly ControlVertex[];
  readonly predecessors: readonly ControlVertex[];
}

export function controlGraph(body: MirBody): ControlGraph {
  const builders = new Map<number, {
    readonly vertex: ControlVertex;
    readonly successors: ControlVertex[];
    readonly predecessors: ControlVertex[];
  }>();
  for (const [position, block] of body.blocks.entries()) {
    if (block === undefined || !Object.is(block.id, position)) continue;
    const successors: ControlVertex[] = [];
    const predecessors: ControlVertex[] = [];
    const vertex: ControlVertex = { id: position, block, successors, predecessors };
    builders.set(position, { vertex, successors, predecessors });
  }
  for (const from of builders.values()) {
    for (const edge of controlEdges(from.vertex.block.terminator)) {
      if (!densePosition(edge.target, body.blocks.length)) continue;
      const to = builders.get(edge.target);
      if (to !== undefined) {
        from.successors.push(to.vertex);
        to.predecessors.push(from.vertex);
      }
    }
  }
  const reachable = new Set<number>();
  const entry = builders.get(0);
  const pending: ControlVertex[] = entry === undefined ? [] : [entry.vertex];
  for (const selected of pending) {
    if (reachable.has(selected.id)) continue;
    reachable.add(selected.id);
    for (const successor of selected.successors) pending.push(successor);
  }
  return { vertices: Array.from(builders.values(), value => value.vertex), reachable };
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

export function sourceNodes(source: TirBody, wires: DecisionWires): ReadonlyMap<NodeId, SourceNode> {
  const { calleeWire, operationWire } = wires;
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
    const operation = (selected: TypedOperation): void => { operations.add(wireText(operationWire, selected)); };
    const selection = (selected: MemberSelection): void => {
      if (selected.getter !== null) callees.add(wireText(calleeWire, selected.getter));
      if (selected.setter !== null) callees.add(wireText(calleeWire, selected.setter));
    };
    const payload = node.tsonic;
    if (payload !== null) {
      if ("operation" in payload && payload.operation !== null && payload.operation.kind === "decided") operation(payload.operation.decision);
      if ("calculation" in payload && payload.calculation !== null && payload.calculation.kind === "decided") operation(payload.calculation.decision);
      if ("construction" in payload && payload.construction.kind === "decided") operation(payload.construction.decision);
      if ("conversion" in payload && payload.conversion.kind === "convert") operation(payload.conversion.operation);
      if ("application" in payload && payload.application !== null && payload.application.kind === "decided"
        && "callee" in payload.application.decision) callees.add(wireText(calleeWire, payload.application.decision.callee));
      if ("selection" in payload && payload.selection !== null && payload.selection.kind === "decided") {
        selection(payload.selection.decision);
      }
      if ("member" in payload && payload.member.kind === "decided") selection(payload.member.decision);
      if ("protocol" in payload && payload.protocol.kind === "decided") protocols.push(payload.protocol.decision);
      if ("protocols" in payload) for (const protocol of payload.protocols) if (protocol.kind === "decided") protocols.push(protocol.decision);
    }
    for (const protocol of protocols) for (const step of protocol.steps) {
      operation(step.operation);
      if (step.callee !== null) callees.add(wireText(calleeWire, step.callee));
    }
    nodes.set(node.id, { node, operations, callees });
  }
  return nodes;
}

export function validOrigin(origin: Origin): boolean {
  return Number.isSafeInteger(origin.start) && !Object.is(origin.start, -0) && origin.start >= 0
    && Number.isSafeInteger(origin.length) && !Object.is(origin.length, -0) && origin.length >= 0
    && Number.isSafeInteger(origin.start + origin.length);
}

export function verifySelections(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>, wires: DecisionWires,
): readonly Violation<MirRule, MirViolationSite>[] {
  const { calleeWire, operationWire } = wires;
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const report = (rule: MirRule, site: MirViolationSite): void => { violations.push({ rule, site, detail: [] }); };
  const knownNode = (node: NodeId): boolean => findSourceNode(nodes, node) !== undefined;
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
  const member = (selection: MemberSelection, site: MirViolationSite): void => {
    for (const selected of selection.decision.selectedDeclarations) definition(selected, site);
    if (selection.decision.primary !== null) definition(selection.decision.primary, site);
  };
  const operation = (selected: TypedOperation, source: SourceNode | undefined, site: MirViolationSite): void => {
    if (source !== undefined && !source.operations.has(wireText(operationWire, selected))) report("operation-selected", site);
    if (selected.permissionScope !== null && !knownNode(selected.permissionScope)) report("tir-node-resolves", site);
    const identity = selected.decision.operation;
    if (identity.kind === "library" || identity.kind === "core") definition(identity.declaration, site);
    if (identity.kind === "protocol") for (const step of identity.steps) {
      if (step.operation.kind === "core") definition(step.operation.declaration, site);
      if (step.operation.kind === "call") {
        definition(step.operation.application.api.declaration, site);
        definition(step.operation.application.advertised.declaration, site);
      }
    }
  };
  const callee = (selected: ResolvedCallee, source: SourceNode | undefined, site: MirViolationSite): void => {
    if (source !== undefined && !source.callees.has(wireText(calleeWire, selected))) report("operation-selected", site);
    definition(selected.decision.api.declaration, site);
    definition(selected.decision.advertised.declaration, site);
  };
  for (const constant of body.constants) {
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    if (constant.value.kind === "observation") reference(constant.value.at, site);
  }
  for (const place of body.places) {
    if (place === undefined || place.base.kind !== "place" || place.base.projection.kind !== "field") continue;
    const site: MirViolationSite = { kind: "place", body: body.body, place: place.id };
    member(place.base.projection.member, site);
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
          const selected = source.node.tsonic;
          if (selected.callable.template === null || value.instance.body !== selected.callable.template.body
            || selected.captures.length !== value.captures.length) report("capture-location-exact", site);
          for (const [index, capture] of value.captures.entries()) {
            const expected = selected.captures[index];
            if (expected === undefined || expected.body !== capture.local.body || !Object.is(expected.local, capture.local.local)) report("capture-location-exact", site);
          }
        }
      }
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    const source = at(block.terminator, site);
    if (block.terminator.kind === "invoke") operation(block.terminator.operation, source, site);
    if (block.terminator.kind === "call") callee(block.terminator.callee.resolution, source, site);
  }
  return violations;
}
