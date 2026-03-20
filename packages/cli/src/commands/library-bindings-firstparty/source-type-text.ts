import type { IrStatement } from "@tsonic/frontend";
import * as ts from "typescript";
import {
  renderSourceFunctionParametersText,
  selectPreferredSourceFunctionSignature,
  type SourceFunctionSignatureSurface as SourceFunctionSignatureDef,
} from "../../package-manifests/source-function-surfaces.js";
import type {
  AnonymousStructuralAliasInfo,
  SourceValueTypeDef,
} from "./types.js";
import {
  ensureUndefinedInType,
  getPropertyNameText,
} from "./portable-types.js";

export const renderSourceTypeNodeForAliasLookup = (
  node: ts.TypeNode,
  localTypeNameRemaps: ReadonlyMap<string, string>
): string => {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return "string";
    case ts.SyntaxKind.NumberKeyword:
      return "number";
    case ts.SyntaxKind.BooleanKeyword:
      return "boolean";
    case ts.SyntaxKind.VoidKeyword:
      return "void";
    case ts.SyntaxKind.NeverKeyword:
      return "never";
    case ts.SyntaxKind.UnknownKeyword:
      return "unknown";
    case ts.SyntaxKind.AnyKeyword:
      return "unknown";
    case ts.SyntaxKind.NullKeyword:
      return "null";
    case ts.SyntaxKind.UndefinedKeyword:
      return "undefined";
  }

  if (ts.isParenthesizedTypeNode(node)) {
    return `(${renderSourceTypeNodeForAliasLookup(
      node.type,
      localTypeNameRemaps
    )})`;
  }
  if (ts.isArrayTypeNode(node)) {
    return `${renderSourceTypeNodeForAliasLookup(
      node.elementType,
      localTypeNameRemaps
    )}[]`;
  }
  if (ts.isTupleTypeNode(node)) {
    return `[${node.elements
      .map((element) =>
        renderSourceTypeNodeForAliasLookup(element, localTypeNameRemaps)
      )
      .join(", ")}]`;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types
      .map((part) =>
        renderSourceTypeNodeForAliasLookup(part, localTypeNameRemaps)
      )
      .join(" | ");
  }
  if (ts.isIntersectionTypeNode(node)) {
    return node.types
      .map((part) =>
        renderSourceTypeNodeForAliasLookup(part, localTypeNameRemaps)
      )
      .join(" & ");
  }
  if (ts.isLiteralTypeNode(node)) {
    return node.getText();
  }
  if (ts.isTypeReferenceNode(node)) {
    const typeNameText = node.typeName.getText();
    const rewrittenTypeName = rewriteSourceTypeText(
      typeNameText,
      localTypeNameRemaps
    );
    if (!node.typeArguments || node.typeArguments.length === 0) {
      return rewrittenTypeName;
    }
    return `${rewrittenTypeName}<${node.typeArguments
      .map((argument) =>
        renderSourceTypeNodeForAliasLookup(argument, localTypeNameRemaps)
      )
      .join(", ")}>`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return `{ ${node.members
      .flatMap((member) => {
        if (ts.isPropertySignature(member)) {
          const propertyName = getPropertyNameText(member.name);
          if (!propertyName || !member.type) return [];
          const readonlyMark =
            (member.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
            ) ?? false)
              ? "readonly "
              : "";
          const propertyTypeText = member.questionToken
            ? ensureUndefinedInType(
                renderSourceTypeNodeForAliasLookup(
                  member.type,
                  localTypeNameRemaps
                )
              )
            : renderSourceTypeNodeForAliasLookup(
                member.type,
                localTypeNameRemaps
              );
          return [`${readonlyMark}${propertyName}: ${propertyTypeText}`];
        }
        if (ts.isMethodSignature(member)) {
          const methodName = getPropertyNameText(member.name);
          if (!methodName) return [];
          const typeParametersText = member.typeParameters
            ? `<${member.typeParameters
                .map((typeParameter) => typeParameter.name.text)
                .join(", ")}>`
            : "";
          const parametersText = member.parameters
            .map((parameter, index) => {
              const parameterName = ts.isIdentifier(parameter.name)
                ? parameter.name.text
                : `p${index + 1}`;
              const optionalMark = parameter.questionToken ? "?" : "";
              const restPrefix = parameter.dotDotDotToken ? "..." : "";
              const parameterType = parameter.type
                ? renderSourceTypeNodeForAliasLookup(
                    parameter.type,
                    localTypeNameRemaps
                  )
                : "unknown";
              return `${restPrefix}${parameterName}${optionalMark}: ${parameterType}`;
            })
            .join(", ");
          const returnType = member.type
            ? renderSourceTypeNodeForAliasLookup(
                member.type,
                localTypeNameRemaps
              )
            : "void";
          return [
            `${methodName}${typeParametersText}(${parametersText}): ${returnType}`,
          ];
        }
        return [];
      })
      .join("; ")} }`;
  }

  return node.getText();
};

