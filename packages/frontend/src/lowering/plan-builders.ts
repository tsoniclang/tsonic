import { TstsSyntax } from "@tsonic/tsts";
import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  numericPrimitiveFactKey,
  selectedSignatureFactKey,
} from "../source-frontend/source-facts.js";
import type {
  LoweringBuildContext,
  LoweringCallPlan,
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringIndexAccessPlan,
  LoweringMemberAccessPlan,
  LoweringNarrowingPlan,
  LoweringStatementPlan,
  LoweringSyntheticDeclarationPlan,
  LoweringTypePlan,
  LoweringParameterPlan,
} from "./types.js";
import {
  isDeclarationNode,
  isExpressionNode,
  isStatementNode,
  isTypeNode,
  visitTstsNodes,
} from "./tsts-node-classification.js";

const nodeSourceText = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): string => {
  const text = sourceFile.Text();
  const pos = Math.max(0, Math.min(TstsSyntax.Node_Pos(node), text.length));
  const end = Math.max(pos, Math.min(TstsSyntax.Node_End(node), text.length));
  return text.slice(pos, end);
};

const nodeName = (node: TstsNode): string | undefined => {
  const nameNode = TstsSyntax.Node_Name(node);
  const text = nameNode ? TstsSyntax.Node_Text(nameNode) : TstsSyntax.Node_Text(node);
  return text === "" ? undefined : text;
};

const modifierFlags = (node: TstsNode): number =>
  Number(TstsSyntax.Node_ModifierFlags(node));

const nodeHasModifier = (node: TstsNode, flag: number): boolean =>
  (modifierFlags(node) & flag) !== 0;

const optionalNodeText = (
  sourceFile: TstsSourceFile,
  node: TstsNode | undefined
): string | undefined => (node ? nodeSourceText(sourceFile, node) : undefined);

const declarationKind = (
  node: TstsNode
): LoweringDeclarationPlan["declarationKind"] => {
  switch (node.Kind) {
    case TstsSyntax.KindClassDeclaration:
      return "class";
    case TstsSyntax.KindEnumDeclaration:
      return "enum";
    case TstsSyntax.KindFunctionDeclaration:
      return "function";
    case TstsSyntax.KindInterfaceDeclaration:
      return "interface";
    case TstsSyntax.KindTypeAliasDeclaration:
      return "type-alias";
    case TstsSyntax.KindVariableDeclaration:
      return "variable";
    default:
      return "unknown";
  }
};

const parameterPlans = (
  sourceFile: TstsSourceFile,
  node: TstsNode
): readonly LoweringParameterPlan[] =>
  (TstsSyntax.Node_Parameters(node) ?? [])
    .filter((parameter): parameter is TstsNode => parameter !== undefined)
    .map((parameter): LoweringParameterPlan => ({
      name: nodeName(parameter) ?? "arg",
      typeText: optionalNodeText(sourceFile, TstsSyntax.Node_Type(parameter)),
      initializerText: optionalNodeText(
        sourceFile,
        TstsSyntax.Node_Initializer(parameter)
      ),
      optional: TstsSyntax.Node_QuestionToken(parameter) !== undefined,
    }));

const planBase = <TKind extends string>(
  kind: TKind,
  sourceFile: TstsSourceFile,
  sourceNode: TstsNode
) => ({
  kind,
  sourceFile,
  sourceNode,
  sourceKind: Number(sourceNode.Kind),
  sourceKindName: TstsSyntax.Node_KindString(sourceNode),
  sourceText: nodeSourceText(sourceFile, sourceNode),
  name: nodeName(sourceNode),
});

type PlanBuckets = {
  readonly declarations: LoweringDeclarationPlan[];
  readonly types: LoweringTypePlan[];
  readonly statements: LoweringStatementPlan[];
  readonly expressions: LoweringExpressionPlan[];
  readonly calls: LoweringCallPlan[];
  readonly members: LoweringMemberAccessPlan[];
  readonly indexes: LoweringIndexAccessPlan[];
  readonly narrowings: LoweringNarrowingPlan[];
  readonly syntheticDeclarations: LoweringSyntheticDeclarationPlan[];
};

const createBuckets = (): PlanBuckets => ({
  declarations: [],
  types: [],
  statements: [],
  expressions: [],
  calls: [],
  members: [],
  indexes: [],
  narrowings: [],
  syntheticDeclarations: [],
});

const sourceSymbol = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode
) => context.checkerForSourceFile(sourceFile).getSymbolAtLocation(node);

const sourceType = (
  context: LoweringBuildContext,
  sourceFile: TstsSourceFile,
  node: TstsNode
) => context.checkerForSourceFile(sourceFile).getTypeAtLocation(node);

