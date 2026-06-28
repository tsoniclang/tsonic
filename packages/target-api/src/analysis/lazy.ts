import type {
  AstReader,
  Node,
  SourceFile,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import {
  getAnalysisBinaryOperatorText,
  isAnalysisWriteOperator,
} from "./operator.js";
import {
  asAnalysisNode,
  getAnalysisNodeField,
  getAnalysisNodeList,
  visitAnalysisNodes,
} from "./node-access.js";
import type {
  TargetArgumentFlowRecord,
  TargetFunctionSummary,
  TargetLazySourceAnalysis,
  TargetReturnFlowRecord,
  TargetSourceCallsite,
  TargetSourceCaptureRecord,
  TargetSourceDeclarationRecord,
  TargetSourceExportRecord,
  TargetSourceImportRecord,
  TargetSourceReferenceRecord,
  TargetSourceUseRecord,
} from "./types.js";

export function createLazyTargetSourceAnalysis(
  ast: AstReader,
  checker: TypeCheckerQueries,
  sourceFiles: readonly SourceFile[],
): TargetLazySourceAnalysis {
  const declarationsCache = new WeakMap<object, readonly TargetSourceDeclarationRecord[]>();
  const referencesCache = new WeakMap<object, readonly TargetSourceReferenceRecord[]>();
  const usesCache = new WeakMap<object, readonly TargetSourceUseRecord[]>();
  const callsitesCache = new WeakMap<object, readonly TargetSourceCallsite[]>();
  const constructSitesCache = new WeakMap<object, readonly TargetSourceCallsite[]>();
  const functionSummaryCache = new WeakMap<object, TargetFunctionSummary>();

  return {
    referencesOf(symbol) {
      return referencesOf(symbol);
    },
    declarationsOf(symbol) {
      return declarationsOf(symbol);
    },
    importsOf(symbol) {
      return importsOf(symbol);
    },
    exportsOf(symbol) {
      return exportsOf(symbol);
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
    elementReadsOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "element" && use.access === "read");
    },
    elementWritesOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "element" && use.access === "write");
    },
    callsitesOf(symbol) {
      return callsitesOf(symbol);
    },
    constructSitesOf(symbol) {
      return constructSitesOf(symbol);
    },
    argumentFlowOf(symbol) {
      return argumentFlowOf(symbol);
    },
    returnFlowOf(symbol) {
      return returnFlowOf(symbol);
    },
    escapesOf(symbol) {
      if (symbol === undefined) {
        return [];
      }
      return usesOf(symbol)
        .filter((use) => use.operation === "return" || use.operation === "argument" || use.operation === "property")
        .map((use) => ({
          symbol,
          sourceFile: use.sourceFile,
          node: use.node,
          operation: use.operation,
          via: use.parent,
        }));
    },
    capturesOf(symbol) {
      return capturesOf(symbol);
    },
    summaryOf(functionNode) {
      return summaryOf(functionNode);
    },
  };

  function declarationsOf(symbol: Symbol | undefined): readonly TargetSourceDeclarationRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = declarationsCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const declarations = checker.getSymbolDeclarations(symbol)
      .flatMap((declaration) => {
        if (declaration === undefined) {
          return [];
        }
        const sourceFile = ast.getSourceFile(declaration);
        return sourceFile === undefined
          ? []
          : [{ symbol, sourceFile, declaration, name: safeName(declaration) }];
      });
    declarationsCache.set(symbol, declarations);
    return declarations;
  }

  function referencesOf(symbol: Symbol | undefined): readonly TargetSourceReferenceRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = referencesCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const references: TargetSourceReferenceRecord[] = [];
    for (const sourceFile of sourceFiles) {
      if (sourceFile === undefined) {
        continue;
      }
      visitAnalysisNodes(ast, sourceFile, (node) => {
        if (!ast.is.IsIdentifier(node)) {
          return;
        }
        const referenced = getSymbolForReference(node, sourceFile);
        if (referenced === symbol) {
          references.push({ symbol, sourceFile, node });
        }
      });
    }
    referencesCache.set(symbol, references);
    return references;
  }

  function usesOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = usesCache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const uses = referencesOf(symbol).map((reference) => classifyReferenceUse(reference));
    usesCache.set(symbol, uses);
    return uses;
  }

  function importsOf(symbol: Symbol | undefined): readonly TargetSourceImportRecord[] {
    if (symbol === undefined) {
      return [];
    }
    return declarationsOf(symbol)
      .map((declaration) => importRecordForDeclaration(declaration))
      .filter((record): record is TargetSourceImportRecord => record !== undefined);
  }

  function exportsOf(symbol: Symbol | undefined): readonly TargetSourceExportRecord[] {
    if (symbol === undefined) {
      return [];
    }
    const exports: TargetSourceExportRecord[] = [];
    const seen = new Set<string>();
    for (const declaration of declarationsOf(symbol)) {
      const exportNode = exportedDeclarationAncestor(declaration.declaration);
      if (exportNode === undefined) {
        continue;
      }
      pushExportRecord(exports, seen, {
        symbol,
        sourceFile: declaration.sourceFile,
        exportNode,
        node: declaration.declaration,
        name: declaration.name,
        moduleSpecifier: getModuleSpecifier(exportNode),
        exportKind: safeHasModifierKind(exportNode, "default") ? "default" : "declaration",
        isTypeOnly: safeIsTypeOnlyImportOrExportDeclaration(exportNode),
      });
    }
    for (const reference of referencesOf(symbol)) {
      const exportNode = nearestExportDeclaration(reference.node);
      if (exportNode === undefined) {
        continue;
      }
      pushExportRecord(exports, seen, {
        symbol,
        sourceFile: reference.sourceFile,
        exportNode,
        node: reference.node,
        name: reference.node,
        moduleSpecifier: getModuleSpecifier(exportNode),
        exportKind: "named",
        isTypeOnly: safeIsTypeOnlyImportOrExportDeclaration(exportNode) || hasTypeOnlyAncestor(reference.node, exportNode),
      });
    }
    return exports;
  }

  function callsitesOf(symbol: Symbol | undefined): readonly TargetSourceCallsite[] {
    return callSitesOfKind(symbol, "call", callsitesCache);
  }

  function constructSitesOf(symbol: Symbol | undefined): readonly TargetSourceCallsite[] {
    return callSitesOfKind(symbol, "construct", constructSitesCache);
  }

  function callSitesOfKind(
    symbol: Symbol | undefined,
    kind: "call" | "construct",
    cache: WeakMap<object, readonly TargetSourceCallsite[]>,
  ): readonly TargetSourceCallsite[] {
    if (symbol === undefined) {
      return [];
    }
    const cached = cache.get(symbol);
    if (cached !== undefined) {
      return cached;
    }
    const callsites: TargetSourceCallsite[] = [];
    for (const sourceFile of sourceFiles) {
      if (sourceFile === undefined) {
        continue;
      }
      visitAnalysisNodes(ast, sourceFile, (node) => {
        if (callExpressionKind(node) !== kind) {
          return;
        }
        const callee = asAnalysisNode(getAnalysisNodeField(node, "Expression"));
        if (callee === undefined) {
          return;
        }
        const calleeSymbol = getSymbolForReference(callee, sourceFile);
        if (calleeSymbol !== symbol) {
          return;
        }
        callsites.push({
          kind,
          symbol,
          sourceFile,
          call: node,
          callee,
          selectedSignatureDeclaration: getSelectedSignatureDeclaration(node, sourceFile),
        });
      });
    }
    cache.set(symbol, callsites);
    return callsites;
  }

  function argumentFlowOf(symbol: Symbol | undefined): readonly TargetArgumentFlowRecord[] {
    if (symbol === undefined) {
      return [];
    }
    return usesOf(symbol)
      .filter((use): use is TargetSourceUseRecord & { readonly argumentIndex: number; readonly call: Node } =>
        use.operation === "argument" && use.argumentIndex !== undefined && use.call !== undefined)
      .map((use) => ({
        symbol,
        sourceFile: use.sourceFile,
        argument: use.node,
        call: use.call,
        argumentIndex: use.argumentIndex,
        selectedSignatureDeclaration: getSelectedSignatureDeclaration(use.call, use.sourceFile),
      }));
  }

  function returnFlowOf(symbol: Symbol | undefined): readonly TargetReturnFlowRecord[] {
    if (symbol === undefined) {
      return [];
    }
    return usesOf(symbol)
      .filter((use): use is TargetSourceUseRecord & { readonly parent: Node } =>
        use.operation === "return" && use.parent !== undefined)
      .map((use) => ({
        symbol,
        sourceFile: use.sourceFile,
        value: use.node,
        returnStatement: use.parent,
        functionNode: nearestFunctionLike(use.parent),
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

  function summaryOf(functionNode: Node): TargetFunctionSummary {
    const cached = functionSummaryCache.get(functionNode);
    if (cached !== undefined) {
      return cached;
    }
    const references: TargetSourceReferenceRecord[] = [];
    const calls: TargetSourceCallsite[] = [];
    const constructs: TargetSourceCallsite[] = [];
    const returns: Node[] = [];
    const sourceFile = ast.getSourceFile(functionNode);
    if (sourceFile === undefined) {
      const summary = {
        functionNode,
        references,
        calls,
        constructs,
        returns,
      };
      functionSummaryCache.set(functionNode, summary);
      return summary;
    }
    visitAnalysisNodes(ast, functionNode, (node) => {
      if (ast.is.IsIdentifier(node)) {
        const symbol = getSymbolForReference(node, sourceFile);
        if (symbol !== undefined) {
          references.push({ symbol, sourceFile, node });
        }
      }
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
        const kind = callExpressionKind(node);
        if (kind === undefined) {
          return;
        }
        const callee = asAnalysisNode(getAnalysisNodeField(node, "Expression"));
        const symbol = callee === undefined ? undefined : getSymbolForReference(callee, sourceFile);
        const callsite = {
          kind,
          symbol,
          sourceFile,
          call: node,
          callee,
          selectedSignatureDeclaration: getSelectedSignatureDeclaration(node, sourceFile),
        };
        if (kind === "construct") {
          constructs.push(callsite);
        } else {
          calls.push(callsite);
        }
      }
      if (ast.kindName(node) === "KindReturnStatement") {
        returns.push(node);
      }
    });
    const summary = {
      functionNode,
      sourceFile,
      references,
      calls,
      constructs,
      returns,
    };
    functionSummaryCache.set(functionNode, summary);
    return summary;
  }

  function classifyReferenceUse(reference: TargetSourceReferenceRecord): TargetSourceUseRecord {
    const node = reference.node;
    const sourceFile = reference.sourceFile;
    const parent = ast.parent(node);
    if (parent !== undefined && ast.is.IsElementAccessExpression(parent) && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      return {
        ...reference,
        operation: "element",
        access: isDeleteOperand(parent) ? "delete" : parentIsWriteTarget(parent) ? "write" : "read",
        parent,
        expression: parent,
      };
    }
    const directCall = parentCallOrConstruct(node);
    if (parent !== undefined && directCall !== undefined) {
      return {
        ...reference,
        operation: directCall.kind,
        access: "read",
        parent,
        expression: parent,
        call: directCall.node,
        selectedDeclaration: getSelectedSignatureDeclaration(directCall.node, sourceFile),
      };
    }
    if (parent !== undefined && ast.is.IsPropertyAccessExpression(parent) && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      const propertyNameNode = ast.name(parent);
      const call = parentCallOrConstruct(parent);
      const propertySymbol = checker.getSymbolAtLocation(parent, { sourceFile }) ?? safeGetResolvedSymbol(parent, sourceFile);
      return {
        ...reference,
        operation: call === undefined ? "property" : call.kind,
        access: isDeleteOperand(parent) ? "delete" : parentIsWriteTarget(parent) ? "write" : "read",
        parent,
        expression: parent,
        propertyName: ast.text(propertyNameNode),
        propertySymbol,
        selectedDeclaration: primaryDeclaration(propertySymbol),
        call: call?.node,
      };
    }
    if (parent !== undefined && ast.is.IsCallExpression(parent) && getAnalysisNodeList(getAnalysisNodeField(parent, "Arguments")).includes(node)) {
      return {
        ...reference,
        operation: "argument",
        access: "read",
        parent,
        expression: node,
        call: parent,
        argumentIndex: getAnalysisNodeList(getAnalysisNodeField(parent, "Arguments")).indexOf(node),
        selectedDeclaration: getSelectedSignatureDeclaration(parent, sourceFile),
      };
    }
    if (parent !== undefined && ast.is.IsBinaryExpression(parent) && asAnalysisNode(getAnalysisNodeField(parent, "Right")) === node && getAnalysisBinaryOperatorText(ast, parent) === "in") {
      return {
        ...reference,
        operation: "operator",
        access: "read",
        parent,
        expression: parent,
        operator: "in",
      };
    }
    if (parent !== undefined && initializerIsDestructured(node, parent)) {
      return {
        ...reference,
        operation: "destructure",
        access: "read",
        parent,
        expression: node,
      };
    }
    if (parent !== undefined && destructuringAssignmentRightHandSide(node, parent)) {
      return {
        ...reference,
        operation: "destructure",
        access: "read",
        parent,
        expression: parent,
        operator: getAnalysisBinaryOperatorText(ast, parent),
      };
    }
    if (parent !== undefined && (ast.is.IsForOfStatement(parent) || ast.is.IsForInStatement(parent)) && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      return {
        ...reference,
        operation: "iteration",
        access: "read",
        parent,
        expression: parent,
        iterationKind: ast.is.IsForInStatement(parent) ? "for-in" : "for-of",
      };
    }
    if (parent !== undefined && (ast.kindName(parent) === "KindSpreadElement" || ast.kindName(parent) === "KindSpreadAssignment") && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      return {
        ...reference,
        operation: "spread",
        access: "read",
        parent,
        expression: parent,
      };
    }
    if (parent !== undefined && ast.kindName(parent) === "KindAwaitExpression" && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      return {
        ...reference,
        operation: "await",
        access: "read",
        parent,
        expression: parent,
      };
    }
    if (parent !== undefined && ast.kindName(parent) === "KindYieldExpression" && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      return {
        ...reference,
        operation: "yield",
        access: "read",
        parent,
        expression: parent,
      };
    }
    if (parent !== undefined && ast.kindName(parent) === "KindReturnStatement") {
      return {
        ...reference,
        operation: "return",
        access: "read",
        parent,
        expression: parent,
      };
    }
    if (parent !== undefined && parentIsWriteTarget(node)) {
      return {
        ...reference,
        operation: "reference",
        access: "write",
        parent,
        expression: node,
      };
    }
    return {
      ...reference,
      operation: "reference",
      access: "read",
      parent,
      expression: node,
    };
  }

  function getSymbolForReference(node: Node, sourceFile: SourceFile): Symbol | undefined {
    return checker.getSymbolAtLocation(node, { sourceFile }) ?? safeGetResolvedSymbol(node, sourceFile);
  }

  function safeGetResolvedSymbol(node: Node, sourceFile: SourceFile): Symbol | undefined {
    try {
      return checker.getResolvedSymbol(node, { sourceFile });
    } catch {
      return undefined;
    }
  }

  function getSelectedSignatureDeclaration(node: Node, sourceFile: SourceFile): Node | undefined {
    const signature = checker.getResolvedSignature(node, { sourceFile });
    return asAnalysisNode(checker.getSignatureDeclaration(signature));
  }

  function primaryDeclaration(symbol: Symbol | undefined): Node | undefined {
    return checker.getSymbolDeclarations(symbol).find((declaration): declaration is Node => declaration !== undefined);
  }

  function parentCallOrConstruct(node: Node): { readonly kind: "call" | "construct"; readonly node: Node } | undefined {
    const parent = ast.parent(node);
    if (parent === undefined || asAnalysisNode(getAnalysisNodeField(parent, "Expression")) !== node) {
      return undefined;
    }
    const kind = callExpressionKind(parent);
    return kind === undefined ? undefined : { kind, node: parent };
  }

  function callExpressionKind(node: Node): "call" | "construct" | undefined {
    if (ast.is.IsCallExpression(node)) {
      return "call";
    }
    if (ast.is.IsNewExpression(node)) {
      return "construct";
    }
    return undefined;
  }

  function parentIsWriteTarget(node: Node): boolean {
    const parent = ast.parent(node);
    if (parent === undefined) {
      return false;
    }
    if (ast.is.IsBinaryExpression(parent) && asAnalysisNode(getAnalysisNodeField(parent, "Left")) === node) {
      return isAnalysisWriteOperator(getAnalysisBinaryOperatorText(ast, parent));
    }
    return (ast.is.IsPrefixUnaryExpression(parent) || ast.is.IsPostfixUnaryExpression(parent)) &&
      asAnalysisNode(getAnalysisNodeField(parent, "Operand")) === node;
  }

  function isDeleteOperand(node: Node): boolean {
    const parent = ast.parent(node);
    return parent !== undefined &&
      ast.kindName(parent) === "KindDeleteExpression" &&
      asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node;
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

  function isFunctionLike(node: Node): boolean {
    return ast.kindName(node) === "KindFunctionDeclaration" ||
      ast.kindName(node) === "KindMethodDeclaration" ||
      ast.kindName(node) === "KindArrowFunction" ||
      ast.kindName(node) === "KindFunctionExpression" ||
      ast.kindName(node) === "KindConstructor";
  }

  function initializerIsDestructured(node: Node, parent: Node): boolean {
    if (asAnalysisNode(getAnalysisNodeField(parent, "Initializer")) !== node) {
      return false;
    }
    return isDestructuringPattern(asAnalysisNode(getAnalysisNodeField(parent, "name")));
  }

  function destructuringAssignmentRightHandSide(node: Node, parent: Node): boolean {
    if (!ast.is.IsBinaryExpression(parent) || asAnalysisNode(getAnalysisNodeField(parent, "Right")) !== node) {
      return false;
    }
    return isAnalysisWriteOperator(getAnalysisBinaryOperatorText(ast, parent)) &&
      isDestructuringAssignmentTarget(asAnalysisNode(getAnalysisNodeField(parent, "Left")));
  }

  function isDestructuringAssignmentTarget(node: Node | undefined): boolean {
    if (node === undefined) {
      return false;
    }
    const kind = ast.kindName(node);
    return kind === "KindObjectLiteralExpression" ||
      kind === "KindArrayLiteralExpression" ||
      isDestructuringPattern(node);
  }

  function isDestructuringPattern(node: Node | undefined): boolean {
    if (node === undefined) {
      return false;
    }
    const kind = ast.kindName(node);
    return kind === "KindObjectBindingPattern" || kind === "KindArrayBindingPattern";
  }

  function importRecordForDeclaration(declaration: TargetSourceDeclarationRecord): TargetSourceImportRecord | undefined {
    const importDeclaration = nearestAncestorMatching(declaration.declaration, (node) => ast.is.IsImportDeclaration(node));
    if (importDeclaration === undefined) {
      return undefined;
    }
    return {
      ...declaration,
      importDeclaration,
      moduleSpecifier: getModuleSpecifier(importDeclaration),
      importKind: importKindOf(declaration.declaration, importDeclaration),
      isTypeOnly: safeIsTypeOnlyImportDeclaration(importDeclaration) || hasTypeOnlyAncestor(declaration.declaration, importDeclaration),
    };
  }

  function importKindOf(declaration: Node, importDeclaration: Node): "default" | "named" | "namespace" {
    if (hasAncestorMatching(declaration, importDeclaration, (node) => ast.is.IsNamespaceImport(node))) {
      return "namespace";
    }
    if (hasAncestorMatching(declaration, importDeclaration, (node) => ast.is.IsImportSpecifier(node))) {
      return "named";
    }
    return "default";
  }

  function exportedDeclarationAncestor(declaration: Node): Node | undefined {
    let current: Node | undefined = declaration;
    while (current !== undefined) {
      if (safeHasModifierKind(current, "export") || safeHasModifierKind(current, "default")) {
        return current;
      }
      current = ast.parent(current);
    }
    return undefined;
  }

  function nearestExportDeclaration(node: Node): Node | undefined {
    return nearestAncestorMatching(node, (candidate) => ast.is.IsExportDeclaration(candidate));
  }

  function nearestAncestorMatching(node: Node, predicate: (node: Node) => boolean): Node | undefined {
    let current: Node | undefined = node;
    while (current !== undefined) {
      if (predicate(current)) {
        return current;
      }
      current = ast.parent(current);
    }
    return undefined;
  }

  function hasAncestorMatching(node: Node, stopAt: Node, predicate: (node: Node) => boolean): boolean {
    let current: Node | undefined = node;
    while (current !== undefined) {
      if (predicate(current)) {
        return true;
      }
      if (current === stopAt) {
        return false;
      }
      current = ast.parent(current);
    }
    return false;
  }

  function hasTypeOnlyAncestor(node: Node, stopAt: Node): boolean {
    return hasAncestorMatching(node, stopAt, (candidate) =>
      safeIsTypeOnlyImportOrExportDeclaration(candidate) ||
      (candidate as { readonly IsTypeOnly?: boolean }).IsTypeOnly === true);
  }

  function getModuleSpecifier(node: Node): Node | undefined {
    return asAnalysisNode(getAnalysisNodeField(node, "ModuleSpecifier"));
  }

  function pushExportRecord(
    exports: TargetSourceExportRecord[],
    seen: Set<string>,
    record: TargetSourceExportRecord,
  ): void {
    const key = `${ast.getFileName(record.sourceFile)}:${ast.pos(record.exportNode)}:${ast.pos(record.node)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    exports.push(record);
  }

  function safeName(node: Node): Node | undefined {
    try {
      return asAnalysisNode(ast.name(node));
    } catch {
      return undefined;
    }
  }

  function safeHasModifierKind(node: Node, kind: "export" | "default"): boolean {
    try {
      return ast.hasModifierKind(node, kind);
    } catch {
      return false;
    }
  }

  function safeIsTypeOnlyImportDeclaration(node: Node): boolean {
    try {
      return ast.isTypeOnlyImportDeclaration(node);
    } catch {
      return false;
    }
  }

  function safeIsTypeOnlyImportOrExportDeclaration(node: Node): boolean {
    try {
      return ast.isTypeOnlyImportOrExportDeclaration(node);
    } catch {
      return false;
    }
  }
}