export const rewriteSourceTypeText = (
  typeText: string,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string => {
  const sourceFile = ts.createSourceFile(
    "__tsonic_source_type__.ts",
    `type __T = ${typeText};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = sourceFile.statements[0];
  if (!statement || !ts.isTypeAliasDeclaration(statement)) return typeText;

  const transformer = <T extends ts.Node>(
    context: ts.TransformationContext
  ) => {
    const visit = (node: ts.Node): ts.Node => {
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        const remappedName = localTypeNameRemaps.get(node.typeName.text);
        if (remappedName) {
          return ts.factory.updateTypeReferenceNode(
            node,
            ts.factory.createIdentifier(remappedName),
            node.typeArguments
          );
        }
      }
      if (anonymousStructuralAliases.size > 0 && ts.isTypeLiteralNode(node)) {
        const alias = anonymousStructuralAliases.get(
          renderSourceTypeNodeForAliasLookup(node, localTypeNameRemaps)
        );
        if (alias) {
          return ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(alias.name),
            alias.typeParameters.map((typeParameter) =>
              ts.factory.createTypeReferenceNode(typeParameter)
            )
          );
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node: T): T => ts.visitNode(node, visit) as T;
  };

  const transformed = ts.transform(statement.type, [transformer])
    .transformed[0];
  if (!transformed) return typeText;
  const printer = ts.createPrinter({ removeComments: true });
  return printer.printNode(ts.EmitHint.Unspecified, transformed, sourceFile);
};

export const renderSourceFunctionSignature = (opts: {
  readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
  readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  readonly anonymousStructuralAliases?: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
}):
  | {
      readonly typeParametersText: string;
      readonly parametersText: string;
      readonly returnTypeText: string;
    }
  | undefined => {
  const sourceSignature = selectPreferredSourceFunctionSignature({
    targetTypeParameterCount: opts.declaration.typeParameters?.length ?? 0,
    targetParameterCount: opts.declaration.parameters.length,
    sourceSignatures: opts.sourceSignatures,
  });
  if (!sourceSignature) return undefined;

  const parametersText = renderSourceFunctionParametersText({
    parameters: sourceSignature.parameters.map((parameter) => ({
      prefixText: parameter.prefixText,
      typeText: rewriteSourceTypeText(
        parameter.typeText,
        opts.localTypeNameRemaps,
        opts.anonymousStructuralAliases
      ),
    })),
  });

  return {
    typeParametersText: sourceSignature.typeParametersText,
    parametersText,
    returnTypeText: rewriteSourceTypeText(
      sourceSignature.returnTypeText,
      opts.localTypeNameRemaps,
      opts.anonymousStructuralAliases
    ),
  };
};

export const renderSourceValueType = (
  sourceType: SourceValueTypeDef | undefined,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  anonymousStructuralAliases: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  > = new Map()
): string | undefined =>
  !sourceType
    ? undefined
    : rewriteSourceTypeText(
        sourceType.typeText,
        localTypeNameRemaps,
        anonymousStructuralAliases
      );

export const renderSourceFunctionType = (opts: {
  readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  readonly localTypeNameRemaps: ReadonlyMap<string, string>;
  readonly anonymousStructuralAliases?: ReadonlyMap<
    string,
    AnonymousStructuralAliasInfo
  >;
}): string | undefined => {
  const sourceSignature = opts.sourceSignatures[0];
  if (!sourceSignature) return undefined;
  const parametersText = renderSourceFunctionParametersText({
    parameters: sourceSignature.parameters.map((parameter) => ({
      prefixText: parameter.prefixText,
      typeText: rewriteSourceTypeText(
        parameter.typeText,
        opts.localTypeNameRemaps,
        opts.anonymousStructuralAliases
      ),
    })),
  });
  return `${sourceSignature.typeParametersText}(${parametersText}) => ${rewriteSourceTypeText(
    sourceSignature.returnTypeText,
    opts.localTypeNameRemaps,
    opts.anonymousStructuralAliases
  )}`;
};
