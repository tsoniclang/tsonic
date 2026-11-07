import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

/**
 * The parameter declarations of a callable value. `declaration` (the default when no context is given): the callable's
 * own declared signature; a class: its single effective construct signature; a variable or property: its authored
 * function-type annotation, else a function or arrow initializer (authored syntax). `selected-invocation`: the signature
 * host-input selected at that call. No checked type of the declaration is read (I3, R3).
 */
export function sourceCallableValueParameters(ast: AstReader, declaration: Node,
  navigation: Pick<SourceProgramNavigation, "call" | "classConstructors" | "declaredParameters">,
  context?: { readonly kind: "declaration" } | { readonly kind: "selected-invocation"; readonly call: Node }): readonly Node[] | undefined {
  if (context?.kind === "selected-invocation") {
    const selected = navigation.call(context.call);
    if (selected === undefined || selected.selection !== "resolved") return undefined;
    return distinctParameters(ast, selected.parameters.map(parameter => parameter.parameterDeclaration));
  }
  const declared = navigation.declaredParameters(declaration);
  if (declared !== undefined || context?.kind === "declaration") return declared;
  if (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) {
    const constructors = navigation.classConstructors(declaration);
    const signature = constructors.kind === "resolved" && constructors.signatures.length === 1 ? constructors.signatures[0] : undefined;
    return signature === undefined ? undefined : distinctParameters(ast, signature.parameters.map(parameter => parameter.parameterDeclaration));
  }
  const annotation = ast.is.IsVariableDeclaration(declaration) || ast.is.IsPropertyDeclaration(declaration)
    ? ast.typeNode(declaration) : undefined;
  if (annotation !== undefined) {
    return ast.is.IsFunctionTypeNode(annotation) ? navigation.declaredParameters(annotation) : undefined;
  }
  let initializer = ast.is.IsVariableDeclaration(declaration) ? ast.as.AsVariableDeclaration(declaration)?.Initializer
    : ast.is.IsPropertyDeclaration(declaration) ? ast.as.AsPropertyDeclaration(declaration)?.Initializer : undefined;
  while (initializer !== undefined && ast.is.IsParenthesizedExpression(initializer)) {
    initializer = ast.as.AsParenthesizedExpression(initializer)?.Expression;
  }
  return initializer !== undefined && (ast.is.IsArrowFunction(initializer) || ast.is.IsFunctionExpression(initializer))
    ? navigation.declaredParameters(initializer) : undefined;
}

function distinctParameters(ast: AstReader, parameters: readonly (Node | undefined)[]): readonly Node[] | undefined {
  const selected: Node[] = [];
  for (const parameter of parameters) {
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || selected.includes(parameter)) return undefined;
    selected.push(parameter);
  }
  return Object.freeze(selected);
}
