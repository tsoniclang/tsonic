import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsCallExpressionDetails,
  getTstsExpressionWithTypeArgumentsName,
  getTstsIdentifierText,
  getTstsNodeNameText,
  getTstsNodeSpan,
  getTstsSourceFileName,
  getTstsTypeReferenceDetails,
  isTstsCallExpression,
  isTstsClassDeclaration,
  isTstsIdentifier,
  isTstsInterfaceDeclaration,
  isTstsParameterDeclaration,
  isTstsPropertyDeclarationLike,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type { TstsSourceProgram } from "./tsts-source-program.js";
import {
  fieldSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
} from "./source-facts.js";
import type {
  SourceSemanticFactKey,
  SourceSemanticFactStore,
} from "./semantic-view.js";

export type TstsFactProjectionMissReason =
  | "source-file-not-found"
  | "unsupported-node-shape"
  | "source-node-not-found";

export type TstsFactProjectionMiss = {
  readonly fileName: string;
  readonly reason: TstsFactProjectionMissReason;
  readonly factIds: readonly string[];
  readonly pos?: number;
  readonly end?: number;
  readonly shape?: ProjectionShape;
  readonly name?: string;
};

export type TstsFactProjectionResult = {
  readonly projectedFacts: number;
  readonly missedFacts: readonly TstsFactProjectionMiss[];
};

type ProjectionShape =
  | "callExpression"
  | "classDeclaration"
  | "expressionWithTypeArguments"
  | "identifier"
  | "interfaceDeclaration"
  | "parameter"
  | "propertyDeclarationLike"
  | "typeReference";

const canonicalizeFilePath = (filePath: string): string => {
  const resolved = path.resolve(filePath);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
};

const key = (
  pos: number,
  end: number,
  shape: ProjectionShape,
  name: string | undefined
): string => `${pos}:${end}:${shape}:${name ?? ""}`;

const tsExpressionName = (
  expression: ts.Expression,
  sourceFile: ts.SourceFile
): string | undefined => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return expression.getText(sourceFile);
};

const tsNodeName = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): string | undefined => {
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    return node.name?.text;
  }
  if (
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isParameter(node)
  ) {
    return node.name.getText(sourceFile);
  }
  if (ts.isTypeReferenceNode(node)) {
    return node.typeName.getText(sourceFile);
  }
  if (ts.isCallExpression(node)) {
    return tsExpressionName(node.expression, sourceFile);
  }
  if (ts.isExpressionWithTypeArguments(node)) {
    return tsExpressionName(node.expression, sourceFile);
  }
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  return undefined;
};

const tsProjectionShape = (node: ts.Node): ProjectionShape | undefined => {
  if (ts.isCallExpression(node)) return "callExpression";
  if (ts.isClassDeclaration(node)) return "classDeclaration";
  if (ts.isExpressionWithTypeArguments(node)) {
    return "expressionWithTypeArguments";
  }
  if (ts.isIdentifier(node)) return "identifier";
  if (ts.isInterfaceDeclaration(node)) return "interfaceDeclaration";
  if (ts.isParameter(node)) return "parameter";
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
    return "propertyDeclarationLike";
  }
  if (ts.isTypeReferenceNode(node)) return "typeReference";
  return undefined;
};

const tstsProjectionShape = (
  node: TstsNode
): ProjectionShape | undefined => {
  if (isTstsCallExpression(node)) return "callExpression";
  if (isTstsClassDeclaration(node)) return "classDeclaration";
  if (getTstsExpressionWithTypeArgumentsName(node)) {
    return "expressionWithTypeArguments";
  }
  if (isTstsIdentifier(node)) return "identifier";
  if (isTstsInterfaceDeclaration(node)) return "interfaceDeclaration";
  if (isTstsParameterDeclaration(node)) return "parameter";
  if (isTstsPropertyDeclarationLike(node)) return "propertyDeclarationLike";
  if (getTstsTypeReferenceDetails(node)) return "typeReference";
  return undefined;
};

const tstsNodeName = (node: TstsNode): string | undefined => {
  const typeReference = getTstsTypeReferenceDetails(node);
  if (typeReference) return typeReference.name;
  const call = getTstsCallExpressionDetails(node);
  if (call) return call.calleeName;
  const expressionWithTypeArgumentsName =
    getTstsExpressionWithTypeArgumentsName(node);
  if (expressionWithTypeArgumentsName) return expressionWithTypeArgumentsName;
  const identifierText = getTstsIdentifierText(node);
  if (identifierText) return identifierText;
  return getTstsNodeNameText(node);
};

