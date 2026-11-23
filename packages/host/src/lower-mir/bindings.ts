import { requirePresent } from "../diag/index.js";
import type { BodyId, LocalId, LocalRef, PlaceId, TyId } from "../ids/contract.js";
import type { Block, CaseBlock, NodeHeader, VariableDeclaration, VariableDeclarationList } from "../ir-hir/contract.js";
import type { MirClosureCapture } from "../ir-mir/contract.js";
import type { TirNode, TypedPhase } from "../ir-tir/contract.js";
import { layoutBindingOf } from "../ir-tir/index.js";
import type { InternalBodyInput } from "./contract.js";
import type { LocalScope, Lowering, Work } from "./model.js";
import { callerDefect, failure, localFromSource, notLoweredYet, siteOf } from "./model.js";
import { exposeLocal, saveBeforeControl } from "./operands.js";
import { constantOperand, emitStatement, enterBlock, newBlock, newLocal, placeOfLocal, placeOfStatic, terminate } from "./state.js";

export function beginLocalScope(lowering: Lowering): LocalScope {
  const scope: LocalScope = { kind: "block", parent: lowering.scope, locals: [] };
  lowering.scope = scope;
  return scope;
}

export function enterLocalBlock(lowering: Lowering, node: Block<TypedPhase>): boolean {
  const scope = beginLocalScope(lowering);
  lowering.work.push({ kind: "scope-end", node, scope });
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

export function endLocalScope(lowering: Lowering, node: NodeHeader, scope: LocalScope): boolean {
  if (lowering.state.current !== null && !leaveLocalScopes(lowering, scope.parent, node)) return false;
  lowering.scope = scope.parent;
  return true;
}

export function declarations(lowering: Lowering, list: VariableDeclarationList<TypedPhase>): boolean {
  if (list.tsonic.role !== "ordinary") return notLoweredYet("a using declaration", list.origin);
  if (list.declarations.nodes.length === 0) return callerDefect("an empty variable declaration list", list.origin);
  const lexical = list.flags.includes("Let") || list.flags.includes("Const");
  lowering.work.push({ kind: "declarations", node: list, lexical, position: 0 });
  return true;
}

export function nextDeclaration(lowering: Lowering, pending: Extract<Work, { readonly kind: "declarations" }>): boolean {
  const list = pending.node;
  if (pending.position === list.declarations.nodes.length) return true;
  const declaration = requirePresent(list.declarations.nodes[pending.position], failure("a variable declaration list has a hole", list.origin));
  if (declaration.kind !== "VariableDeclaration") return callerDefect("a missing variable declaration", declaration.origin);
  lowering.work.push({ ...pending, position: pending.position + 1 });
  if (layoutBindingOf(declaration.initializer) === null)
    lowering.work.push({ kind: "declaration", node: declaration, lexical: pending.lexical });
  else if (!list.flags.includes("Const")) return notLoweredYet("a mutable compile-time layout binding", declaration.origin);
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

function startLexicalLocal(lowering: Lowering, scope: LocalScope, node: VariableDeclaration<TypedPhase>, source: LocalRef): LocalId | null {
  if (lowering.localOf.has(source.local)) return callerDefect("a local storage slot is declared twice", node.origin);
  const local = newLocal(lowering.state, node.tsonic.storage, { kind: "user" }, "local", source, node.origin);
  if (local === null) return null;
  if (!emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "storage-live", local })) return null;
  lowering.localOf.set(source.local, local);
  scope.locals.push(local);
  return local;
}

export function prepareCaseLocals(lowering: Lowering, block: CaseBlock<TypedPhase>): boolean {
  let scope: LocalScope | null = null;
  for (const clause of block.clauses.nodes) for (const statement of clause.statements.nodes) {
    if (statement === undefined) return callerDefect("a switch clause statement list has a hole", clause.origin);
    if (statement.kind !== "VariableStatement") continue;
    const list = statement.declarationList;
    if (list.tsonic.role !== "ordinary" || list.flags.includes("Using") || list.flags.includes("AwaitUsing"))
      return notLoweredYet("a disposal declaration in the shared lexical scope of a switch", statement.origin);
    if (!list.flags.includes("Let") && !list.flags.includes("Const")) continue;
    scope ??= { kind: "case", parent: lowering.scope, locals: [] };
    for (const declaration of list.declarations.nodes)
      if (layoutBindingOf(declaration.initializer) === null &&
        startLexicalLocal(lowering, scope, declaration, localBinding(lowering, declaration)) === null) return false;
  }
  if (scope !== null) lowering.scope = scope;
  return true;
}

