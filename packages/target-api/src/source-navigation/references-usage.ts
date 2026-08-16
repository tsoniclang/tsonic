import type {
  AstReader,
  CheckedSourceProgram,
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";
import type {
  SourceDeclarationReference,
  SourceBindingWrite,
} from "./types.js";
import {
  aliasedSymbol,
  referenceQueryNode,
  symbolAtReferenceNode,
} from "./syntax.js";
import {
  sourceNodesEqual,
  sourceNodeIdentity,
  sourceSymbolsEqual,
} from "./identity.js";

const noSourceReferences: readonly Node[] = Object.freeze([]);

const assignmentOperatorKinds = new Set([
  "KindEqualsToken",
  "KindPlusEqualsToken",
  "KindMinusEqualsToken",
  "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken",
  "KindSlashEqualsToken",
  "KindPercentEqualsToken",
  "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken",
  "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken",
  "KindBarEqualsToken",
  "KindCaretEqualsToken",
  "KindBarBarEqualsToken",
  "KindAmpersandAmpersandEqualsToken",
  "KindQuestionQuestionEqualsToken",
]);

const updateOperatorKinds = new Set([
  "KindPlusPlusToken",
  "KindMinusMinusToken",
]);

export function sourceBindingWritesWithin(
  source: CheckedSourceProgram,
  symbol: Symbol,
  root: Node,
  sourceReferenceFor: (
    node: Node | undefined,
  ) => SourceDeclarationReference | undefined,
): readonly SourceBindingWrite[] {
  const writes = sourceSymbolReferencesWithin(
    source,
    symbol,
    root,
    sourceReferenceFor,
  )
    .map((reference) => bindingWriteAtReference(source.ast, reference))
    .filter((write): write is SourceBindingWrite => write !== undefined);
  return Object.freeze(writes);
}

export function sourceSymbolReferencesWithin(
  source: CheckedSourceProgram,
  symbol: Symbol,
  root: Node,
  sourceReferenceFor: (
    node: Node | undefined,
  ) => SourceDeclarationReference | undefined,
): readonly Node[] {
  const sourceFile = source.ast.getSourceFile(root);
  if (sourceFile === undefined) {
    return Object.freeze([]);
  }
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const references: Node[] = [];
  const visit = (node: Node | undefined): void => {
    if (node === undefined) {
      return;
    }
    const queryNode = referenceQueryNode(source.ast, node);
    const selected = queryNode !== undefined &&
        sourceNodesEqual(source.ast, queryNode, node)
      ? sourceReferenceFor(node)
      : undefined;
    if (
      selected !== undefined &&
      sourceSymbolsEqual(source.ast, checker, selected.symbol, symbol) &&
      !sourceNodesEqual(source.ast, source.ast.name(selected.declaration), node)
    ) {
      references.push(node);
    }
    source.ast.forEachChild(node, visit);
  };
  visit(root);
  return Object.freeze(references);
}

export function createSourceDeclarationReferenceIndex(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
  sourceReferenceFor: (
    node: Node | undefined,
  ) => SourceDeclarationReference | undefined,
): {
  referencesToDeclaration(declaration: Node): readonly Node[];
} {
  let referencesByDeclaration: ReadonlyMap<string, readonly Node[]> | undefined;

  const build = (): ReadonlyMap<string, readonly Node[]> => {
    const pending = new Map<string, Node[]>();
    const visit = (node: Node | undefined): void => {
      if (node === undefined) {
        return;
      }
      const queryNode = referenceQueryNode(source.ast, node);
      if (queryNode !== undefined && sourceNodesEqual(source.ast, queryNode, node)) {
        const selected = sourceReferenceFor(node);
        const declaration = selected?.declaration;
        const declarationIdentity = sourceNodeIdentity(source.ast, declaration);
        if (
          declaration !== undefined &&
          declarationIdentity !== undefined &&
          !sourceNodesEqual(source.ast, source.ast.name(declaration), node)
        ) {
          const references = pending.get(declarationIdentity) ?? [];
          references.push(node);
          pending.set(declarationIdentity, references);
        }
      }
      source.ast.forEachChild(node, visit);
    };
    for (const sourceFile of sourceFiles) {
      visit(sourceFile);
    }
    return new Map(
      [...pending.entries()].map(([identity, references]) => [
        identity,
        Object.freeze(references),
      ]),
    );
  };

  return Object.freeze({
    referencesToDeclaration(declaration: Node): readonly Node[] {
      referencesByDeclaration ??= build();
      const identity = sourceNodeIdentity(source.ast, declaration);
      return identity === undefined
        ? noSourceReferences
        : referencesByDeclaration.get(identity) ?? noSourceReferences;
    },
  });
}

export function sourceSymbolHasReferenceOutside(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
  symbol: Symbol,
  excludedNode: Node,
): boolean {
  let found = false;
  const excludedIdentity = sourceNodeIdentity(source.ast, excludedNode);
  const visit = (node: Node | undefined): void => {
    if (node === undefined || found) {
      return;
    }
    if (sourceNodeIdentity(source.ast, node) === excludedIdentity) {
      return;
    }
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile !== undefined) {
      const checker = source.getSourceFileQueries(sourceFile).checker;
      const direct = symbolAtReferenceNode(
        source.ast,
        checker,
        node,
      );
      if (
        sourceSymbolsEqual(source.ast, checker, direct, symbol) ||
        sourceSymbolsEqual(
          source.ast,
          checker,
          aliasedSymbol(source.ast, checker, direct),
          symbol,
        )
      ) {
        found = true;
        return;
      }
    }
    source.ast.forEachChild(node, visit);
  };
  for (const sourceFile of sourceFiles) {
    visit(sourceFile);
    if (found) {
      return true;
    }
  }
  return false;
}

