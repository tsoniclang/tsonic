import { requirePresent } from "../diag/index.js";
import type { BodyId, LocalRef } from "../ids/contract.js";
import type { Block, NodeHeader, VariableDeclaration, VariableStatement } from "../ir-hir/contract.js";
import type { MirClosureCapture } from "../ir-mir/contract.js";
import type { TirNode, TypedPhase } from "../ir-tir/contract.js";
import type { InternalBodyInput } from "./contract.js";
import type { LocalScope, Lowering } from "./model.js";
import { callerDefect, failure, notLoweredYet, siteOf } from "./model.js";
import { exposeLocal, saveHandedOut } from "./operands.js";
import { emitStatement, enterBlock, newBlock, newLocal, placeOfLocal, terminate } from "./state.js";

export function enterLocalBlock(lowering: Lowering, node: Block<TypedPhase>): boolean {
  const scope: LocalScope = { parent: lowering.scope, locals: [] };
  lowering.scope = scope;
  lowering.work.push({ kind: "block-end", node, scope });
  for (let index = node.statements.nodes.length - 1; index >= 0; index -= 1)
    lowering.work.push({ kind: "statement", node: requirePresent(node.statements.nodes[index], failure("a statement list has a hole", node.origin)) });
  return true;
}

export function leaveLocalScopes(lowering: Lowering, target: LocalScope | null, node: NodeHeader): boolean {
  for (let scope = lowering.scope; scope !== target; scope = scope.parent) {
    if (scope === null) return callerDefect("a storage transfer leaves an unrelated lexical scope", node.origin);
    for (let index = scope.locals.length - 1; index >= 0; index -= 1) {
      const local = requirePresent(scope.locals[index], failure("a lexical storage list has a hole", node.origin));
      if (!emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "storage-dead", local })) return false;
    }
  }
  return true;
}

export function endLocalBlock(lowering: Lowering, node: Block<TypedPhase>, scope: LocalScope): boolean {
  if (lowering.state.current !== null && !leaveLocalScopes(lowering, scope.parent, node)) return false;
  lowering.scope = scope.parent;
  return true;
}

export function declarations(lowering: Lowering, node: VariableStatement<TypedPhase>): boolean {
  const list = node.declarationList;
  if (list.tsonic.role !== "ordinary") return notLoweredYet("a using declaration", node.origin);
  if (list.declarations.nodes.length === 0) return callerDefect("an empty variable declaration list", node.origin);
  const lexical = list.flags.includes("Let") || list.flags.includes("Const");
  for (let index = list.declarations.nodes.length - 1; index >= 0; index -= 1) {
    const declaration = requirePresent(list.declarations.nodes[index], failure("a variable declaration list has a hole", node.origin));
    if (declaration.kind !== "VariableDeclaration") return callerDefect("a missing variable declaration", declaration.origin);
    lowering.work.push({ kind: "declaration", node: declaration, lexical });
  }
  return true;
}

function localBinding(lowering: Lowering, node: VariableDeclaration<TypedPhase>): LocalRef {
  const selected = node.tsonic;
  if (node.name.kind !== "Identifier") return notLoweredYet("a destructuring variable declaration", node.origin);
  if (selected.declaration.kind !== "local") return notLoweredYet(`a variable declaration of kind ${selected.declaration.kind}`, node.origin);
  const source = selected.declaration.local;
  const actual = lowering.body.locals[source.local];
  if (source.body !== lowering.body.body || actual === undefined || actual.id !== source.local || actual.role !== "binding" || actual.storage !== selected.storage)
    return callerDefect("a variable declaration differs from its selected local storage", node.origin);
  return source;
}