export const buildLoweringPlansForSourceFile = (
  sourceFile: TstsSourceFile,
  context: LoweringBuildContext
): PlanBuckets => {
  const buckets = createBuckets();
  const checker = context.checkerForSourceFile(sourceFile);

  visitTstsNodes(sourceFile, (node) => {
    if (isDeclarationNode(node)) {
      const symbol = sourceSymbol(context, sourceFile, node);
      buckets.declarations.push({
        ...planBase("declaration", sourceFile, node),
        declarationKind: declarationKind(node),
        symbol,
        declaredType: symbol
          ? checker.getDeclaredTypeOfSymbol(symbol)
          : sourceType(context, sourceFile, node),
        parameters: parameterPlans(sourceFile, node),
        returnTypeText: optionalNodeText(sourceFile, TstsSyntax.Node_Type(node)),
        bodyText: optionalNodeText(sourceFile, TstsSyntax.Node_Body(node)),
        initializerText: optionalNodeText(sourceFile, TstsSyntax.Node_Initializer(node)),
        exported: nodeHasModifier(node, TstsSyntax.ModifierFlagsExport),
        async: nodeHasModifier(node, TstsSyntax.ModifierFlagsAsync),
      });
    }

    if (isTypeNode(node)) {
      const type = checker.getTypeFromTypeNode(node);
      if (type) {
        buckets.types.push({
          ...planBase("type", sourceFile, node),
          sourceType: type,
          sourceSymbol: checker.getTypeAliasOrSymbol(type),
        });
      }

      const numericPrimitive = context.input.facts.get(
        numericPrimitiveFactKey,
        node
      );
      if (numericPrimitive) {
        buckets.syntheticDeclarations.push({
          kind: "synthetic-declaration",
          sourceFile,
          sourceNode: node,
          sourceKind: Number(node.Kind),
          sourceKindName: TstsSyntax.Node_KindString(node),
          sourceText: nodeSourceText(sourceFile, node),
          name: nodeName(node),
          stableId: `source-primitive:${numericPrimitive.kind}:${numericPrimitive.sourceName}`,
          sourceFeature: "type",
        });
      }
    }

    if (isStatementNode(node)) {
      buckets.statements.push({
        ...planBase("statement", sourceFile, node),
      });
    }

    if (isExpressionNode(node)) {
      const useSiteType = checker.getNarrowedTypeAtLocation(node);
      const contextualType = checker.getContextualType(node);
      buckets.expressions.push({
        ...planBase("expression", sourceFile, node),
        useSiteType,
        contextualType,
        symbol: sourceSymbol(context, sourceFile, node),
      });

      if (node.Kind === TstsSyntax.KindIdentifier && useSiteType) {
        buckets.narrowings.push({
          ...planBase("narrowing", sourceFile, node),
          useSiteType,
        });
      }
    }

    if (
      node.Kind === TstsSyntax.KindCallExpression ||
      node.Kind === TstsSyntax.KindNewExpression
    ) {
      const selected =
        context.input.facts.get(selectedSignatureFactKey, node)?.signature ??
        checker.getResolvedSignature(node);
      buckets.calls.push({
        ...planBase("call", sourceFile, node),
        signature: selected,
        returnType: selected
          ? checker.getReturnTypeOfSignature(selected)
          : undefined,
      });
    }

    if (node.Kind === TstsSyntax.KindPropertyAccessExpression) {
      const receiver = TstsSyntax.Node_Expression(node);
      const receiverType = checker.getNarrowedTypeAtLocation(receiver);
      const name = TstsSyntax.Node_Name(node);
      const memberSymbol = name ? checker.getSymbolAtLocation(name) : undefined;
      buckets.members.push({
        ...planBase("member-access", sourceFile, node),
        receiverType,
        memberSymbol,
        memberType: memberSymbol
          ? checker.getTypeOfSymbolAtLocation(memberSymbol, node)
          : undefined,
      });
    }

    if (node.Kind === TstsSyntax.KindElementAccessExpression) {
      const receiver = TstsSyntax.Node_Expression(node);
      const argument = TstsSyntax.Node_ArgumentList(node)?.Nodes?.[0];
      buckets.indexes.push({
        ...planBase("index-access", sourceFile, node),
        receiverType: checker.getNarrowedTypeAtLocation(receiver),
        indexType: argument
          ? checker.getNarrowedTypeAtLocation(argument)
          : undefined,
        resultType: checker.getNarrowedTypeAtLocation(node),
      });
    }
  });

  return buckets;
};
