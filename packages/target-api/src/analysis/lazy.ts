import type {
  AstReader,
  Node,
  Signature,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type {
  TargetLazySourceAnalysis,
  TargetSourceAccessKind,
  TargetSourceCallsite,
  TargetSourceReferenceRecord,
  TargetSourceUseOperation,
  TargetSourceUseRecord,
} from "./types.js";
export type LazySourceOccurrence = "value" | "type" | "namespace" | "import" | "export";

export type LazySourceUseKind =
  | "read"
  | "write"
  | "compound-write"
  | "call"
  | "construct"
  | "property-read"
  | "property-write"
  | "property-call"
  | "property-delete"
  | "element-read"
  | "element-write"
  | "element-delete"
  | "argument"
  | "return"
  | "yield"
  | "await"
  | "iteration"
  | "spread"
  | "destructure"
  | "operator";

export interface LazySourceReferenceRecord extends TargetSourceReferenceRecord {
  readonly resolvedSymbol?: Symbol;
  readonly enclosingFunction?: Node;
  readonly enclosingDeclaration?: Node;
  readonly occurrence: LazySourceOccurrence;
}

export interface LazySourceUseRecord extends TargetSourceUseRecord {
  readonly kind: LazySourceUseKind;
  readonly base?: Node;
  readonly valueExpression?: Node;
  readonly elementArgument?: Node;
  readonly selectedSignature?: Signature;
  readonly selectedSignatureDeclaration?: Node;
  readonly typeArguments?: readonly Node[];
  readonly arguments?: readonly Node[];
  readonly enclosingFunction?: Node;
  readonly enclosingDeclaration?: Node;
}

export interface LazySourceCallsite extends TargetSourceCallsite {
  readonly kind: "call" | "construct";
  readonly receiver?: Node;
  readonly propertyName?: string;
  readonly propertySymbol?: Symbol;
  readonly selectedSignature?: Signature;
  readonly arguments: readonly Node[];
  readonly typeArguments: readonly Node[];
}

export interface LazyTargetSourceAnalysis extends TargetLazySourceAnalysis {
  referencesOf(symbol: Symbol | undefined): readonly LazySourceReferenceRecord[];
  usesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  readsOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  writesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  mutationsOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  propertyReadsOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  propertyWritesOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  elementReadsOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  elementWritesOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  callsitesOf(functionSymbol: Symbol | undefined): readonly LazySourceCallsite[];
  constructSitesOf(functionSymbol: Symbol | undefined): readonly LazySourceCallsite[];
  awaitsOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  forInSitesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  bindingUsesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
}

export function createLazyTargetSourceAnalysis(
  ast: AstReader,
  checker: TypeCheckerQueries,
  sourceFiles: readonly SourceFile[],
): LazyTargetSourceAnalysis {
  const referenceCache = new WeakMap<object, readonly LazySourceReferenceRecord[]>();
  const useCache = new WeakMap<object, readonly LazySourceUseRecord[]>();
  const filteredUseCache = new WeakMap<object, Map<string, readonly LazySourceUseRecord[]>>();
  const callsiteCache = new WeakMap<object, readonly LazySourceCallsite[]>();
  const filteredCallsiteCache = new WeakMap<object, Map<string, readonly LazySourceCallsite[]>>();

  return {
    referencesOf(symbol) {
      return referencesOf(symbol);
    },
    usesOf(symbol) {
      return usesOf(symbol);
    },
    readsOf(symbol) {
      return filteredUses(symbol, "reads", (use) => use.access === "read");
    },
    writesOf(symbol) {
      return filteredUses(symbol, "writes", (use) => use.access === "write");
    },
    mutationsOf(symbol) {
      return filteredUses(symbol, "mutations", (use) => use.access === "write" || use.access === "delete");
    },
    propertyReadsOn(symbol) {
      return filteredUses(symbol, "propertyReads", (use) => use.operation === "property" && use.access === "read");
    },
    propertyWritesOn(symbol) {
      return filteredUses(symbol, "propertyWrites", (use) => use.operation === "property" && use.access === "write");
    },
    elementReadsOn(symbol) {
      return filteredUses(symbol, "elementReads", (use) => use.operation === "element" && use.access === "read");
    },
    elementWritesOn(symbol) {
      return filteredUses(symbol, "elementWrites", (use) => use.operation === "element" && use.access === "write");
    },
    callsitesOf(symbol) {
      return filteredCallsites(symbol, "calls", (callsite) => callsite.kind === "call");
    },
    constructSitesOf(symbol) {
      return filteredCallsites(symbol, "constructs", (callsite) => callsite.kind === "construct");
    },
    awaitsOf(symbol) {
      return filteredUses(symbol, "awaits", (use) => use.operation === "await");
    },
    forInSitesOf(symbol) {
      return filteredUses(symbol, "forInSites", (use) => use.operation === "iteration" && use.iterationKind === "for-in");
    },
    bindingUsesOf(symbol) {
      return filteredUses(symbol, "bindingUses", (use) => use.operation === "destructure");
    },
  };

  function referencesOf(symbol: Symbol | undefined): readonly LazySourceReferenceRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = referenceCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const references: LazySourceReferenceRecord[] = [];
    const seen = new Set<string>();
    for (const sourceFile of sourceFiles) {
      visitSourceNodes(sourceFile, (candidate) => {
        const referenceNode = getReferenceNode(candidate);
        if (referenceNode === undefined) {
          return;
        }
        const referenced = getSymbolForReference(referenceNode, sourceFile);
        if (!symbolsMatch(referenced, symbol, sourceFile)) {
          return;
        }
        const key = sourceNodeKey(sourceFile, referenceNode);
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        references.push({
          symbol,
          resolvedSymbol: referenced,
          sourceFile,
          node: referenceNode,
          enclosingFunction: nearestFunctionLike(referenceNode),
          enclosingDeclaration: nearestDeclaration(referenceNode),
          occurrence: getReferenceOccurrence(referenceNode),
        });
      });
    }
    referenceCache.set(symbol, references);
    return references;
  }

  function usesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = useCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const uses = referencesOf(symbol)
      .filter((reference) => reference.occurrence !== "import" && reference.occurrence !== "export")
      .map((reference) => classifyReferenceUse(reference));
    useCache.set(symbol, uses);
    return uses;
  }

  function filteredUses(
    symbol: Symbol | undefined,
    key: string,
    predicate: (use: LazySourceUseRecord) => boolean,
  ): readonly LazySourceUseRecord[] {
    if (symbol === undefined) {
      return [];
    }
    let symbolCache = filteredUseCache.get(symbol);
    if (symbolCache === undefined) {
      symbolCache = new Map();
      filteredUseCache.set(symbol, symbolCache);
    }
    const cached = symbolCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const filtered = usesOf(symbol).filter(predicate);
    symbolCache.set(key, filtered);
    return filtered;
  }

  function callsitesOf(symbol: Symbol | undefined): readonly LazySourceCallsite[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = callsiteCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const callsites: LazySourceCallsite[] = [];
    for (const sourceFile of sourceFiles) {
      visitSourceNodes(sourceFile, (node) => {
        if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node)) {
          return;
        }
        const callee = getCallExpressionNode(node);
        if (callee === undefined || !symbolsMatch(getSymbolForReference(callee, sourceFile), symbol, sourceFile)) {
          return;
        }
        callsites.push(createCallsite(symbol, sourceFile, node, callee));
      });
    }
    callsiteCache.set(symbol, callsites);
    return callsites;
  }

  function filteredCallsites(
    symbol: Symbol | undefined,
    key: string,
    predicate: (callsite: LazySourceCallsite) => boolean,
  ): readonly LazySourceCallsite[] {
    if (symbol === undefined) {
      return [];
    }
    let symbolCache = filteredCallsiteCache.get(symbol);
    if (symbolCache === undefined) {
      symbolCache = new Map();
      filteredCallsiteCache.set(symbol, symbolCache);
    }
    const cached = symbolCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const filtered = callsitesOf(symbol).filter(predicate);
    symbolCache.set(key, filtered);
    return filtered;
  }

  function classifyReferenceUse(reference: LazySourceReferenceRecord): LazySourceUseRecord {
    const node = reference.node;
    const sourceFile = reference.sourceFile;
    const parent = ast.parent(node);
    const parentPropertyAccess = asPropertyAccessExpression(parent);
    if (parent !== undefined && parentPropertyAccess !== undefined && parentPropertyAccess.Expression === node) {
      return createPropertyUse(reference, parent, parentPropertyAccess);
    }
    const parentElementAccess = asElementAccessExpression(parent);
    if (parent !== undefined && parentElementAccess !== undefined && parentElementAccess.Expression === node) {
      return createElementUse(reference, parent, parentElementAccess);
    }
    const parentCall = parent === undefined ? undefined : asCallOrConstruct(parent);
    if (parent !== undefined && parentCall !== undefined && parentCall.expression === node) {
      return {
        ...baseUse(reference, "call", parent, node),
        kind: parentCall.kind,
        call: parent,
        selectedSignature: getSelectedSignature(parent, sourceFile),
        selectedSignatureDeclaration: getSelectedSignatureDeclaration(parent, sourceFile),
        arguments: presentNodes(ast.arguments(parent)),
        typeArguments: presentNodes(ast.typeArguments(parent)),
      };
    }
    if (parent !== undefined && parentCall !== undefined) {
      const callArguments = presentNodes(ast.arguments(parent));
      const argumentIndex = callArguments.indexOf(node);
      if (argumentIndex >= 0) {
        return {
          ...baseUse(reference, "argument", parent, node),
          kind: "argument",
          call: parent,
          argumentIndex,
          selectedSignature: getSelectedSignature(parent, sourceFile),
          selectedSignatureDeclaration: getSelectedSignatureDeclaration(parent, sourceFile),
        };
      }
    }
    const binaryExpression = asBinaryExpression(parent);
    if (binaryExpression !== undefined && binaryExpression.Right === node && getBinaryOperatorText(binaryExpression.OperatorToken) === "in") {
      return {
        ...baseUse(reference, "operator", parent, parent),
        kind: "operator",
        operator: "in",
      };
    }
    if (isDeclarationInitializer(node, parent)) {
      return {
        ...baseUse(reference, "destructure", parent, node),
        kind: "destructure",
      };
    }
    if (isDestructuringAssignmentRightHandSide(node, parent)) {
      return {
        ...baseUse(reference, "destructure", parent, parent),
        kind: "destructure",
        operator: getBinaryOperatorText(asBinaryExpression(parent)?.OperatorToken),
      };
    }
    if (isIterationExpression(node, parent)) {
      return {
        ...baseUse(reference, "iteration", parent, parent),
        kind: "iteration",
        iterationKind: parent !== undefined && ast.is.IsForInStatement(parent) ? "for-in" : "for-of",
      };
    }
    if (isSpreadExpression(node, parent)) {
      return {
        ...baseUse(reference, "spread", parent, parent),
        kind: "spread",
      };
    }
    if (isAwaitExpression(node, parent)) {
      return {
        ...baseUse(reference, "await", parent, parent),
        kind: "await",
      };
    }
    if (isYieldExpression(node, parent)) {
      return {
        ...baseUse(reference, "yield", parent, parent),
        kind: "yield",
      };
    }
    const returnStatement = asReturnStatement(parent);
    if (returnStatement !== undefined && returnStatement.Expression === node) {
      return {
        ...baseUse(reference, "return", parent, parent),
        kind: "return",
      };
    }
    if (parentIsWriteTarget(node)) {
      const operator = getAssignmentOperatorForTarget(node);
      return {
        ...baseUse(reference, "reference", parent, node, "write"),
        kind: operator === "=" ? "write" : "compound-write",
        operator,
        valueExpression: getAssignmentValueForTarget(node),
      };
    }
    return {
      ...baseUse(reference, "reference", parent, node),
      kind: "read",
    };
  }

  function createPropertyUse(
    reference: LazySourceReferenceRecord,
    propertyAccessNode: Node,
    propertyAccess: NonNullable<ReturnType<AstReader["as"]["AsPropertyAccessExpression"]>>,
  ): LazySourceUseRecord {
    const call = parentIsCallCallee(propertyAccessNode);
    const access = getAccessKind(propertyAccessNode);
    const operator = getAssignmentOperatorForTarget(propertyAccessNode);
    const propertySymbol = checker.getSymbolAtLocation(propertyAccessNode, { sourceFile: reference.sourceFile }) ??
      getResolvedSymbolForQueryNode(propertyAccessNode, reference.sourceFile);
    return {
      ...baseUse(reference, call === undefined ? "property" : "call", propertyAccessNode, propertyAccessNode, access),
      kind: call === undefined ? getPropertyUseKind(access, operator) : "property-call",
      base: propertyAccess.Expression,
      propertyName: textOf(propertyAccess.name),
      propertySymbol,
      selectedDeclaration: primaryDeclaration(propertySymbol),
      selectedSignature: call === undefined ? undefined : getSelectedSignature(call, reference.sourceFile),
      selectedSignatureDeclaration: call === undefined ? undefined : getSelectedSignatureDeclaration(call, reference.sourceFile),
      call,
      operator,
      valueExpression: getAssignmentValueForTarget(propertyAccessNode),
      arguments: call === undefined ? undefined : presentNodes(ast.arguments(call)),
      typeArguments: call === undefined ? undefined : presentNodes(ast.typeArguments(call)),
    };
  }

  function createElementUse(
    reference: LazySourceReferenceRecord,
    elementAccessNode: Node,
    elementAccess: NonNullable<ReturnType<AstReader["as"]["AsElementAccessExpression"]>>,
  ): LazySourceUseRecord {
    const access = getAccessKind(elementAccessNode);
    const operator = getAssignmentOperatorForTarget(elementAccessNode);
    return {
      ...baseUse(reference, "element", elementAccessNode, elementAccessNode, access),
      kind: access === "delete" ? "element-delete" : access === "write" ? "element-write" : "element-read",
      base: elementAccess.Expression,
      elementArgument: elementAccess.ArgumentExpression,
      operator,
      valueExpression: getAssignmentValueForTarget(elementAccessNode),
    };
  }

  function createCallsite(symbol: Symbol | undefined, sourceFile: SourceFile, call: Node, callee: Node | undefined): LazySourceCallsite {
    const propertyAccess = asPropertyAccessExpression(callee);
    const selectedSignature = getSelectedSignature(call, sourceFile);
    return {
      symbol,
      sourceFile,
      call,
      callee,
      kind: ast.is.IsNewExpression(call) ? "construct" : "call",
      receiver: propertyAccess?.Expression,
      propertyName: propertyAccess?.name === undefined ? undefined : textOf(propertyAccess.name),
      propertySymbol: propertyAccess === undefined || callee === undefined ? undefined : checker.getSymbolAtLocation(callee, { sourceFile }),
      selectedSignature,
      selectedSignatureDeclaration: selectedSignature === undefined ? undefined : checker.getSignatureDeclaration(selectedSignature),
      arguments: presentNodes(ast.arguments(call)),
      typeArguments: presentNodes(ast.typeArguments(call)),
    };
  }

  function baseUse(
    reference: LazySourceReferenceRecord,
    operation: TargetSourceUseOperation,
    parent: Node | undefined,
    expression: Node | undefined,
    access: TargetSourceAccessKind = "read",
  ): Omit<LazySourceUseRecord, "kind"> {
    return {
      ...reference,
      operation,
      access,
      parent,
      expression,
      enclosingFunction: reference.enclosingFunction,
      enclosingDeclaration: reference.enclosingDeclaration,
    };
  }

  function getAccessKind(node: Node): TargetSourceAccessKind {
    if (isDeleteOperand(node)) {
      return "delete";
    }
    return parentIsWriteTarget(node) ? "write" : "read";
  }

  function getPropertyUseKind(access: TargetSourceAccessKind, operator: string | undefined): LazySourceUseKind {
    if (access === "delete") {
      return "property-delete";
    }
    if (access === "write") {
      return operator === "=" ? "property-write" : "compound-write";
    }
    return "property-read";
  }

  function getReferenceNode(node: Node): Node | undefined {
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsQualifiedName(node)) {
      return node;
    }
    if (!ast.is.IsIdentifier(node) && !ast.is.IsPrivateIdentifier(node)) {
      return undefined;
    }
    const parent = ast.parent(node);
    const parentPropertyAccess = asPropertyAccessExpression(parent);
    if (parentPropertyAccess !== undefined && parentPropertyAccess.name === node) {
      return parent;
    }
    const parentQualifiedName = asQualifiedName(parent);
    if (parentQualifiedName !== undefined && parentQualifiedName.Right === node) {
      return parent;
    }
    const parentTypeReference = asTypeReferenceNode(parent);
    if (parentTypeReference !== undefined && parentTypeReference.TypeName === node) {
      return node;
    }
    return node;
  }

  function getReferenceOccurrence(node: Node): LazySourceOccurrence {
    if (hasAncestor(node, (ancestor) => ast.is.IsImportDeclaration(ancestor) || ast.is.IsImportSpecifier(ancestor) || ast.is.IsImportClause(ancestor))) {
      return "import";
    }
    if (hasAncestor(node, (ancestor) => ast.is.IsExportDeclaration(ancestor) || ast.is.IsExportSpecifier(ancestor))) {
      return "export";
    }
    return isTypeReferenceQuery(ast, node) ? "type" : "value";
  }

  function symbolsMatch(candidate: Symbol | undefined, requested: Symbol, sourceFile: SourceFile): boolean {
    if (candidate === undefined) {
      return false;
    }
    if (candidate === requested) {
      return true;
    }
    const options = { sourceFile };
    const candidateAlias = getAliasedSymbolIfAlias(checker, candidate, options);
    const requestedAlias = getAliasedSymbolIfAlias(checker, requested, options);
    return candidateAlias === requested ||
      requestedAlias === candidate ||
      (candidateAlias !== undefined && candidateAlias === requestedAlias);
  }

  function getSymbolForReference(node: Node, sourceFile: SourceFile): Symbol | undefined {
    return checker.getSymbolAtLocation(node, { sourceFile }) ?? getResolvedSymbolForQueryNode(node, sourceFile);
  }

  function getResolvedSymbolForQueryNode(node: Node, sourceFile: SourceFile): Symbol | undefined {
    const queryNode = ast.is.IsPropertyAccessExpression(node)
      ? ast.name(node)
      : node;
    return queryNode === undefined ? undefined : checker.getResolvedSymbolOrNil(queryNode, { sourceFile });
  }

  function getSelectedSignature(node: Node, sourceFile: SourceFile): Signature | undefined {
    return checker.getResolvedSignature(node, { sourceFile });
  }

  function getSelectedSignatureDeclaration(node: Node, sourceFile: SourceFile): Node | undefined {
    const signature = getSelectedSignature(node, sourceFile);
    return signature === undefined ? undefined : checker.getSignatureDeclaration(signature);
  }

  function primaryDeclaration(symbol: Symbol | undefined): Node | undefined {
    return checker.getSymbolDeclarations(symbol).find((declaration): declaration is Node => declaration !== undefined);
  }

  function getCallExpressionNode(node: Node): Node | undefined {
    return asCallExpression(node)?.Expression ?? asNewExpression(node)?.Expression;
  }

  function asCallOrConstruct(node: Node): { readonly kind: "call" | "construct"; readonly expression: Node | undefined } | undefined {
    if (ast.is.IsCallExpression(node)) {
      const callExpression = asCallExpression(node);
      return callExpression === undefined ? undefined : { kind: "call", expression: callExpression.Expression };
    }
    if (ast.is.IsNewExpression(node)) {
      const newExpression = asNewExpression(node);
      return newExpression === undefined ? undefined : { kind: "construct", expression: newExpression.Expression };
    }
    return undefined;
  }

  function parentIsCallCallee(node: Node): Node | undefined {
    const parent = ast.parent(node);
    const call = parent === undefined ? undefined : asCallOrConstruct(parent);
    return call !== undefined && call.expression === node ? parent : undefined;
  }

  function parentIsWriteTarget(node: Node): boolean {
    const parent = ast.parent(node);
    if (parent === undefined) {
      return false;
    }
    const binaryExpression = asBinaryExpression(parent);
    if (binaryExpression !== undefined && binaryExpression.Left === node) {
      return isWriteOperator(getBinaryOperatorText(binaryExpression.OperatorToken));
    }
    const prefix = asPrefixUnaryExpression(parent);
    if (prefix !== undefined && prefix.Operand === node) {
      return true;
    }
    const postfix = asPostfixUnaryExpression(parent);
    return postfix !== undefined && postfix.Operand === node;
  }

  function getAssignmentOperatorForTarget(node: Node): string | undefined {
    const parent = ast.parent(node);
    if (parent === undefined) {
      return undefined;
    }
    const binaryExpression = asBinaryExpression(parent);
    if (binaryExpression !== undefined && binaryExpression.Left === node) {
      return getBinaryOperatorText(binaryExpression.OperatorToken);
    }
    if (asPrefixUnaryExpression(parent)?.Operand === node || asPostfixUnaryExpression(parent)?.Operand === node) {
      return ast.kindName(parent);
    }
    return undefined;
  }

  function getAssignmentValueForTarget(node: Node): Node | undefined {
    const parent = ast.parent(node);
    const binaryExpression = asBinaryExpression(parent);
    return binaryExpression !== undefined && binaryExpression.Left === node ? binaryExpression.Right : undefined;
  }

  function isDeleteOperand(node: Node): boolean {
    const parent = ast.parent(node);
    const deleteExpression = asDeleteExpression(parent);
    return deleteExpression !== undefined && deleteExpression.Expression === node;
  }

  function isDeclarationInitializer(node: Node, parent: Node | undefined): boolean {
    const variableDeclaration = asVariableDeclaration(parent);
    if (variableDeclaration === undefined || variableDeclaration.Initializer !== node) {
      return false;
    }
    return isDestructuringPattern(variableDeclaration.name);
  }

  function isDestructuringAssignmentRightHandSide(node: Node, parent: Node | undefined): boolean {
    const binaryExpression = asBinaryExpression(parent);
    return binaryExpression !== undefined &&
      binaryExpression.Right === node &&
      isWriteOperator(getBinaryOperatorText(binaryExpression.OperatorToken)) &&
      isDestructuringAssignmentTarget(binaryExpression.Left);
  }

  function isDestructuringAssignmentTarget(node: Node | undefined): boolean {
    return node !== undefined && (
      ast.is.IsObjectLiteralExpression(node) ||
      ast.is.IsArrayLiteralExpression(node) ||
      isDestructuringPattern(node)
    );
  }

  function isDestructuringPattern(node: Node | undefined): boolean {
    return node !== undefined && (ast.kindName(node) === "KindObjectBindingPattern" || ast.kindName(node) === "KindArrayBindingPattern");
  }

  function isIterationExpression(node: Node, parent: Node | undefined): boolean {
    if (parent === undefined || (!ast.is.IsForOfStatement(parent) && !ast.is.IsForInStatement(parent))) {
      return false;
    }
    return asForInOrOfStatement(parent)?.Expression === node;
  }

  function isSpreadExpression(node: Node, parent: Node | undefined): boolean {
    if (parent === undefined) {
      return false;
    }
    return asSpreadElement(parent)?.Expression === node || asSpreadAssignment(parent)?.Expression === node;
  }

  function isAwaitExpression(node: Node, parent: Node | undefined): boolean {
    return asAwaitExpression(parent)?.Expression === node;
  }

  function isYieldExpression(node: Node, parent: Node | undefined): boolean {
    return asYieldExpression(parent)?.Expression === node;
  }

  function nearestFunctionLike(node: Node | undefined): Node | undefined {
    let current = node;
    while (current !== undefined) {
      if (isFunctionLike(current)) {
        return current;
      }
      current = ast.parent(current);
    }
    return undefined;
  }

  function nearestDeclaration(node: Node | undefined): Node | undefined {
    let current = node;
    while (current !== undefined) {
      if (isDeclaration(current)) {
        return current;
      }
      current = ast.parent(current);
    }
    return undefined;
  }

  function isFunctionLike(node: Node): boolean {
    return ast.kindName(node) === "KindFunctionDeclaration" ||
      ast.kindName(node) === "KindMethodDeclaration" ||
      ast.kindName(node) === "KindArrowFunction" ||
      ast.kindName(node) === "KindFunctionExpression" ||
      ast.kindName(node) === "KindConstructor";
  }

  function isDeclaration(node: Node): boolean {
    return ast.is.IsVariableDeclaration(node) ||
      ast.is.IsParameterDeclaration(node) ||
      ast.is.IsFunctionDeclaration(node) ||
      ast.is.IsClassDeclaration(node) ||
      ast.is.IsInterfaceDeclaration(node) ||
      ast.is.IsTypeAliasDeclaration(node) ||
      ast.is.IsEnumDeclaration(node) ||
      ast.is.IsImportSpecifier(node) ||
      ast.is.IsExportSpecifier(node);
  }

  function hasAncestor(node: Node, predicate: (node: Node) => boolean): boolean {
    let current: Node | undefined = node;
    while (current !== undefined) {
      if (predicate(current)) {
        return true;
      }
      current = ast.parent(current);
    }
    return false;
  }

  function visitSourceNodes(node: Node, visitor: (node: Node) => void, seen: WeakSet<object> = new WeakSet()): void {
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    visitor(node);
    const children: Node[] = [];
    ast.forEachChild(node, (child) => {
      if (child !== undefined) {
        children.push(child);
      }
    });
    for (const child of children) {
      visitSourceNodes(child, visitor, seen);
    }
  }

  function sourceNodeKey(sourceFile: SourceFile, node: Node): string {
    return `${ast.getFileName(sourceFile)}:${ast.kindName(node)}:${ast.pos(node)}:${ast.end(node)}`;
  }

  function textOf(node: Node | undefined): string {
    return node === undefined ? "" : ast.text(node);
  }

  function getBinaryOperatorText(operatorToken: Node | undefined): string | undefined {
    return operatorToken === undefined ? undefined : operatorTextByKindName(ast.kindName(operatorToken));
  }

  function asPropertyAccessExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsPropertyAccessExpression"]> {
    return node !== undefined && ast.is.IsPropertyAccessExpression(node) ? ast.as.AsPropertyAccessExpression(node) : undefined;
  }

  function asElementAccessExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsElementAccessExpression"]> {
    return node !== undefined && ast.is.IsElementAccessExpression(node) ? ast.as.AsElementAccessExpression(node) : undefined;
  }

  function asCallExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsCallExpression"]> {
    return node !== undefined && ast.is.IsCallExpression(node) ? ast.as.AsCallExpression(node) : undefined;
  }

  function asNewExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsNewExpression"]> {
    return node !== undefined && ast.is.IsNewExpression(node) ? ast.as.AsNewExpression(node) : undefined;
  }

  function asBinaryExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsBinaryExpression"]> {
    return node !== undefined && ast.is.IsBinaryExpression(node) ? ast.as.AsBinaryExpression(node) : undefined;
  }

  function asPrefixUnaryExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsPrefixUnaryExpression"]> {
    return node !== undefined && ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node) : undefined;
  }

  function asPostfixUnaryExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsPostfixUnaryExpression"]> {
    return node !== undefined && ast.is.IsPostfixUnaryExpression(node) ? ast.as.AsPostfixUnaryExpression(node) : undefined;
  }

  function asDeleteExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsDeleteExpression"]> {
    return node !== undefined && ast.kindName(node) === "KindDeleteExpression" ? ast.as.AsDeleteExpression(node) : undefined;
  }

  function asVariableDeclaration(node: Node | undefined): ReturnType<AstReader["as"]["AsVariableDeclaration"]> {
    return node !== undefined && ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node) : undefined;
  }

  function asReturnStatement(node: Node | undefined): ReturnType<AstReader["as"]["AsReturnStatement"]> {
    return node !== undefined && ast.kindName(node) === "KindReturnStatement" ? ast.as.AsReturnStatement(node) : undefined;
  }

  function asQualifiedName(node: Node | undefined): ReturnType<AstReader["as"]["AsQualifiedName"]> {
    return node !== undefined && ast.is.IsQualifiedName(node) ? ast.as.AsQualifiedName(node) : undefined;
  }

  function asTypeReferenceNode(node: Node | undefined): ReturnType<AstReader["as"]["AsTypeReferenceNode"]> {
    return node !== undefined && ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node) : undefined;
  }

  function asForInOrOfStatement(node: Node | undefined): ReturnType<AstReader["as"]["AsForInOrOfStatement"]> {
    return node !== undefined && (ast.is.IsForInStatement(node) || ast.is.IsForOfStatement(node)) ? ast.as.AsForInOrOfStatement(node) : undefined;
  }

  function asSpreadElement(node: Node | undefined): ReturnType<AstReader["as"]["AsSpreadElement"]> {
    return node !== undefined && ast.kindName(node) === "KindSpreadElement" ? ast.as.AsSpreadElement(node) : undefined;
  }

  function asSpreadAssignment(node: Node | undefined): ReturnType<AstReader["as"]["AsSpreadAssignment"]> {
    return node !== undefined && ast.kindName(node) === "KindSpreadAssignment" ? ast.as.AsSpreadAssignment(node) : undefined;
  }

  function asAwaitExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsAwaitExpression"]> {
    return node !== undefined && ast.kindName(node) === "KindAwaitExpression" ? ast.as.AsAwaitExpression(node) : undefined;
  }

  function asYieldExpression(node: Node | undefined): ReturnType<AstReader["as"]["AsYieldExpression"]> {
    return node !== undefined && ast.kindName(node) === "KindYieldExpression" ? ast.as.AsYieldExpression(node) : undefined;
  }
}

