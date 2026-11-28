import { requirePresent } from "../diag/index.js";
import type { BlockId, BodyId, LocalId, LocalRef, PlaceId, TyId } from "../ids/contract.js";
import type { BindingPattern, Block, CaseBlock, NodeHeader, VariableDeclaration, VariableDeclarationList } from "../ir-hir/contract.js";
import type { MirCleanupTransfer, MirClosureCapture, MirUnwind } from "../ir-mir/contract.js";
import type { TirNode, TypedBinding, TypedPhase } from "../ir-tir/contract.js";
import { layoutBindingOf } from "../ir-tir/index.js";
import type { TypeTerm } from "../ir-types/contract.js";
import type { InternalBodyInput } from "./contract.js";
import type { CleanupScope, HandlerScope, LocalScope, Lowering, ProtectedScope, Work } from "./model.js";
import { callerDefect, failure, localFromSource, notLoweredYet, siteOf } from "./model.js";
import { exposeLocal, holdReceiver, popOperand, saveBeforeControl, saveBeforeStore, saveRead, temporary, tupleElementPlace } from "./operands.js";
import { buildDetachedBlock, constantOperand, emitStatement, enterBlock, newBlock, newLocal, newPlace, placeOfLocal, placeOfStatic, terminate } from "./state.js";

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
  return leaveLocalScopesFrom(lowering, lowering.scope, target, node);
}

function leaveLocalScopesFrom(lowering: Lowering, start: LocalScope | null, target: LocalScope | null, node: NodeHeader): boolean {
  for (let scope = start; scope !== target; scope = scope.parent) {
    if (scope === null) return callerDefect("a storage transfer leaves an unrelated lexical scope", node.origin);
    for (let index = scope.locals.length - 1; index >= 0; index -= 1) {
      const local = requirePresent(scope.locals[index], failure("a lexical storage list has a hole", node.origin));
      if (!emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "storage-dead", local })) return false;
    }
  }
  return true;
}

export function cleanupEntry(lowering: Lowering, scope: CleanupScope): BlockId | null {
  scope.entry ??= newBlock(lowering.state, siteOf(lowering.body, scope.block));
  return scope.entry;
}

export function leaveProtectedScopes(lowering: Lowering, target: ProtectedScope | null, locals: LocalScope | null,
  node: NodeHeader, transfer: MirCleanupTransfer): boolean {
  let currentLocals = lowering.scope;
  const site = siteOf(lowering.body, node);
  for (let scope = lowering.protection; scope !== target; scope = scope.outer) {
    if (scope === null) return callerDefect("a control transfer leaves an unrelated protected scope", node.origin);
    const cleanup = scope.cleanup;
    if (cleanup === null) continue;
    if (!leaveLocalScopesFrom(lowering, currentLocals, scope.locals, node)) return false;
    currentLocals = scope.locals;
    const entry = cleanupEntry(lowering, cleanup);
    if (entry === null) return false;
    const continuation = newBlock(lowering.state, site);
    if (continuation === null) return false;
    terminate(lowering.state, scope.phase === "cleanup" ? { ...site, kind: "cleanup-discard", entry, target: continuation }
      : { ...site, kind: "cleanup-enter", entry, continuation, transfer });
    enterBlock(lowering.state, continuation);
  }
  return leaveLocalScopesFrom(lowering, currentLocals, locals, node);
}

function handlerEntry(lowering: Lowering, handler: HandlerScope): BlockId | null {
  handler.entry ??= newBlock(lowering.state, siteOf(lowering.body, handler.block));
  return handler.entry;
}

function unwindThroughCleanup(lowering: Lowering, node: NodeHeader, chosen: ProtectedScope | null, handler: HandlerScope | null): MirUnwind | null {
  const target = handler === null ? null : handlerEntry(lowering, handler);
  if (handler !== null && target === null) return null;
  const site = siteOf(lowering.body, node);
  const landing = newBlock(lowering.state, site);
  if (landing === null || !buildDetachedBlock(lowering.state, landing, () => {
    if (!leaveProtectedScopes(lowering, chosen, handler?.locals ?? null, node, "unwind")) return false;
    const unwind: MirUnwind = target === null ? { kind: "escape" } : { kind: "handler", target, exception: handler?.exception ?? null };
    terminate(lowering.state, { ...site, kind: "unwind-propagate", unwind });
    return true;
  })) return null;
  return { kind: "carry", target: landing };
}

