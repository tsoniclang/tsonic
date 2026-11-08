import type { AstReader, Node, SourceFileQueries, Type } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo } from "../source-navigation/call-info.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../source-model/program.js";

export function getSourceCallTypeParameterDeclaration(
  ast: AstReader,
  queries: SourceFileSemantics,
  invocation: Node,
  call: ResolvedSourceCallInfo,
  argument: NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number],
): Node | undefined {
  if (!call.sourceSelectedMethodTypeArguments?.includes(argument)) return undefined;
  const symbol = queries.declarations.typeSymbol(argument.typeParameter);
  const declarations = symbol === undefined ? [] : queries.declarations.symbolDeclarations(symbol);
  if (ast.is.IsNewExpression(invocation)) {
    const parameters = declarations.filter(parameter => {
      const owner = ast.parent(parameter);
      return ast.is.IsTypeParameterDeclaration(parameter) && owner !== undefined &&
        (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner));
    });
    if (parameters.length > 0) {
      const selected = parameters.length === 1 ? parameters[0] : undefined;
      const declared = selected === undefined ? undefined : queries.declarations.declaredType(selected);
      return declared !== undefined && queries.types.isIdentical(declared, argument.typeParameter) ? selected : undefined;
    }
  }
  const declaration = queries.declarations.signatureDeclaration(call.selectedSignature);
  if (declaration === undefined) return undefined;
  const owner = ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : declaration;
  if (owner === undefined) return undefined;
  const parameters = new Set(ast.typeParameters(owner));
  const selected = declarations.filter(parameter =>
    ast.is.IsTypeParameterDeclaration(parameter) && parameters.has(parameter));
  return selected.length === 1 ? selected[0] : undefined;
}

export function getSourceMethodTypeArgumentComponent(
  argument: NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number],
): SourceTypeComponentEvidence {
  const authoredTypeNode = argument.explicitTypeNode ?? argument.defaultTypeNode;
  return Object.freeze({ selectedType: argument.selectedType,
    ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) });
}

export interface SourceTypeArgumentBinding {
  readonly declaration: Node;
  readonly parameterType: Type;
  readonly argumentType: Type;
  readonly scope: "outer" | "local";
}

export function getSourceTypeArgumentBindings(
  ast: AstReader,
  queries: SourceFileQueries,
  type: Type,
): readonly SourceTypeArgumentBinding[] | undefined {
  const selected = queries.typeShape.getTypeReferenceArgumentInfos(type);
  if (selected === undefined) return undefined;
  const bindings: SourceTypeArgumentBinding[] = [];
  for (const entry of selected) {
    const symbol = queries.checker.getTypeSymbol(entry.parameter);
    const declaration = queries.checker.getPrimarySymbolDeclaration(symbol);
    if (declaration === undefined || !ast.is.IsTypeParameterDeclaration(declaration) ||
      !queries.checker.getSymbolDeclarations(symbol).includes(declaration) ||
      bindings.some(binding => binding.declaration === declaration)) return undefined;
    bindings.push(Object.freeze({ declaration, parameterType: entry.parameter,
      argumentType: entry.argument, scope: entry.scope }));
  }
  return Object.freeze(bindings);
}