function presentNodes(nodes: readonly (Node | undefined)[]): readonly Node[] {
  return nodes.filter((node): node is Node => node !== undefined);
}

function operatorTextByKindName(kindName: string | undefined): string | undefined {
  switch (kindName) {
    case "KindEqualsEqualsEqualsToken":
      return "===";
    case "KindEqualsEqualsToken":
      return "==";
    case "KindExclamationEqualsEqualsToken":
      return "!==";
    case "KindExclamationEqualsToken":
      return "!=";
    case "KindLessThanToken":
      return "<";
    case "KindLessThanEqualsToken":
      return "<=";
    case "KindGreaterThanToken":
      return ">";
    case "KindGreaterThanEqualsToken":
      return ">=";
    case "KindAmpersandAmpersandToken":
      return "&&";
    case "KindBarBarToken":
      return "||";
    case "KindQuestionQuestionToken":
      return "??";
    case "KindAmpersandToken":
      return "&";
    case "KindBarToken":
      return "|";
    case "KindCaretToken":
      return "^";
    case "KindLessThanLessThanToken":
      return "<<";
    case "KindGreaterThanGreaterThanToken":
      return ">>";
    case "KindGreaterThanGreaterThanGreaterThanToken":
      return ">>>";
    case "KindInKeyword":
      return "in";
    case "KindPlusToken":
      return "+";
    case "KindMinusToken":
      return "-";
    case "KindAsteriskToken":
      return "*";
    case "KindSlashToken":
      return "/";
    case "KindPercentToken":
      return "%";
    case "KindEqualsToken":
      return "=";
    case "KindPlusEqualsToken":
      return "+=";
    case "KindMinusEqualsToken":
      return "-=";
    case "KindAsteriskEqualsToken":
      return "*=";
    case "KindSlashEqualsToken":
      return "/=";
    case "KindPercentEqualsToken":
      return "%=";
    case "KindAmpersandAmpersandEqualsToken":
      return "&&=";
    case "KindAmpersandEqualsToken":
      return "&=";
    case "KindBarBarEqualsToken":
      return "||=";
    case "KindBarEqualsToken":
      return "|=";
    case "KindQuestionQuestionEqualsToken":
      return "??=";
    case "KindCaretEqualsToken":
      return "^=";
    case "KindLessThanLessThanEqualsToken":
      return "<<=";
    case "KindGreaterThanGreaterThanEqualsToken":
      return ">>=";
    case "KindGreaterThanGreaterThanGreaterThanEqualsToken":
      return ">>>=";
    default:
      return undefined;
  }
}