export function unwindToHandler(lowering: Lowering, node: NodeHeader): MirUnwind | null {
  let chosen = lowering.protection;
  let crossesCleanup = false;
  while (chosen !== null && (chosen.phase !== "try" || chosen.handler === null)) {
    crossesCleanup ||= chosen.cleanup !== null;
    chosen = chosen.outer;
  }
  const handler = chosen?.handler ?? null;
  if (crossesCleanup) return unwindThroughCleanup(lowering, node, chosen, handler);
  if (handler === null) return { kind: "escape" };
  const state = lowering.state;
  const target = handlerEntry(lowering, handler);
  if (target === null) return null;
  for (let scope = lowering.scope; scope !== handler.locals; scope = scope.parent) {
    if (scope === null) return callerDefect("an unwind leaves an unrelated lexical scope", node.origin);
    if (scope.locals.length === 0) continue;
    const site = siteOf(lowering.body, node);
    const landing = newBlock(state, site);
    if (landing === null || !buildDetachedBlock(state, landing, () => {
      if (!leaveLocalScopes(lowering, handler.locals, node)) return false;
      terminate(state, { ...site, kind: "goto", target });
      return true;
    })) return null;
    return { kind: "handler", target: landing, exception: handler.exception };
  }
  return { kind: "handler", target, exception: handler.exception };
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

function localBinding(lowering: Lowering, node: NodeHeader, selected: TypedBinding, role: "binding" | "catch"): LocalRef {
  if (selected.declaration.kind !== "local") return notLoweredYet(`a variable declaration of kind ${selected.declaration.kind}`, node.origin);
  const source = selected.declaration.local;
  const actual = lowering.body.locals[source.local];
  if (source.body !== lowering.body.body || actual === undefined || actual.id !== source.local || actual.role !== role || actual.storage !== selected.storage)
    return callerDefect("a variable declaration differs from its selected local storage", node.origin);
  return source;
}

function namedBindingOf(node: VariableDeclaration<TypedPhase>) {
  const selected = node.tsonic;
  if (!("declaration" in selected) || node.name.kind !== "Identifier")
    return notLoweredYet("a destructuring variable declaration", node.origin);
  return selected;
}

function startLexicalLocal(lowering: Lowering, scope: LocalScope, node: NodeHeader,
  source: LocalRef, storage: TyId, kind: "user" | "exception"): LocalId | null {
  if (lowering.localOf.has(source.local)) return callerDefect("a local storage slot is declared twice", node.origin);
  const local = newLocal(lowering.state, storage, { kind }, "local", source, node.origin);
  if (local === null) return null;
  if (!emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "storage-live", local })) return null;
  lowering.localOf.set(source.local, local);
  scope.locals.push(local);
  return local;
}

export function declareCatchLocal(lowering: Lowering, scope: LocalScope, node: VariableDeclaration<TypedPhase>): PlaceId | null {
  const selected = namedBindingOf(node);
  const type = lowering.typeOf(selected.storage);
  if (type.kind !== "intrinsic" || type.intrinsic !== "unknown")
    return callerDefect("an exception destination retains its actual selected unknown storage", node.origin);
  const local = startLexicalLocal(lowering, scope, node, localBinding(lowering, node, selected, "catch"), selected.storage, "exception");
  return local === null ? null : placeOfLocal(lowering.state, local);
}

function* patternBindings(pattern: BindingPattern<TypedPhase>): Generator<{ readonly node: NodeHeader; readonly binding: TypedBinding }> {
  const pending = [{ pattern, index: 0 }];
  for (let frame = pending.at(-1); frame !== undefined; frame = pending.at(-1)) {
    if (frame.index === frame.pattern.elements.nodes.length) { pending.pop(); continue; }
    const element = requirePresent(frame.pattern.elements.nodes[frame.index++], failure("a fixed binding list has a hole", frame.pattern.origin));
    const phase = element.tsonic;
    if (phase.role === "binding" || phase.role === "field-binding") yield { node: element, binding: phase };
    else if (phase.role === "pattern") {
      if (element.name?.kind !== "ArrayBindingPattern") return callerDefect("a nested binding lacks its actual array pattern", element.origin);
      pending.push({ pattern: element.name, index: 0 });
    }
  }
}