export function prepareFunctionLocals(lowering: Lowering): boolean {
  const pending: TirNode[] = [lowering.body.root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.kind === "VariableDeclarationList") {
      if (node.tsonic.role !== "ordinary" || node.flags.includes("Let") || node.flags.includes("Const")) continue;
      for (const declaration of node.declarations.nodes) {
        if (declaration.kind !== "VariableDeclaration") return callerDefect("a missing variable declaration", declaration.origin);
        const source = localBinding(lowering, declaration);
        if (lowering.localOf.has(source.local)) continue;
        const local = newLocal(lowering.state, declaration.tsonic.storage, { kind: "user" }, "local", source, declaration.origin);
        if (local === null) return false;
        lowering.localOf.set(source.local, local);
        if (!emitStatement(lowering.state, { ...siteOf(lowering.body, declaration), kind: "storage-live", local })) return false;
      }
      continue;
    }
    switch (node.kind) {
      case "Block": case "CaseClause": case "DefaultClause":
        for (let index = node.statements.nodes.length - 1; index >= 0; index -= 1)
          pending.push(requirePresent(node.statements.nodes[index], failure("a statement list has a hole", node.origin)));
        break;
      case "VariableStatement": pending.push(node.declarationList); break;
      case "IfStatement":
        if (node.elseStatement !== null) pending.push(node.elseStatement);
        pending.push(node.thenStatement);
        break;
      case "LabeledStatement": case "WhileStatement": case "DoStatement": pending.push(node.statement); break;
      case "ForStatement": case "ForInStatement": case "ForOfStatement":
        pending.push(node.statement);
        if (node.initializer !== null && node.initializer.kind === "VariableDeclarationList") pending.push(node.initializer);
        break;
      case "TryStatement":
        if (node.finallyBlock !== null) pending.push(node.finallyBlock);
        if (node.catchClause !== null) pending.push(node.catchClause.block);
        pending.push(node.tryBlock);
        break;
      case "SwitchStatement": pending.push(node.caseBlock); break;
      case "CaseBlock":
        for (let index = node.clauses.nodes.length - 1; index >= 0; index -= 1)
          pending.push(requirePresent(node.clauses.nodes[index], failure("a switch clause list has a hole", node.origin)));
        break;
    }
  }
  return true;
}

function initializerOf(lowering: Lowering, node: VariableDeclaration<TypedPhase>, body: BodyId): InternalBodyInput {
  if (lowering.internalOf === null) {
    const index = new Map<BodyId, InternalBodyInput>();
    for (const input of lowering.internal) {
      if (index.has(input.instance.body)) return callerDefect("ambiguous supplied initializer executions", node.origin);
      index.set(input.instance.body, input);
    }
    lowering.internalOf = index;
  }
  return requirePresent(lowering.internalOf.get(body),
    failure("caller defect: a placed initializer has no supplied execution data", node.origin));
}

export function declareLocal(lowering: Lowering, node: VariableDeclaration<TypedPhase>, lexical: boolean): boolean {
  const selected = node.tsonic;
  const source = localBinding(lowering, node);
  if (node.initializer !== null && selected.initializer === null)
    return notLoweredYet("a variable initializer without its placed execution", node.origin);
  const site = siteOf(lowering.body, node);
  let local = lowering.localOf.get(source.local);
  if (lexical) {
    if (local !== undefined) return callerDefect("a local storage slot is declared twice", node.origin);
    const allocated = newLocal(lowering.state, selected.storage, { kind: "user" }, "local", source, node.origin);
    if (allocated === null) return false;
    local = allocated;
    lowering.localOf.set(source.local, local);
    requirePresent(lowering.scope ?? undefined, failure("a lexical declaration has no enclosing scope", node.origin)).locals.push(local);
    if (!emitStatement(lowering.state, { ...site, kind: "storage-live", local })) return false;
  }
  const storage = requirePresent(local, failure("a function-scoped declaration has no entry storage", node.origin));
  if (selected.initializer === null) return true;
  const input = initializerOf(lowering, node, selected.initializer);
  const signature = lowering.signatureOf(input.signature);
  if (signature.receiver !== null || signature.parameters.length !== 0 || signature.result !== selected.storage)
    return callerDefect("an initializer signature differs from its selected destination", node.origin);
  const destination = placeOfLocal(lowering.state, storage);
  if (destination === null) return false;
  const captures: MirClosureCapture[] = [];
  for (const capture of input.captures) {
    const captured = capture.local.body === lowering.body.body ? lowering.localOf.get(capture.local.local)
      : lowering.outerLocals.get(capture.local.body)?.get(capture.local.local);
    const sourceLocal = requirePresent(captured, failure("caller defect: an initializer capture has no selected caller storage", node.origin));
    const place = placeOfLocal(lowering.state, sourceLocal);
    if (place === null) return false;
    captures.push({ local: capture.local, place, capture: capture.capture });
    if (capture.capture !== "captured-value") exposeLocal(lowering, sourceLocal);
  }
  if (!saveHandedOut(lowering)) return false;
  const next = newBlock(lowering.state, site);
  if (next === null) return false;
  terminate(lowering.state, { ...site, kind: "call", callee: { kind: "body", instance: input.instance, captures },
    receiver: null, arguments: [], destination, next, unwind: { kind: "escape" }, step: null });
  enterBlock(lowering.state, next);
  return true;
}
