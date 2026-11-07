import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

/**
 * The parameter declarations of a callable value. `declaration` (the default when no context is given): the callable's
 * own declared signature; a class: its single effective construct signature; a variable or property: the single call
 * signature its authored annotation declares (a function type, or a non-generic alias / interface / type literal naming
 * exactly one call signature, R2 #43), else a function or arrow initializer (authored syntax). `selected-invocation`: the signature
 * host-input selected at that call. No checked type of the declaration is read (I3, R3).
 */
export function sourceCallableValueParameters(ast: AstReader, declaration: Node,
  navigation: Pick<SourceProgramNavigation, "call" | "classConstructors" | "declaredParameters" | "sourceReferenceFor" |
    "mergedDeclarations">,
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
    const signature = annotatedCallSignature(ast, annotation, navigation, 0);
    return signature === undefined ? undefined : navigation.declaredParameters(signature);
  }
  let initializer = ast.is.IsVariableDeclaration(declaration) ? ast.as.AsVariableDeclaration(declaration)?.Initializer
    : ast.is.IsPropertyDeclaration(declaration) ? ast.as.AsPropertyDeclaration(declaration)?.Initializer : undefined;
  while (initializer !== undefined && ast.is.IsParenthesizedExpression(initializer)) {
    initializer = ast.as.AsParenthesizedExpression(initializer)?.Expression;
  }
  return initializer !== undefined && (ast.is.IsArrowFunction(initializer) || ast.is.IsFunctionExpression(initializer))
    ? navigation.declaredParameters(initializer) : undefined;
}

const maximumAnnotationDepth = 32;

/**
 * The one call-signature declaration an authored annotation names: a function type; a parenthesized type; a reference to
 * a non-generic type alias (followed); a reference to a non-generic, single-declaration interface without heritage, or a
 * type literal, with exactly one call signature member. Declaration input only (R3); undefined otherwise.
 */
function annotatedCallSignature(ast: AstReader, type: Node,
  navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "mergedDeclarations">, depth: number): Node | undefined {
  if (depth > maximumAnnotationDepth) return undefined;
  if (ast.is.IsFunctionTypeNode(type)) return type;
  const kind = ast.kindName(type);
  if (kind === "KindParenthesizedType") {
    const inner = ast.typeNode(type);
    return inner === undefined ? undefined : annotatedCallSignature(ast, inner, navigation, depth + 1);
  }
  if (kind === "KindTypeLiteral") return singleCallSignature(ast, type);
  if (kind !== "KindTypeReference") return undefined;
  const declaration = navigation.sourceReferenceFor(type)?.declaration;
  if (declaration === undefined || ast.typeParameters(declaration).length > 0) return undefined;
  if (ast.is.IsTypeAliasDeclaration(declaration)) {
    const aliased = ast.typeNode(declaration);
    return aliased === undefined ? undefined : annotatedCallSignature(ast, aliased, navigation, depth + 1);
  }
  if (!ast.is.IsInterfaceDeclaration(declaration) || navigation.mergedDeclarations(declaration).length !== 1 ||
    (ast.as.AsInterfaceDeclaration(declaration)?.HeritageClauses?.Nodes.length ?? 0) > 0) return undefined;
  return singleCallSignature(ast, declaration);
}

function singleCallSignature(ast: AstReader, owner: Node): Node | undefined {
  const signatures = ast.members(owner).filter((member): member is Node => member !== undefined && ast.is.IsCallSignatureDeclaration(member));
  return signatures.length === 1 ? signatures[0] : undefined;
}

function distinctParameters(ast: AstReader, parameters: readonly (Node | undefined)[]): readonly Node[] | undefined {
  const selected: Node[] = [];
  for (const parameter of parameters) {
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || selected.includes(parameter)) return undefined;
    selected.push(parameter);
  }
  return Object.freeze(selected);
}