function bindingWriteAtReference(
  ast: AstReader,
  reference: Node,
): SourceBindingWrite | undefined {
  let current = reference;
  for (;;) {
    const parent = ast.parent(current);
    if (parent === undefined) {
      return undefined;
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      if (
        sourceNodesEqual(ast, binary?.Left, current) &&
        assignmentOperatorKinds.has(ast.operatorKindName(parent) ?? "")
      ) {
        return bindingWrite(reference, parent, "assignment");
      }
      return undefined;
    }
    if (ast.is.IsPrefixUnaryExpression(parent)) {
      const unary = ast.as.AsPrefixUnaryExpression(parent);
      return sourceNodesEqual(ast, unary?.Operand, current) &&
        updateOperatorKinds.has(ast.operatorKindName(parent) ?? "")
        ? bindingWrite(reference, parent, "update")
        : undefined;
    }
    if (ast.is.IsPostfixUnaryExpression(parent)) {
      const unary = ast.as.AsPostfixUnaryExpression(parent);
      return sourceNodesEqual(ast, unary?.Operand, current) &&
        updateOperatorKinds.has(ast.operatorKindName(parent) ?? "")
        ? bindingWrite(reference, parent, "update")
        : undefined;
    }
    if (ast.is.IsForInStatement(parent) || ast.is.IsForOfStatement(parent)) {
      const statement = ast.as.AsForInOrOfStatement(parent);
      return sourceNodesEqual(ast, statement?.Initializer, current)
        ? bindingWrite(reference, parent, "iteration")
        : undefined;
    }
    if (!isTransparentAssignmentTargetContainer(ast, parent, current)) {
      return undefined;
    }
    current = parent;
  }
}

function bindingWrite(
  reference: Node,
  operation: Node,
  kind: SourceBindingWrite["kind"],
): SourceBindingWrite {
  return Object.freeze({ reference, operation, kind });
}

function isTransparentAssignmentTargetContainer(
  ast: AstReader,
  parent: Node,
  child: Node,
): boolean {
  if (ast.is.IsParenthesizedExpression(parent)) {
    return sourceNodesEqual(ast, ast.as.AsParenthesizedExpression(parent)?.Expression, child);
  }
  if (ast.is.IsAsExpression(parent)) {
    return sourceNodesEqual(ast, ast.as.AsAsExpression(parent)?.Expression, child);
  }
  if (ast.is.IsTypeAssertion(parent)) {
    return sourceNodesEqual(ast, ast.as.AsTypeAssertion(parent)?.Expression, child);
  }
  if (ast.is.IsNonNullExpression(parent)) {
    return sourceNodesEqual(ast, ast.as.AsNonNullExpression(parent)?.Expression, child);
  }
  if (ast.is.IsSatisfiesExpression(parent)) {
    return sourceNodesEqual(ast, ast.as.AsSatisfiesExpression(parent)?.Expression, child);
  }
  if (ast.is.IsSpreadElement(parent)) {
    return sourceNodesEqual(ast, ast.as.AsSpreadElement(parent)?.Expression, child);
  }
  if (ast.is.IsSpreadAssignment(parent)) {
    return sourceNodesEqual(ast, ast.as.AsSpreadAssignment(parent)?.Expression, child);
  }
  if (ast.is.IsPropertyAssignment(parent)) {
    return sourceNodesEqual(ast, ast.as.AsPropertyAssignment(parent)?.Initializer, child);
  }
  if (ast.is.IsShorthandPropertyAssignment(parent)) {
    return sourceNodesEqual(ast, ast.name(parent), child);
  }
  if (ast.is.IsArrayLiteralExpression(parent)) {
    return ast.elements(parent).some((element) => sourceNodesEqual(ast, element, child));
  }
  if (ast.is.IsObjectLiteralExpression(parent)) {
    return ast.properties(parent).some((property) => sourceNodesEqual(ast, property, child));
  }
  return false;
}
