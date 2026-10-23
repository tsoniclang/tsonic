import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../source-semantics/types.js";

export function sourceCallableValueParameters(ast: AstReader, declaration: Node,
  semantics: SourceFileSemantics): readonly Node[] | undefined {
  const checked = semantics.types.declarationSignatureInfo(declaration);
  if (checked === undefined) return undefined;
  const receiver = checked.thisParameter?.declaration;
  const parameters: Node[] = [];
  for (const parameter of ast.parameters(declaration)) {
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter)) return undefined;
    if (parameter !== receiver) parameters.push(parameter);
  }
  return Object.freeze(parameters);
}
