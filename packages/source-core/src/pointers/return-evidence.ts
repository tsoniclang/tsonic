import { pointerFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram, SourceNavigationCall } from "@tsonic/target-api/host";
import type { SourceCompletionSelection, SourceTypeDescriptor } from "@tsonic/target-api/source";
import {
  tsonicDescriptorArms, tsonicDescriptorHasTypeVariables, tsonicDescriptorIsAbsent, tsonicPointerValuePointee, tsonicValueType,
} from "./host-values.js";
import { pointerFlowCallableBoundary, pointerFlowOperand } from "./backing/source-forms.js";
import { selectTsonicRawLocationOperation } from "./raw-memory/selection.js";
import { selectTsonicPointerView } from "./views/selection.js";

/** Pointer return evidence over Host facts (I1): pointee and absence arms are Host descriptors. */
export interface TsonicPointerReturnEvidence {
  readonly pointees: readonly { readonly subject: Node; readonly type: SourceTypeDescriptor; readonly typeNode?: Node }[];
  /** The absence arms (null / undefined / void) of the Host result of the callable. */
  readonly nullishTypes: readonly SourceTypeDescriptor[];
  readonly completion: SourceCompletionSelection;
}

export interface TsonicPointerReturnQueries {
  resolve(declaration: Node): TsonicPointerReturnEvidence | undefined;
}

interface PointerReturnCallFrame {
  readonly call: SourceNavigationCall;
  readonly implementation: Node;
  readonly caller: PointerReturnCallFrame | undefined;
  readonly values: Map<Node, PointerReturnValue>;
}

interface PointerReturnValue {
  readonly node: Node;
  readonly frame: PointerReturnCallFrame | undefined;
}

export function createTsonicPointerReturnQueries(
  source: HostSourceProgram,
  maximumValues = 131_072,
): TsonicPointerReturnQueries {
  if (!Number.isSafeInteger(maximumValues) || maximumValues < 1) {
    throw new Error("Pointer return evidence requires a positive finite source-value budget.");
  }
  const results = new WeakMap<Node, TsonicPointerReturnEvidence | null>();
  return Object.freeze({
    resolve(declaration: Node) {
      const previous = results.get(declaration);
      if (previous !== undefined) return previous ?? undefined;
      const result = selectTsonicPointerReturnEvidence(source, declaration, maximumValues);
      results.set(declaration, result ?? null);
      return result;
    },
  });
}