const indexTypeScriptSourceFile = (
  sourceFile: ts.SourceFile
): ReadonlyMap<string, ts.Node> => {
  const nodesByKey = new Map<string, ts.Node>();
  const visit = (node: ts.Node): void => {
    const shape = tsProjectionShape(node);
    if (shape) {
      nodesByKey.set(
        key(node.pos, node.end, shape, tsNodeName(node, sourceFile)),
        node
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodesByKey;
};

const projectFactsFromNode = (
  tstsNode: TstsNode,
  tsNode: ts.Node,
  sourceProgram: TstsSourceProgram,
  factStore: SourceSemanticFactStore<ts.Node>
): number => {
  let projectedFacts = 0;
  const projectFact = <T>(factKey: SourceSemanticFactKey<T>): void => {
    const fact = sourceProgram.extensionHost.facts.get(factKey, tstsNode);
    if (fact !== undefined) {
      factStore.set(tsNode, factKey, fact);
      projectedFacts += 1;
    }
  };

  projectFact(numericPrimitiveFactKey);
  projectFact(sourceTypeSemanticsFactKey);
  projectFact(fieldSemanticsFactKey);
  projectFact(parameterPassingFactKey);
  projectFact(extensionReceiverSemanticsFactKey);
  projectFact(heritageWrapperSemanticsFactKey);
  projectFact(markerApiSemanticsFactKey);
  projectFact(intrinsicSemanticsFactKey);

  return projectedFacts;
};

const collectProjectedFactIds = (
  tstsNode: TstsNode,
  sourceProgram: TstsSourceProgram
): readonly string[] => {
  const factIds: string[] = [];
  const collectFact = <T>(factKey: SourceSemanticFactKey<T>): void => {
    const fact = sourceProgram.extensionHost.facts.get(factKey, tstsNode);
    if (fact !== undefined) {
      factIds.push(factKey.id);
    }
  };

  collectFact(numericPrimitiveFactKey);
  collectFact(sourceTypeSemanticsFactKey);
  collectFact(fieldSemanticsFactKey);
  collectFact(parameterPassingFactKey);
  collectFact(extensionReceiverSemanticsFactKey);
  collectFact(heritageWrapperSemanticsFactKey);
  collectFact(markerApiSemanticsFactKey);
  collectFact(intrinsicSemanticsFactKey);

  return factIds;
};

export const projectTstsFactsToTypeScriptSource = (
  sourceProgram: TstsSourceProgram,
  sourceFiles: readonly ts.SourceFile[],
  factStore: SourceSemanticFactStore<ts.Node>
): TstsFactProjectionResult => {
  let projectedFacts = 0;
  const missedFacts: TstsFactProjectionMiss[] = [];
  const tsNodesByFile = new Map<string, ReadonlyMap<string, ts.Node>>();
  for (const sourceFile of sourceFiles) {
    tsNodesByFile.set(
      canonicalizeFilePath(sourceFile.fileName),
      indexTypeScriptSourceFile(sourceFile)
    );
  }

  for (const sourceFile of sourceProgram.sourceFiles) {
    const fileName = getTstsSourceFileName(sourceFile);
    if (!fileName) continue;
    const tsNodesByKey = tsNodesByFile.get(canonicalizeFilePath(fileName));
    if (!tsNodesByKey) {
      visitTstsSubtree(sourceFile, (node): void => {
        if (!node) return;
        const factIds = collectProjectedFactIds(node, sourceProgram);
        if (factIds.length === 0) return;
        const span = getTstsNodeSpan(node);
        missedFacts.push({
          fileName,
          reason: "source-file-not-found",
          factIds,
          pos: span?.pos,
          end: span?.end,
          shape: tstsProjectionShape(node),
          name: tstsNodeName(node),
        });
      });
      continue;
    }

    visitTstsSubtree(sourceFile, (node): void => {
      if (!node) return;
      const factIds = collectProjectedFactIds(node, sourceProgram);
      if (factIds.length === 0) return;

      const span = getTstsNodeSpan(node);
      const shape = tstsProjectionShape(node);
      if (!span || !shape) {
        missedFacts.push({
          fileName,
          reason: "unsupported-node-shape",
          factIds,
          pos: span?.pos,
          end: span?.end,
          shape,
          name: tstsNodeName(node),
        });
        return;
      }

      const name = tstsNodeName(node);
      const tsNode = tsNodesByKey.get(
        key(span.pos, span.end, shape, name)
      );
      if (!tsNode) {
        missedFacts.push({
          fileName,
          reason: "source-node-not-found",
          factIds,
          pos: span.pos,
          end: span.end,
          shape,
          name,
        });
        return;
      }

      projectedFacts += projectFactsFromNode(
        node,
        tsNode,
        sourceProgram,
        factStore
      );
    });
  }

  return {
    projectedFacts,
    missedFacts,
  };
};
