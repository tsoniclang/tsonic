import { pointerFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import type { Node, ResolvedSourceCallableCompletionInfo, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import { pointerFlowCallableBoundary, pointerFlowOperand } from "./backing/source-forms.js";
import { selectTsonicRawLocationOperation } from "./raw-memory/selection.js";

export interface TsonicPointerReturnEvidence {
  readonly pointees: readonly { readonly subject: Node; readonly type: Type; readonly typeNode?: Node }[];
  readonly nullishTypes: readonly Type[];
  readonly completion: ResolvedSourceCallableCompletionInfo;
}

export interface TsonicPointerReturnQueries {
  resolve(declaration: Node): TsonicPointerReturnEvidence | undefined;
}

export function createTsonicPointerReturnQueries(
  source: TargetSourceProgram,
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
  source: TargetSourceProgram,
  declaration: Node,
  maximumValues: number,
): TsonicPointerReturnEvidence | undefined {
  const { ast, navigation, semantics, sourceFacts } = source;
  if (ast.body(declaration) === undefined ||
    ast.hasModifierKind(declaration, "async")) return undefined;
  const queries = semantics.forNode(declaration);
  if (queries.operations.generator(declaration) !== undefined) return undefined;
  const completion = queries.operations.callableCompletion(declaration);
  if (completion === undefined) return undefined;
  const callableType = queries.types.expressionType(declaration);
  const signatures = callableType === undefined ? [] : queries.types.callSignatures(callableType).filter(signature =>
    queries.declarations.signatureDeclaration(signature) === declaration);
  const resultType = signatures.length === 1 ? queries.types.returnType(signatures[0]!) : undefined;
  if (resultType === undefined) return undefined;
  const resultMembers = queries.types.isUnion(resultType) ? queries.types.unionOrIntersectionTypes(resultType) : [resultType];
  const nullishTypes = resultMembers.filter(type => queries.types.isNullish(type));
  const queue: Node[] = [declaration];
  const seen = new Set(queue);
  const parents = new Map<Node, Set<Node>>();
  const terminals = new Set<Node>();
  const pointees: { readonly subject: Node; readonly type: Type; readonly typeNode?: Node }[] = [];
  let complete = true;
  let visited = 0;

  function edge(parent: Node, value: Node | undefined): void {
    if (value === undefined) { complete = false; return; }
    let dependencies = parents.get(value);
    if (dependencies === undefined) parents.set(value, dependencies = new Set());
    dependencies.add(parent);
    if (!seen.has(value)) {
      if (seen.size >= maximumValues) { complete = false; return; }
      seen.add(value);
      queue.push(value);
    }
  }

  function collectReturns(owner: Node): void {
    const body = ast.body(owner);
    if (body === undefined) { complete = false; return; }
    if (!ast.is.IsBlock(body)) { edge(owner, body); return; }
    const pending: Node[] = [body];
    while (pending.length > 0 && complete) {
      if (++visited > maximumValues) { complete = false; return; }
      const statement = pending.pop()!;
      if (ast.is.IsReturnStatement(statement)) {
        const expression = ast.as.AsReturnStatement(statement)?.Expression;
        if (expression === undefined) terminals.add(owner);
        else edge(owner, expression);
      } else if (!pointerFlowCallableBoundary(ast, statement)) {
        ast.forEachChild(statement, child => { if (child !== undefined) pending.push(child); });
      }
    }
  }

  for (let index = 0; index < queue.length && complete; index++) {
    if (++visited > maximumValues) return undefined;
    const node = queue[index]!;
    const raw = selectTsonicRawLocationOperation(ast, sourceFacts, node);
    if (raw !== undefined) {
      if (raw.kind !== "resolved" || raw.operation.operation !== "reinterpret") return undefined;
      const typeNode = raw.operation.explicitPointeeTypeNode ?? raw.layout.explicitTypeNode;
      pointees.push(Object.freeze({ subject: node, type: raw.operation.pointeeType,
        ...(typeNode === undefined ? {} : { typeNode }) }));
      terminals.add(node);
      continue;
    }
    const operation = sourceFacts.getFact(node, pointerOperationFactKey);
    if (operation !== undefined) {
      if (operation.call !== node || !["address-of", "allocate", "bind-pointer", "project-pointer"].includes(operation.operation)) return undefined;
      const selectedDeclaration = operation.operation === "address-of" ? operation.storageDeclaration
        : operation.operation === "allocate" ? navigation.sourceReferenceFor(operation.initialExpression)?.declaration : undefined;
      const typeNode = operation.explicitPointeeTypeNode ?? ast.typeNode(selectedDeclaration);
      pointees.push(Object.freeze({ subject: node, type: operation.pointeeType,
        ...(typeNode === undefined ? {} : { typeNode }) }));
      terminals.add(node);
      continue;
    }
    const typeNode = ast.typeNode(node);
    if (typeNode !== undefined) {
      const pending = [typeNode];
      while (pending.length > 0 && complete) {
        if (++visited > maximumValues) return undefined;
        const candidate = pending.pop()!;
        const pointer = sourceFacts.getFact(candidate, pointerFactKey);
        const types = semantics.forNode(candidate).types;
        const type = types.authoredType(candidate);
        if (pointer !== undefined) {
          const pointeeType = types.authoredType(pointer.pointee);
          if (pointeeType === undefined) return undefined;
          pointees.push(Object.freeze({ subject: node, type: pointeeType, typeNode: pointer.pointee }));
          terminals.add(node);
        } else if (type !== undefined && types.isNullish(type)) terminals.add(node);
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
      collectReturns(node);
      continue;
    }
    const operand = pointerFlowOperand(ast, node);
    if (operand !== undefined) { edge(node, operand); continue; }
    if (ast.is.IsConditionalExpression(node)) {
      const conditional = ast.as.AsConditionalExpression(node);
      edge(node, conditional?.WhenTrue); edge(node, conditional?.WhenFalse);
      continue;
    }
    const types = semantics.forNode(node).types;
    const selectedType = types.expressionType(node);
    if (selectedType !== undefined && types.isNullish(selectedType)) { terminals.add(node); continue; }
    if (ast.is.IsIdentifier(node)) { edge(node, navigation.sourceReferenceFor(node)?.declaration); continue; }
    if (ast.is.IsVariableDeclaration(node)) {
      edge(node, ast.as.AsVariableDeclaration(node)?.Initializer);
      const symbol = navigation.sourceReferenceFor(ast.name(node))?.symbol;
      if (symbol === undefined) return undefined;
      for (const file of navigation.sourceFiles) {
        for (const write of navigation.bindingWritesWithin(symbol, file)) {
          if (++visited > maximumValues || write.kind !== "assignment" || ast.operatorKindName(write.operation) !== "KindEqualsToken") return undefined;
          edge(node, ast.as.AsBinaryExpression(write.operation)?.Right);
        }
      }
      continue;
    }
    if (ast.is.IsCallExpression(node)) {
      const call = semantics.forNode(node).operations.call(node);
      const selected = call === undefined ? undefined : semantics.forNode(node).declarations.signatureDeclaration(call.selectedSignature);
      if (selected === undefined || ast.typeParameters(selected).length !== 0) return undefined;
      const implementation = navigation.callableImplementation(selected);
      if (implementation.kind !== "resolved" || !ast.is.IsFunctionDeclaration(implementation.implementation.declaration)) return undefined;
      edge(node, implementation.implementation.declaration);
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