function* storageBindings(node: VariableDeclaration<TypedPhase>): Generator<{ readonly node: NodeHeader; readonly binding: TypedBinding }> {
  if ("declaration" in node.tsonic) yield { node, binding: namedBindingOf(node) };
  else {
    if (node.name.kind === "Identifier") return callerDefect("a destructuring source lacks its actual binding pattern", node.origin);
    yield* patternBindings(node.name);
  }
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
    for (const declaration of list.declarations.nodes) {
      if (layoutBindingOf(declaration.initializer) !== null) continue;
      for (const { node, binding } of storageBindings(declaration))
        if (startLexicalLocal(lowering, scope, node, localBinding(lowering, node, binding, "binding"), binding.storage, "user") === null) return false;
    }
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
        for (const { node, binding } of storageBindings(declaration)) {
          const source = localBinding(lowering, node, binding, "binding");
          if (lowering.localOf.has(source.local)) continue;
          const local = newLocal(lowering.state, binding.storage, { kind: "user" }, "local", source, node.origin);
          if (local === null) return false;
          lowering.localOf.set(source.local, local);
          if (!emitStatement(lowering.state, { ...siteOf(lowering.body, node), kind: "storage-live", local })) return false;
        }
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

function preparePattern(lowering: Lowering, node: VariableDeclaration<TypedPhase>, lexical: boolean): boolean {
  if (node.name.kind === "Identifier" || node.initializer === null)
    return callerDefect("a destructuring declaration must retain its actual source and ordered pattern", node.origin);
  let hasDestination = false;
  for (const { node: element, binding } of patternBindings(node.name)) {
    hasDestination = true;
    if (binding.declaration.kind === "definition") {
      if (lowering.body.root.kind !== "SourceFile") return callerDefect("a static binding must belong to its module execution", element.origin);
      continue;
    }
    const source = localBinding(lowering, element, binding, "binding");
    if (lexical) {
      const scope = requirePresent(lowering.scope ?? undefined, failure("a lexical pattern lacks its actual scope", element.origin));
      if (scope.kind !== "case") {
        if (startLexicalLocal(lowering, scope, element, source, binding.storage, "user") === null) return false;
        continue;
      }
    }
    requirePresent(lowering.localOf.get(source.local), failure("a pattern binding lacks its preallocated local", element.origin));
  }
  lowering.work.push(hasDestination ? { kind: "pattern-value", node: node.name } : { kind: "discard", node, read: null },
    { kind: "expression", node: node.initializer });
  return true;
}

function bindingDestination(lowering: Lowering, element: NodeHeader, binding: TypedBinding): PlaceId | null {
  const target = binding.declaration;
  const local = target.kind === "definition" ? null : requirePresent(localFromSource(lowering, target.local),
    failure("a binding lacks its actual destination local", element.origin));
  const place = target.kind === "definition" ? placeOfStatic(lowering.state, target.definition, binding.storage, element.origin)
    : placeOfLocal(lowering.state, requirePresent(local ?? undefined, failure("a binding's local destination is absent", element.origin)));
  return place !== null && saveBeforeStore(lowering, place, local) ? place : null;
}

function finishObjectPattern(lowering: Lowering, pattern: BindingPattern<TypedPhase>, holder: PlaceId): boolean {
  const { state } = lowering;
  for (const element of pattern.elements.nodes) {
    const binding = element.tsonic;
    if (binding.role !== "field-binding" || element.name?.kind !== "Identifier")
      return callerDefect("a field binding requires its actual selected read and named destination", element.origin);
    const site = siteOf(lowering.body, element);
    const read = binding.field.decision.read;
    const location = binding.field.decision.location;
    if (read === null || location.kind !== "data" || location.receiver !== "by-reference" || location.check.kind !== "none")
      return callerDefect("a field binding must read its selected stable reference-held member", element.origin);
    const field = newPlace(state, { kind: "place", place: holder, projection: { kind: "field", member: binding.field }, tir: site.tir }, read, site.origin);
    const destination = bindingDestination(lowering, element, binding);
    if (field === null || destination === null) return false;
    if (binding.present === null) {
      if (binding.storage !== read) return callerDefect("a direct binding reads its actual destination type", element.origin);
      if (!emitStatement(state, { ...site, kind: "assign", place: destination, value: { kind: "use", operand: { kind: "place", place: field } }, step: null }))
        return false;
      continue;
    }
    if (binding.initializer === null || binding.present !== binding.storage)
      return callerDefect("a conditional binding requires its independently placed initializer and present type", element.origin);
    const snapshot = temporary(lowering, read, site);
    if (snapshot === null || !emitStatement(state, { ...site, kind: "assign", place: snapshot,
      value: { kind: "use", operand: { kind: "place", place: field } }, step: null })) return false;
    const absence = constantOperand(state, read, { kind: "literal", value: { kind: "absence" } });
    if (absence === null) return false;
    const absent = newBlock(state, site);
    if (absent === null) return false;
    const present = newBlock(state, site);
    if (present === null) return false;
    const next = newBlock(state, site);
    if (next === null) return false;
    const view = newPlace(state, { kind: "checked", place: snapshot, projection: { kind: "refined" }, tir: site.tir },
      binding.present, site.origin);
    if (view === null) return false;
    terminate(state, { ...site, kind: "switch", operand: { kind: "place", place: snapshot },
      targets: [{ constant: absence.constant, target: absent }], otherwise: present, step: null });
    enterBlock(state, present);
    if (!emitStatement(state, { ...site, kind: "assign", place: destination, value: { kind: "use", operand: { kind: "place", place: view } }, step: null }))
      return false;
    terminate(state, { ...site, kind: "goto", target: next });
    enterBlock(state, absent);
    if (!initializePlace(lowering, element, destination, binding.storage, binding.initializer)) return false;
    terminate(state, { ...site, kind: "goto", target: next });
    enterBlock(state, next);
  }
  return true;
}

export function finishPatternValue(lowering: Lowering, pattern: BindingPattern<TypedPhase>): boolean {
  let source = popOperand(lowering, failure("a destructuring pattern lacks its evaluated source", pattern.origin));
  if (pattern.kind === "ObjectBindingPattern") {
    if (source.storage !== pattern.tsonic.storage) return callerDefect("an object binding must consume its actual selected receiver", pattern.origin);
    const held = holdReceiver(lowering, source);
    return held !== null && finishObjectPattern(lowering, pattern, held);
  }
  if (source.storage !== pattern.tsonic.storage || source.operand.kind !== "place")
    return callerDefect("a destructuring pattern must consume its selected tuple place", pattern.origin);
  if (source.kind !== "plain") for (const { binding } of patternBindings(pattern)) {
    const target = binding.declaration;
    if ((target.kind === "local" && source.kind === "local-read" && lowering.localOf.get(target.local.local) === source.local)
      || (target.kind === "definition" && (source.kind === "shared-field" || lowering.preservedLocals.has(source.local)))) {
      const saved = saveRead(lowering, source);
      if (saved === null) return false;
      source = saved;
      break;
    }
  }
  if (source.operand.kind !== "place") return callerDefect("a prepared tuple must remain a place", pattern.origin);
  interface ProjectionFrame {
    readonly pattern: BindingPattern<TypedPhase>;
    readonly place: PlaceId;
    readonly tuple: Extract<TypeTerm, { readonly kind: "tuple" }>;
    index: number;
  }
  const open = (node: BindingPattern<TypedPhase>, place: PlaceId): ProjectionFrame => {
    const tuple = lowering.typeOf(node.tsonic.storage);
    if (node.kind !== "ArrayBindingPattern" || tuple.kind !== "tuple" || node.elements.nodes.length > tuple.elements.length)
      return callerDefect("a fixed binding must retain its actual tuple slot inventory", node.origin);
    return { pattern: node, place, tuple, index: 0 };
  };
  const pending = [open(pattern, source.operand.place)];
  for (let frame = pending.at(-1); frame !== undefined; frame = pending.at(-1)) {
    const { pattern: current, place: root, tuple, index } = frame;
    if (index === current.elements.nodes.length) { pending.pop(); continue; }
    frame.index += 1;
    const element = requirePresent(current.elements.nodes[index], failure("a fixed binding list has a hole", current.origin));
    const slot = tuple.elements[index];
    const binding = element.tsonic;
    if (slot?.kind !== "required" || element.initializer.kind !== "none" || element.dotDotDotToken !== null || element.propertyName !== null)
      return callerDefect("a fixed pattern must retain its actual required slot", element.origin);
    if (binding.role === "hole") continue;
    const site = siteOf(lowering.body, element);
    const projected = tupleElementPlace(lowering, root, index, slot.type, site);
    if (projected === null) return false;
    if (binding.role === "pattern") {
      if (element.name?.kind !== "ArrayBindingPattern" || element.name.tsonic.storage !== slot.type)
        return callerDefect("a nested binding must consume its own projected tuple", element.origin);
      pending.push(open(element.name, projected));
      continue;
    }
    if (binding.role !== "binding" || binding.storage !== slot.type || binding.initializer !== null || element.name?.kind !== "Identifier")
      return callerDefect("a fixed slot must have its actual named storage and identity fit", element.origin);
    const place = bindingDestination(lowering, element, binding);
    if (place === null || !emitStatement(lowering.state,
      { ...site, kind: "assign", place, value: { kind: "use", operand: { kind: "place", place: projected } }, step: null })) return false;
  }
  return true;
}

export function declareLocal(lowering: Lowering, node: VariableDeclaration<TypedPhase>, lexical: boolean): boolean {
  if ("role" in node.tsonic) return preparePattern(lowering, node, lexical);
  const selected = namedBindingOf(node);
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
  const source = localBinding(lowering, node, selected, "binding");
  let local = lowering.localOf.get(source.local);
  if (lexical) {
    const scope = requirePresent(lowering.scope ?? undefined, failure("a lexical declaration has no enclosing scope", node.origin));
    if (scope.kind === "case") {
      if (local === undefined) return callerDefect("a case declaration has no live shared lexical slot", node.origin);
    } else {
      const allocated = startLexicalLocal(lowering, scope, node, source, selected.storage, "user");
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
  const unwind = unwindToHandler(lowering, node);
  if (unwind === null) return false;
  terminate(lowering.state, { ...site, kind: "call", callee: { kind: "body", instance: input.instance, captures },
    receiver: null, arguments: [], destination, next, unwind, step: null });
  enterBlock(lowering.state, next);
  return true;
}