function isWriteOperator(operator: string | undefined): boolean {
  return operator !== undefined && writeOperators.has(operator);
}

const writeOperators = new Set([
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
  ">>>=",
  "&&=",
  "||=",
  "??=",
]);

const symbolFlagsAlias = 1 << 21;

function getAliasedSymbolIfAlias(
  checker: TypeCheckerQueries,
  symbol: Symbol | undefined,
  options: { readonly sourceFile: SourceFile },
): Symbol | undefined {
  return symbol !== undefined && (symbol.Flags & symbolFlagsAlias) !== 0
    ? checker.getAliasedSymbol(symbol, options)
    : undefined;
}

function isTypeReferenceQuery(ast: AstReader, node: Node): boolean {
  if (ast.is.IsTypeReferenceNode(node) || ast.is.IsTypeAliasDeclaration(node) || ast.is.IsInterfaceDeclaration(node)) {
    return true;
  }
  let parent = ast.parent(node);
  let current: Node | undefined = node;
  while (parent !== undefined && ast.is.IsQualifiedName(parent)) {
    current = parent;
    parent = ast.parent(parent);
  }
  if (parent === undefined || !ast.is.IsTypeReferenceNode(parent)) {
    return false;
  }
  return ast.as.AsTypeReferenceNode(parent)?.TypeName === current;
}