export function prepareFunctionLocals(lowering: Lowering): boolean {
  if (lowering.body.root.kind === "SourceFile") return true;
  const pending: TirNode[] = [lowering.body.root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.kind === "VariableDeclarationList") {
      if (node.tsonic.role !== "ordinary" || node.flags.includes("Let") || node.flags.includes("Const")) continue;
      for (const declaration of node.declarations.nodes) {
        if (declaration.kind !== "VariableDeclaration") return callerDefect("a missing variable declaration", declaration.origin);
        if (layoutBindingOf(declaration.initializer) !== null) continue;
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

function initializerOf(lowering: Lowering, node: NodeHeader, body: BodyId): InternalBodyInput {
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
  if (node.initializer !== null && selected.initializer === null)
    return notLoweredYet("a variable initializer without its placed execution", node.origin);
  if (selected.declaration.kind === "definition" && lowering.body.root.kind === "SourceFile") {
    if (node.name.kind !== "Identifier") return notLoweredYet("a destructuring variable declaration", node.origin);
    const destination = placeOfStatic(lowering.state, selected.declaration.definition, selected.storage, node.origin);
    if (destination === null) return false;
    if (selected.initializer === null) {
      const storage = lowering.typeOf(selected.storage);
      return storage.kind === "optional" || storage.kind === "intrinsic" && storage.intrinsic === "absence"
        ? initializeAbsence(lowering, node, destination, selected.storage)
        : true;
    }
    return initializePlace(lowering, node, destination, selected.storage, selected.initializer);
  }
  const source = localBinding(lowering, node);
  let local = lowering.localOf.get(source.local);
  if (lexical) {
    const scope = requirePresent(lowering.scope ?? undefined, failure("a lexical declaration has no enclosing scope", node.origin));
    if (scope.kind === "case") {
      if (local === undefined) return callerDefect("a case declaration has no live shared lexical slot", node.origin);
    } else {
      const allocated = startLexicalLocal(lowering, scope, node, source);
      if (allocated === null) return false;
      local = allocated;
    }
  }
  const storage = requirePresent(local, failure("a function-scoped declaration has no entry storage", node.origin));
  if (selected.initializer === null) return true;
  return initializeLocal(lowering, node, storage, selected.storage, selected.initializer);
}

export function initializeAbsence(lowering: Lowering, node: NodeHeader, destination: PlaceId, storage: TyId): boolean {
  const absence = constantOperand(lowering.state, storage, { kind: "literal", value: { kind: "absence" } });
  if (absence === null) return false;
  return emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "assign",
    place: destination, value: { kind: "use", operand: absence }, step: null });
}

export function initializeLocal(lowering: Lowering, node: NodeHeader, local: LocalId, storage: TyId, initializer: BodyId): boolean {
  const destination = placeOfLocal(lowering.state, local);
  if (destination === null) return false;
  return initializePlace(lowering, node, destination, storage, initializer);
}

function initializePlace(lowering: Lowering, node: NodeHeader, destination: PlaceId, storage: TyId, initializer: BodyId): boolean {
  const site = siteOf(lowering.body, node);
  const input = initializerOf(lowering, node, initializer);
  const signature = lowering.signatureOf(input.signature);
  if (signature.receiver !== null || signature.parameters.length !== 0 || signature.result !== storage)
    return callerDefect("an initializer signature differs from its selected destination", node.origin);
  const captures: MirClosureCapture[] = [];
  for (const capture of input.captures) {
    const captured = localFromSource(lowering, capture.local);
    const sourceLocal = requirePresent(captured, failure("caller defect: an initializer capture has no selected caller storage", node.origin));
    const place = placeOfLocal(lowering.state, sourceLocal);
    if (place === null) return false;
    captures.push({ local: capture.local, place, capture: capture.capture });
    if (capture.capture !== "captured-value") exposeLocal(lowering, sourceLocal);
  }
  if (!saveBeforeControl(lowering, true, true)) return false;
  const next = newBlock(lowering.state, site);
  if (next === null) return false;
  terminate(lowering.state, { ...site, kind: "call", callee: { kind: "body", instance: input.instance, captures },
    receiver: null, arguments: [], destination, next, unwind: { kind: "escape" }, step: null });
  enterBlock(lowering.state, next);
  return true;
}