function selectTsonicPointerReturnEvidence(
  source: HostSourceProgram,
  declaration: Node,
  maximumValues: number,
): TsonicPointerReturnEvidence | undefined {
  const { ast, navigation, facts, sourceFacts } = source;
  if (ast.body(declaration) === undefined ||
    ast.hasModifierKind(declaration, "async")) return undefined;
  if (facts.selections.generator(declaration) !== undefined) return undefined;
  const completion = facts.selections.completion(declaration);
  if (completion === undefined) return undefined;
  const result = facts.values.callableReturn(declaration);
  if (result.kind === "refused") return undefined;
  const nullishTypes = tsonicDescriptorArms(result.type).filter(tsonicDescriptorIsAbsent);
  const variable = (type: SourceTypeDescriptor): boolean => tsonicDescriptorHasTypeVariables(ast, type);
  const root: PointerReturnValue = { node: declaration, frame: undefined };
  const queue: PointerReturnValue[] = [root];
  const unscopedValues = new Map<Node, PointerReturnValue>([[declaration, root]]);
  const parents = new Map<PointerReturnValue, Set<PointerReturnValue>>();
  const terminals = new Set<PointerReturnValue>();
  const pointees: { readonly subject: Node; readonly type: SourceTypeDescriptor; readonly typeNode?: Node }[] = [];
  let complete = true;
  let visited = 0;

  function edge(parent: PointerReturnValue, node: Node | undefined, frame: PointerReturnCallFrame | undefined): void {
    if (node === undefined) { complete = false; return; }
    const values = frame?.values ?? unscopedValues;
    let value = values.get(node);
    if (value === undefined) {
      if (queue.length >= maximumValues) { complete = false; return; }
      value = { node, frame };
      values.set(node, value);
      queue.push(value);
    }
    let dependencies = parents.get(value);
    if (dependencies === undefined) parents.set(value, dependencies = new Set());
    dependencies.add(parent);
  }

  function collectReturns(owner: PointerReturnValue): void {
    const body = ast.body(owner.node);
    if (body === undefined) { complete = false; return; }
    if (!ast.is.IsBlock(body)) { edge(owner, body, owner.frame); return; }
    const pending: Node[] = [body];
    while (pending.length > 0 && complete) {
      if (++visited > maximumValues) { complete = false; return; }
      const statement = pending.pop()!;
      if (ast.is.IsReturnStatement(statement)) {
        const expression = ast.as.AsReturnStatement(statement)?.Expression;
        if (expression === undefined) terminals.add(owner);
        else edge(owner, expression, owner.frame);
      } else if (!pointerFlowCallableBoundary(ast, statement)) {
        ast.forEachChild(statement, child => { if (child !== undefined) pending.push(child); });
      }
    }
  }

  function collectWrites(value: PointerReturnValue): void {
    const binding = navigation.sourceReferenceFor(ast.name(value.node))?.declaration;
    if (binding === undefined) { complete = false; return; }
    for (const file of navigation.sourceFiles) {
      for (const write of navigation.bindingWritesWithin(binding, file)) {
        if (++visited > maximumValues || write.kind !== "assignment" || ast.operatorKindName(write.operation) !== "KindEqualsToken") {
          complete = false;
          return;
        }
        edge(value, ast.as.AsBinaryExpression(write.operation)?.Right, value.frame);
      }
    }
  }

  for (let index = 0; index < queue.length && complete; index++) {
    if (++visited > maximumValues) return undefined;
    const value = queue[index]!;
    const { node, frame } = value;
    const view = selectTsonicPointerView(ast, sourceFacts, node);
    if (view !== undefined) {
      const pointee = tsonicPointerValuePointee(source, node);
      if (view.kind !== "resolved" || pointee === undefined || frame !== undefined && variable(pointee)) return undefined;
      const typeNode = view.operation.explicitPointeeTypeNode;
      pointees.push(Object.freeze({ subject: node, type: pointee,
        ...(typeNode === undefined ? {} : { typeNode }) }));
      terminals.add(value);
      continue;
    }
    const raw = selectTsonicRawLocationOperation(ast, sourceFacts, node);
    if (raw !== undefined) {
      if (raw.kind !== "resolved" || raw.operation.operation !== "reinterpret") return undefined;
      const pointee = tsonicPointerValuePointee(source, node);
      if (pointee === undefined || frame !== undefined && variable(pointee)) return undefined;
      const typeNode = raw.operation.explicitPointeeTypeNode ??
        (raw.layout.kind === "value" ? raw.layout.explicitTypeNode : undefined);
      pointees.push(Object.freeze({ subject: node, type: pointee,
        ...(typeNode === undefined ? {} : { typeNode }) }));
      terminals.add(value);
      continue;
    }
    const operation = ast.is.IsCallExpression(node) ? facts.selections.pointerOperation(node) : undefined;
    if (operation !== undefined && "kind" in operation) return undefined;
    if (operation !== undefined) {
      if (operation.call !== node || !["address-of", "allocate", "bind-pointer", "project-pointer"].includes(operation.operation)) return undefined;
      if (frame !== undefined && variable(operation.pointee)) return undefined;
      // The authored pointee annotation: an explicit marker type argument, else the selected storage declaration.
      const explicit = ast.typeArguments(node)[0];
      const initial = operation.operation === "allocate" ? operation.operands[0] : undefined;
      const selectedDeclaration = operation.operation === "address-of" ? operation.storageDeclaration
        : initial === undefined ? undefined : navigation.sourceReferenceFor(initial)?.declaration;
      const typeNode = explicit ?? ast.typeNode(selectedDeclaration);
      pointees.push(Object.freeze({ subject: node, type: operation.pointee,
        ...(typeNode === undefined ? {} : { typeNode }) }));
      terminals.add(value);
      continue;
    }
    if (frame !== undefined && ast.is.IsParameterDeclaration(node)) {
      let owner: PointerReturnCallFrame | undefined = frame;
      while (owner !== undefined && owner.implementation !== ast.parent(node)) owner = owner.caller;
      const parameter = owner?.call.parameters.find(parameter => parameter.parameterDeclaration === node);
      if (owner === undefined || parameter === undefined) return undefined;
      const bindings = owner.call.bindings.filter(binding => binding.sourceParameterIndex === parameter.parameterIndex);
      if (bindings.length === 0) {
        if (!parameter.acceptsOmission) return undefined;
        const initial = ast.as.AsParameterDeclaration(node)?.Initializer;
        if (initial === undefined) terminals.add(value);
        else edge(value, initial, owner);
      } else if (bindings.length === 1 && bindings[0]!.sourceForm === "value" && bindings[0]!.sourceParameterForm === "parameter") {
        edge(value, owner.call.arguments[bindings[0]!.sourceArgumentIndex], owner.caller);
      } else return undefined;
      collectWrites(value);
      continue;
    }
    const typeNode = ast.typeNode(node);
    if (typeNode !== undefined && frame === undefined) {
      const pending = [typeNode];
      while (pending.length > 0 && complete) {
        if (++visited > maximumValues) return undefined;
        const candidate = pending.pop()!;
        const pointer = sourceFacts.getFact(candidate, pointerFactKey);
        const type = tsonicValueType(source, candidate);
        if (pointer !== undefined) {
          const pointeeType = tsonicValueType(source, pointer.pointee);
          if (pointeeType === undefined) return undefined;
          pointees.push(Object.freeze({ subject: node, type: pointeeType, typeNode: pointer.pointee }));
          terminals.add(value);
        } else if (type !== undefined && tsonicDescriptorIsAbsent(type)) terminals.add(value);
        else if (ast.is.IsUnionTypeNode(candidate)) {
          for (const child of ast.children(candidate)) {
            if (child === undefined) return undefined;
            pending.push(child);
          }
        }
        else return undefined;
      }
      continue;
    }
    if (node === declaration || ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node)) {
      collectReturns(value);
      continue;
    }
    const operand = pointerFlowOperand(ast, node);
    if (operand !== undefined) { edge(value, operand, frame); continue; }
    if (ast.is.IsConditionalExpression(node)) {
      const conditional = ast.as.AsConditionalExpression(node);
      edge(value, conditional?.WhenTrue, frame); edge(value, conditional?.WhenFalse, frame);
      continue;
    }
    const selectedType = tsonicValueType(source, node);
    if (selectedType !== undefined && tsonicDescriptorIsAbsent(selectedType)) { terminals.add(value); continue; }
    if (ast.is.IsIdentifier(node)) { edge(value, navigation.sourceReferenceFor(node)?.declaration, frame); continue; }
    if (ast.is.IsVariableDeclaration(node)) {
      edge(value, ast.as.AsVariableDeclaration(node)?.Initializer, frame);
      collectWrites(value);
      continue;
    }
    if (ast.is.IsCallExpression(node)) {
      const call = navigation.call(node);
      const selected = call?.signature;
      if (call === undefined || selected === undefined) return undefined;
      const implementation = navigation.callableImplementation(selected);
      if (implementation.kind !== "resolved" || !ast.is.IsFunctionDeclaration(implementation.implementation.declaration)) return undefined;
      const target = implementation.implementation.declaration;
      const calleeFrame = frame === undefined && ast.typeParameters(selected).length === 0 ? undefined : {
        call, implementation: target, caller: frame, values: new Map<Node, PointerReturnValue>(),
      };
      edge(value, target, calleeFrame);
      continue;
    }
    return undefined;
  }
  if (!complete || pointees.length === 0) return undefined;
  const anchored = new Set(terminals);
  const settled = [...terminals];
  for (let index = 0; index < settled.length; index++) {
    for (const parent of parents.get(settled[index]!) ?? []) {
      if (!anchored.has(parent)) { anchored.add(parent); settled.push(parent); }
    }
  }
  return queue.every(node => anchored.has(node))
    ? Object.freeze({ pointees: Object.freeze(pointees), nullishTypes: Object.freeze(nullishTypes),
      completion })
    : undefined;
}
