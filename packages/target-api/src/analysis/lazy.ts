import type {
  AstReader,
  Node,
  Signature,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type {
  TargetArgumentFlowRecord,
  TargetFunctionSummary,
  TargetLazySourceAnalysis,
  TargetSourceAccessKind,
  TargetSourceCallsite,
  TargetSourceCaptureRecord,
  TargetSourceEscapeRecord,
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
  | "capture"
  | "escape"
  | "operator";

export interface LazySourceReferenceRecord extends TargetSourceReferenceRecord {
  readonly resolvedSymbol?: Symbol;
  readonly enclosingFunction?: Node;
  readonly enclosingDeclaration?: Node;
  readonly occurrence: LazySourceOccurrence;
}

export interface LazySourceDeclarationRecord {
  readonly symbol: Symbol;
  readonly sourceFile?: SourceFile;
  readonly node: Node;
  readonly occurrence: LazySourceOccurrence;
  readonly enclosingFunction?: Node;
  readonly enclosingDeclaration?: Node;
}

export interface LazySourceImportRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly binding: Node;
  readonly moduleSpecifier: Node;
  readonly importKind: "default" | "named" | "namespace";
  readonly importedName?: string;
  readonly localName: string;
  readonly isTypeOnly: boolean;
  readonly importedSymbol?: Symbol;
}

export interface LazySourceExportRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly node: Node;
  readonly exportKind: "local" | "named" | "default" | "assignment";
  readonly exportedName: string;
  readonly localName?: string;
  readonly moduleSpecifier?: Node;
  readonly isTypeOnly: boolean;
  readonly exportedSymbol?: Symbol;
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

export interface LazyReturnFlowRecord {
  readonly sourceFile?: SourceFile;
  readonly functionNode: Node;
  readonly returnStatement: Node;
  readonly expression?: Node;
}

export interface LazyFunctionSummary extends TargetFunctionSummary {
  readonly references: readonly LazySourceReferenceRecord[];
  readonly calls: readonly LazySourceCallsite[];
  readonly constructs: readonly LazySourceCallsite[];
  readonly returns: readonly Node[];
  readonly returnFlows: readonly LazyReturnFlowRecord[];
}

export interface LazyTargetSourceAnalysis extends TargetLazySourceAnalysis {
  declarationsOf(symbol: Symbol | undefined): readonly LazySourceDeclarationRecord[];
  importsOf(symbol: Symbol | undefined): readonly LazySourceImportRecord[];
  exportsOf(symbol: Symbol | undefined): readonly LazySourceExportRecord[];
  referencesOf(symbol: Symbol | undefined): readonly LazySourceReferenceRecord[];
  usesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  readsOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  writesOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  mutationsOf(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  propertyReadsOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  propertyWritesOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  propertyCallsOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  elementReadsOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  elementWritesOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  elementDeletesOn(symbol: Symbol | undefined): readonly LazySourceUseRecord[];
  callsitesOf(functionSymbol: Symbol | undefined): readonly LazySourceCallsite[];
  constructSitesOf(functionSymbol: Symbol | undefined): readonly LazySourceCallsite[];
  returnFlowOf(functionNode: Node): readonly LazyReturnFlowRecord[];
  summaryOf(functionNode: Node): LazyFunctionSummary;
}

export function createLazyTargetSourceAnalysis(
  ast: AstReader,
  checker: TypeCheckerQueries,
  sourceFiles: readonly SourceFile[],
): LazyTargetSourceAnalysis {
  const referenceCache = new WeakMap<object, readonly LazySourceReferenceRecord[]>();
  const declarationCache = new WeakMap<object, readonly LazySourceDeclarationRecord[]>();
  const importCache = new WeakMap<object, readonly LazySourceImportRecord[]>();
  const exportCache = new WeakMap<object, readonly LazySourceExportRecord[]>();
  const useCache = new WeakMap<object, readonly LazySourceUseRecord[]>();
  const callsiteCache = new WeakMap<object, readonly LazySourceCallsite[]>();
  const functionSummaryCache = new WeakMap<object, LazyFunctionSummary>();
  const returnFlowCache = new WeakMap<object, readonly LazyReturnFlowRecord[]>();

  return {
    declarationsOf(symbol) {
      return declarationsOf(symbol);
    },
    importsOf(symbol) {
      return importsOf(symbol);
    },
    exportsOf(symbol) {
      return exportsOf(symbol);
    },
    referencesOf(symbol) {
      return referencesOf(symbol);
    },
    usesOf(symbol) {
      return usesOf(symbol);
    },
    readsOf(symbol) {
      return usesOf(symbol).filter((use) => use.access === "read");
    },
    writesOf(symbol) {
      return usesOf(symbol).filter((use) => use.access === "write");
    },
    mutationsOf(symbol) {
      return usesOf(symbol).filter((use) => use.access === "write" || use.access === "delete");
    },
    propertyReadsOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "property" && use.access === "read");
    },
    propertyWritesOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "property" && use.access === "write");
    },
    propertyCallsOn(symbol) {
      return usesOf(symbol).filter((use) => use.kind === "property-call");
    },
    elementReadsOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "element" && use.access === "read");
    },
    elementWritesOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "element" && use.access === "write");
    },
    elementDeletesOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "element" && use.access === "delete");
    },
    callsitesOf(symbol) {
      return callsitesOf(symbol).filter((callsite) => callsite.kind === "call");
    },
    constructSitesOf(symbol) {
      return callsitesOf(symbol).filter((callsite) => callsite.kind === "construct");
    },
    argumentFlowOf(symbol) {
      return argumentFlowOf(symbol);
    },
    escapesOf(symbol) {
      return escapesOf(symbol);
    },
    capturesOf(symbol) {
      return capturesOf(symbol);
    },
    returnFlowOf(functionNode) {
      return returnFlowOf(functionNode);
    },
    summaryOf(functionNode) {
      return summaryOf(functionNode);
    },
  };

  function declarationsOf(symbol: Symbol | undefined): readonly LazySourceDeclarationRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = declarationCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const declarations = checker.getSymbolDeclarations(symbol)
      .filter((node): node is Node => node !== undefined)
      .map((node): LazySourceDeclarationRecord => ({
        symbol,
        sourceFile: ast.getSourceFile(node),
        node,
        occurrence: getDeclarationOccurrence(node),
        enclosingFunction: nearestFunctionLike(node),
        enclosingDeclaration: nearestDeclaration(node),
      }));
    declarationCache.set(symbol, declarations);
    return declarations;
  }

  function importsOf(symbol: Symbol | undefined): readonly LazySourceImportRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = importCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const imports: LazySourceImportRecord[] = [];
    for (const sourceFile of sourceFiles) {
      for (const statement of presentNodes(ast.statements(sourceFile))) {
        collectImportRecords(symbol, sourceFile, statement, imports);
      }
    }
    importCache.set(symbol, imports);
    return imports;
  }

  function exportsOf(symbol: Symbol | undefined): readonly LazySourceExportRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = exportCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const exportRecords: LazySourceExportRecord[] = [];
    for (const sourceFile of sourceFiles) {
      visitSourceNodes(sourceFile, (node) => {
        collectExportRecords(symbol, sourceFile, node, exportRecords);
      });
    }
    exportCache.set(symbol, exportRecords);
    return exportRecords;
  }

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

  function argumentFlowOf(symbol: Symbol | undefined): readonly TargetArgumentFlowRecord[] {
    if (symbol === undefined) {
      return [];
    }
    return usesOf(symbol)
      .filter((use): use is LazySourceUseRecord & { readonly argumentIndex: number; readonly call: Node } =>
        use.operation === "argument" && use.argumentIndex !== undefined && use.call !== undefined)
      .map((use) => ({
        symbol,
        sourceFile: use.sourceFile,
        argument: use.node,
        call: use.call,
        argumentIndex: use.argumentIndex,
        selectedSignatureDeclaration: use.selectedSignatureDeclaration,
      }));
  }

  function escapesOf(symbol: Symbol | undefined): readonly TargetSourceEscapeRecord[] {
    if (symbol === undefined) {
      return [];
    }
    return usesOf(symbol)
      .filter((use) =>
        use.operation === "return" ||
        use.operation === "argument" ||
        use.operation === "property" ||
        use.operation === "element" ||
        use.kind === "property-call")
      .map((use) => ({
        symbol,
        sourceFile: use.sourceFile,
        node: use.node,
        operation: use.operation,
        via: use.parent,
      }));
  }

  function capturesOf(symbol: Symbol | undefined): readonly TargetSourceCaptureRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const declarationFunction = nearestFunctionLike(primaryDeclaration(symbol));
    return referencesOf(symbol)
      .map((reference) => ({ reference, functionNode: nearestFunctionLike(reference.node) }))
      .filter((entry) => entry.functionNode !== undefined && entry.functionNode !== declarationFunction)
      .map((entry) => ({
        symbol,
        sourceFile: entry.reference.sourceFile,
        node: entry.reference.node,
        functionNode: entry.functionNode as Node,
      }));
  }

  function returnFlowOf(functionNode: Node): readonly LazyReturnFlowRecord[] {
    const cached = returnFlowCache.get(functionNode);
    if (cached !== undefined) {
      return cached;
    }
    const returnFlows: LazyReturnFlowRecord[] = [];
    const sourceFile = ast.getSourceFile(functionNode);
    visitSourceNodes(functionNode, (node) => {
      const returnStatement = asReturnStatement(node);
      if (returnStatement === undefined) {
        return;
      }
      returnFlows.push({
        sourceFile,
        functionNode,
        returnStatement: node,
        expression: returnStatement.Expression,
      });
    });
    returnFlowCache.set(functionNode, returnFlows);
    return returnFlows;
  }

  function summaryOf(functionNode: Node): LazyFunctionSummary {
    const cached = functionSummaryCache.get(functionNode);
    if (cached !== undefined) {
      return cached;
    }
    const sourceFile = ast.getSourceFile(functionNode);
    const references: LazySourceReferenceRecord[] = [];
    const calls: LazySourceCallsite[] = [];
    const constructs: LazySourceCallsite[] = [];
    visitSourceNodes(functionNode, (node) => {
      if (sourceFile !== undefined) {
        const referenceNode = getReferenceNode(node);
        if (referenceNode !== undefined) {
          const symbol = getSymbolForReference(referenceNode, sourceFile);
          if (symbol !== undefined) {
            references.push({
              symbol,
              resolvedSymbol: symbol,
              sourceFile,
              node: referenceNode,
              enclosingFunction: nearestFunctionLike(referenceNode),
              enclosingDeclaration: nearestDeclaration(referenceNode),
              occurrence: getReferenceOccurrence(referenceNode),
            });
          }
        }
      }
      if (sourceFile !== undefined && (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))) {
        const callee = getCallExpressionNode(node);
        const callsite = createCallsite(callee === undefined ? undefined : getSymbolForReference(callee, sourceFile), sourceFile, node, callee);
        if (callsite.kind === "construct") {
          constructs.push(callsite);
        } else {
          calls.push(callsite);
        }
      }
    });
    const returnFlows = returnFlowOf(functionNode);
    const summary = {
      functionNode,
      sourceFile,
      references,
      calls,
      constructs,
      returns: returnFlows.map((flow) => flow.returnStatement),
      returnFlows,
    };
    functionSummaryCache.set(functionNode, summary);
    return summary;
  }

  function collectImportRecords(
    symbol: Symbol,
    sourceFile: SourceFile,
    statement: Node,
    imports: LazySourceImportRecord[],
  ): void {
    const importDeclaration = asImportDeclaration(statement);
    if (importDeclaration === undefined || importDeclaration.ModuleSpecifier === undefined) {
      return;
    }
    const importClauseNode = importDeclaration.ImportClause;
    if (importClauseNode === undefined) {
      return;
    }
    const importClause = asImportClause(importClauseNode);
    if (importClause === undefined) {
      return;
    }
    const typeOnlyDeclaration = ast.isTypeOnlyImportDeclaration(statement);
    if (importClause.name !== undefined) {
      pushImportRecord(symbol, sourceFile, statement, importClause.name, importDeclaration.ModuleSpecifier, "default", "default", typeOnlyDeclaration, imports);
    }
    const namedBindings = importClause.NamedBindings;
    if (namedBindings === undefined) {
      return;
    }
    const namespaceImport = asNamespaceImport(namedBindings);
    if (namespaceImport !== undefined && namespaceImport.name !== undefined) {
      pushImportRecord(symbol, sourceFile, statement, namespaceImport.name, importDeclaration.ModuleSpecifier, "namespace", undefined, typeOnlyDeclaration, imports);
      return;
    }
    if (asNamedImports(namedBindings) === undefined) {
      return;
    }
    for (const specifier of presentNodes(ast.elements(namedBindings))) {
      const importSpecifier = asImportSpecifier(specifier);
      if (importSpecifier === undefined || importSpecifier.name === undefined) {
        continue;
      }
      pushImportRecord(
        symbol,
        sourceFile,
        statement,
        importSpecifier.name,
        importDeclaration.ModuleSpecifier,
        "named",
        textOf(importSpecifier.PropertyName ?? importSpecifier.name),
        typeOnlyDeclaration || importSpecifier.IsTypeOnly,
        imports,
      );
    }
  }

  function pushImportRecord(
    requestedSymbol: Symbol,
    sourceFile: SourceFile,
    declaration: Node,
    binding: Node,
    moduleSpecifier: Node,
    importKind: LazySourceImportRecord["importKind"],
    importedName: string | undefined,
    isTypeOnly: boolean,
    imports: LazySourceImportRecord[],
  ): void {
    const localSymbol = checker.getSymbolAtLocation(binding, { sourceFile });
    if (!symbolsMatch(localSymbol, requestedSymbol, sourceFile)) {
      return;
    }
    imports.push({
      symbol: requestedSymbol,
      importedSymbol: getAliasedSymbolIfAlias(checker, localSymbol, { sourceFile }),
      sourceFile,
      declaration,
      binding,
      moduleSpecifier,
      importKind,
      importedName,
      localName: textOf(binding),
      isTypeOnly,
    });
  }

  function collectExportRecords(
    symbol: Symbol,
    sourceFile: SourceFile,
    node: Node,
    exportRecords: LazySourceExportRecord[],
  ): void {
    const exportDeclaration = asExportDeclaration(node);
    if (exportDeclaration !== undefined) {
      collectNamedExportRecords(symbol, sourceFile, node, exportDeclaration, exportRecords);
      return;
    }
    const exportAssignment = asExportAssignment(node);
    if (exportAssignment !== undefined && !exportAssignment.IsExportEquals && exportAssignment.Expression !== undefined) {
      const exportedSymbol = getSymbolForReference(exportAssignment.Expression, sourceFile);
      if (symbolsMatch(exportedSymbol, symbol, sourceFile)) {
        exportRecords.push({
          symbol,
          exportedSymbol,
          sourceFile,
          declaration: node,
          node: exportAssignment.Expression,
          exportKind: "assignment",
          exportedName: "default",
          isTypeOnly: false,
        });
      }
      return;
    }
    const exportedDeclaration = getDirectExportDeclaration(node);
    if (exportedDeclaration === undefined) {
      return;
    }
    const name = ast.name(exportedDeclaration);
    if (name === undefined || !symbolsMatch(checker.getSymbolAtLocation(name, { sourceFile }), symbol, sourceFile)) {
      return;
    }
    exportRecords.push({
      symbol,
      exportedSymbol: checker.getSymbolAtLocation(name, { sourceFile }),
      sourceFile,
      declaration: exportedDeclaration,
      node: name,
      exportKind: ast.hasModifierKind(exportedDeclaration, "default") ? "default" : "local",
      exportedName: ast.hasModifierKind(exportedDeclaration, "default") ? "default" : textOf(name),
      localName: textOf(name),
      isTypeOnly: isTypeDeclaration(exportedDeclaration),
    });
  }

  function collectNamedExportRecords(
    symbol: Symbol,
    sourceFile: SourceFile,
    declaration: Node,
    exportDeclaration: NonNullable<ReturnType<AstReader["as"]["AsExportDeclaration"]>>,
    exportRecords: LazySourceExportRecord[],
  ): void {
    const exportClause = exportDeclaration.ExportClause;
    if (exportClause === undefined) {
      return;
    }
    const namedExports = asNamedExports(exportClause);
    if (namedExports === undefined) {
      return;
    }
    for (const specifier of presentNodes(ast.elements(exportClause))) {
      const exportSpecifier = asExportSpecifier(specifier);
      if (exportSpecifier === undefined || exportSpecifier.name === undefined) {
        continue;
      }
      const exportedSymbol = checker.getSymbolAtLocation(exportSpecifier.name, { sourceFile });
      if (!symbolsMatch(exportedSymbol, symbol, sourceFile)) {
        continue;
      }
      const localNode = exportSpecifier.PropertyName ?? exportSpecifier.name;
      exportRecords.push({
        symbol,
        exportedSymbol,
        sourceFile,
        declaration,
        node: exportSpecifier.name,
        exportKind: "named",
        exportedName: textOf(exportSpecifier.name),
        localName: textOf(localNode),
        moduleSpecifier: exportDeclaration.ModuleSpecifier,
        isTypeOnly: exportDeclaration.IsTypeOnly || exportSpecifier.IsTypeOnly,
      });
    }
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
      checker.getResolvedSymbolOrNil(propertyAccessNode, { sourceFile: reference.sourceFile });
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

  function collectDirectExportDeclaration(node: Node): Node | undefined {
    if (ast.hasModifierKind(node, "export")) {
      return node;
    }
    if (!ast.is.IsVariableDeclaration(node)) {
      return undefined;
    }
    const declarationList = ast.parent(node);
    const variableStatement = declarationList === undefined ? undefined : ast.parent(declarationList);
    return variableStatement !== undefined && ast.is.IsVariableStatement(variableStatement) && ast.hasModifierKind(variableStatement, "export")
      ? node
      : undefined;
  }

  function getDirectExportDeclaration(node: Node): Node | undefined {
    const declaration = collectDirectExportDeclaration(node);
    if (declaration === undefined) {
      return undefined;
    }
    return ast.is.IsFunctionDeclaration(declaration) ||
      ast.is.IsClassDeclaration(declaration) ||
      ast.is.IsInterfaceDeclaration(declaration) ||
      ast.is.IsTypeAliasDeclaration(declaration) ||
      ast.is.IsEnumDeclaration(declaration) ||
      ast.is.IsVariableDeclaration(declaration)
      ? declaration
      : undefined;
  }

  function isTypeDeclaration(node: Node): boolean {
    return ast.is.IsInterfaceDeclaration(node) || ast.is.IsTypeAliasDeclaration(node);
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

  function getDeclarationOccurrence(node: Node): LazySourceOccurrence {
    if (hasAncestor(node, (ancestor) => ast.is.IsImportDeclaration(ancestor) || ast.is.IsImportSpecifier(ancestor) || ast.is.IsImportClause(ancestor))) {
      return "import";
    }
    if (hasAncestor(node, (ancestor) => ast.is.IsExportDeclaration(ancestor) || ast.is.IsExportSpecifier(ancestor))) {
      return "export";
    }
    return isTypeDeclaration(node) ? "type" : "value";
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
    return checker.getSymbolAtLocation(node, { sourceFile }) ?? checker.getResolvedSymbolOrNil(node, { sourceFile });
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

  function asImportDeclaration(node: Node | undefined): ReturnType<AstReader["as"]["AsImportDeclaration"]> {
    return node !== undefined && ast.is.IsImportDeclaration(node) ? ast.as.AsImportDeclaration(node) : undefined;
  }

  function asImportClause(node: Node | undefined): ReturnType<AstReader["as"]["AsImportClause"]> {
    return node !== undefined && ast.is.IsImportClause(node) ? ast.as.AsImportClause(node) : undefined;
  }

  function asNamespaceImport(node: Node | undefined): ReturnType<AstReader["as"]["AsNamespaceImport"]> {
    return node !== undefined && ast.is.IsNamespaceImport(node) ? ast.as.AsNamespaceImport(node) : undefined;
  }

  function asNamedImports(node: Node | undefined): ReturnType<AstReader["as"]["AsNamedImports"]> {
    return node !== undefined && ast.is.IsNamedImports(node) ? ast.as.AsNamedImports(node) : undefined;
  }

  function asImportSpecifier(node: Node | undefined): ReturnType<AstReader["as"]["AsImportSpecifier"]> {
    return node !== undefined && ast.is.IsImportSpecifier(node) ? ast.as.AsImportSpecifier(node) : undefined;
  }

  function asExportDeclaration(node: Node | undefined): ReturnType<AstReader["as"]["AsExportDeclaration"]> {
    return node !== undefined && ast.is.IsExportDeclaration(node) ? ast.as.AsExportDeclaration(node) : undefined;
  }

  function asExportAssignment(node: Node | undefined): ReturnType<AstReader["as"]["AsExportAssignment"]> {
    return node !== undefined && ast.is.IsExportAssignment(node) ? ast.as.AsExportAssignment(node) : undefined;
  }

  function asNamedExports(node: Node | undefined): ReturnType<AstReader["as"]["AsNamedExports"]> {
    return node !== undefined && ast.is.IsNamedExports(node) ? ast.as.AsNamedExports(node) : undefined;
  }

  function asExportSpecifier(node: Node | undefined): ReturnType<AstReader["as"]["AsExportSpecifier"]> {
    return node !== undefined && ast.is.IsExportSpecifier(node) ? ast.as.AsExportSpecifier(node) : undefined;
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
