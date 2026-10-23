import type { AstReader, Node, Signature } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../source-semantics/types.js";

export function sourceCallableValueParameters(ast: AstReader, declaration: Node,
  semantics: SourceFileSemantics,
  context?: { readonly kind: "declaration" } |
    { readonly kind: "selected-invocation"; readonly signature: Signature }): readonly Node[] | undefined {
  const signature = context?.kind === "selected-invocation" ? context.signature
    : context?.kind === "declaration" ? semantics.declarations.declarationSignature(declaration)
      : sourceCallableDeclarationSignature(ast, declaration, semantics);
  if (signature === undefined) return undefined;
  const parameters: Node[] = [];
  const seen = new Set<Node>();
  for (const symbol of semantics.declarations.signatureParameters(signature)) {
    const parameter = semantics.declarations.primarySymbolDeclaration(symbol);
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter)) return undefined;
    if (seen.has(parameter)) return undefined;
    seen.add(parameter);
    parameters.push(parameter);
  }
  return Object.freeze(parameters);
}

function sourceCallableDeclarationSignature(ast: AstReader, declaration: Node,
  semantics: SourceFileSemantics): Signature | undefined {
  const authored = semantics.declarations.declarationSignature(declaration);
  if (authored !== undefined) return authored;
  const construction = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration);
  const type = construction ? semantics.declarations.declaredValueType(declaration) : semantics.types.expressionType(declaration);
  if (type === undefined) return undefined;
  const signatures = construction ? semantics.types.constructSignatures(type) : semantics.types.callSignatures(type);
  return signatures.length === 1 ? signatures[0] : undefined;
}
