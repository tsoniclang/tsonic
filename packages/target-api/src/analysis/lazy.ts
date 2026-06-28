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
  TargetFunctionSummary,
  TargetLazySourceAnalysis,
  TargetSourceCallsite,
  TargetSourceCaptureRecord,
  TargetSourceReferenceRecord,
  TargetSourceUseRecord,
} from "./types.js";

export function createLazyTargetSourceAnalysis(
  ast: AstReader,
  checker: TypeCheckerQueries,
  sourceFiles: readonly SourceFile[],
): TargetLazySourceAnalysis {
  const referencesCache = new WeakMap<object, readonly TargetSourceReferenceRecord[]>();
  const usesCache = new WeakMap<object, readonly TargetSourceUseRecord[]>();
  const functionSummaryCache = new WeakMap<object, TargetFunctionSummary>();

  return {
    referencesOf(symbol) {
      return referencesOf(symbol);
    },
    usesOf(symbol) {
      return usesOf(symbol);
    },
    mutationsOf(symbol) {
      return usesOf(symbol).filter((use) => use.access === "write" || use.access === "delete");
    },
    propertyWritesOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "property" && use.access === "write");
    },
    elementWritesOn(symbol) {
      return usesOf(symbol).filter((use) => use.operation === "element" && use.access === "write");
    },
    callsitesOf(symbol) {
      return callsitesOf(symbol);
    },
    argumentFlowOf(symbol) {
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

  function callsitesOf(symbol: Symbol | undefined): readonly TargetSourceCallsite[] {
    if (symbol === undefined) {
      return [];
    }
    const callsites: TargetSourceCallsite[] = [];
    for (const sourceFile of sourceFiles) {
      if (sourceFile === undefined) {
        continue;
      }
      visitAnalysisNodes(ast, sourceFile, (node) => {
        if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node)) {
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
          symbol,
          sourceFile,
          call: node,
          callee,
          selectedSignatureDeclaration: getSelectedSignatureDeclaration(node, sourceFile),
        });
      });
    }
    return callsites;
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
    const returns: Node[] = [];
    const sourceFile = ast.getSourceFile(functionNode);
    if (sourceFile === undefined) {
      const summary = {
        functionNode,
        references,
        calls,
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
        const callee = asAnalysisNode(getAnalysisNodeField(node, "Expression"));
        const symbol = callee === undefined ? undefined : getSymbolForReference(callee, sourceFile);
        calls.push({
          symbol,
          sourceFile,
          call: node,
          callee,
          selectedSignatureDeclaration: getSelectedSignatureDeclaration(node, sourceFile),
        });
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
    if (parent !== undefined && ast.is.IsPropertyAccessExpression(parent) && asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node) {
      const propertyNameNode = ast.name(parent);
      const call = parentIsCallCallee(parent);
      const propertySymbol = checker.getSymbolAtLocation(parent, { sourceFile }) ?? safeGetResolvedSymbol(parent, sourceFile);
      return {
        ...reference,
        operation: call === undefined ? "property" : "call",
        access: isDeleteOperand(parent) ? "delete" : parentIsWriteTarget(parent) ? "write" : "read",
        parent,
        expression: parent,
        propertyName: ast.text(propertyNameNode),
        propertySymbol,
        selectedDeclaration: primaryDeclaration(propertySymbol),
        call,
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
    return asAnalysisNode((signature as { readonly declaration?: unknown } | undefined)?.declaration);
  }

  function parentIsCallCallee(node: Node): Node | undefined {
    const parent = ast.parent(node);
    return parent !== undefined &&
      (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
      asAnalysisNode(getAnalysisNodeField(parent, "Expression")) === node
      ? parent
      : undefined;
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
}

function primaryDeclaration(symbol: Symbol | undefined): Node | undefined {
  return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((declaration): declaration is Node => declaration !== undefined);
}
