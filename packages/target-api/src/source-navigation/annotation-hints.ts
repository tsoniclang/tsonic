import type { AstReader, Node } from "@tsonic/tsts";
import type { ResolvedSourceCallInfo } from "./call-info.js";
import type { SourceProgramNavigation } from "./types.js";
import { sourceTransparentExpressionOperand } from "./ast.js";
import { sourceEnclosing } from "./callable-boundaries.js";

export interface SourceAnnotationHintBindings {
  readonly ast: AstReader;
  readonly navigation: Pick<SourceProgramNavigation, "referenceFor">;
  readonly annotationType?: string;
  call(node: Node): ResolvedSourceCallInfo | undefined;
}

export function sourceAnnotationHint(
  expression: Node,
  bindings: SourceAnnotationHintBindings,
): string | undefined {
  const { ast, navigation } = bindings;
  let current = expression;
  let parent = ast.parent(current);
  while (parent !== undefined && sourceTransparentExpressionOperand(ast, parent) === current) {
    current = parent;
    parent = ast.parent(current);
  }
  if (parent === undefined) return undefined;
  let declaration = navigation.referenceFor(current)?.declaration;
  let annotation: Node | undefined;
  const assignment = ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindEqualsToken"
    ? ast.as.AsBinaryExpression(parent) : undefined;
  if (assignment?.Right === current && assignment.Left !== undefined) {
    annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    declaration = navigation.referenceFor(assignment.Left)?.declaration;
  } else if (ast.is.IsReturnStatement(parent)) {
    const callable = sourceEnclosing(ast, parent, "body");
    annotation = callable === undefined ? undefined : ast.typeNode(callable);
  } else if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) {
    const call = bindings.call(parent);
    const argumentIndex = call?.sourceArguments.findIndex(argument => argument.expression === current);
    const arguments_ = argumentIndex === undefined || argumentIndex < 0 ? []
      : call?.sourceArgumentBindings.filter(binding => binding.sourceArgumentIndex === argumentIndex) ?? [];
    const parameters = new Set(arguments_.map(binding => binding.sourceParameterIndex));
    const parameter = parameters.size === 1
      ? call?.sourceSelectedSignatureParameters[arguments_[0]!.sourceParameterIndex]?.parameterDeclaration : undefined;
    annotation = parameter === undefined ? undefined : ast.typeNode(parameter);
  }
  if (declaration === undefined || annotation === undefined || !ast.is.IsVariableDeclaration(declaration) ||
    ast.typeNode(declaration) !== undefined) return undefined;
  const name = ast.name(declaration);
  const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
  const kind = ast.variableDeclarationKind(declaration);
  if (name === undefined || !ast.is.IsIdentifier(name) || initializer === undefined || kind === undefined) return undefined;
  const scope = new Set<Node>();
  for (let ancestor: Node | undefined = declaration; ancestor !== undefined; ancestor = ast.parent(ancestor)) scope.add(ancestor);
  const pending = [annotation];
  while (pending.length > 0) {
    const selected = pending.pop()!;
    const referenced = navigation.referenceFor(selected)?.declaration;
    if (referenced !== undefined && ast.is.IsTypeParameterDeclaration(referenced)) {
      const owner = ast.parent(referenced);
      if (owner === undefined || !scope.has(owner)) return undefined;
    }
    ast.forEachChild(selected, child => { if (child !== undefined) pending.push(child); });
  }
  const annotationFile = ast.getSourceFile(annotation);
  const initializerFile = ast.getSourceFile(initializer);
  if (annotationFile === undefined || initializerFile === undefined) return undefined;
  const annotationText = bindings.annotationType ?? String(ast.getSourceText(annotationFile)).slice(ast.pos(annotation), ast.end(annotation))
    .trim().replace(/^readonly\s+(?=.+\[\]$)/u, "");
  const initializerText = String(ast.getSourceText(initializerFile)).slice(ast.pos(initializer), ast.end(initializer)).trim();
  if (annotationText.length > 120 || initializerText.length > 120) return undefined;
  return `Annotate \`${kind} ${ast.text(name)}: ${annotationText} = ${initializerText}\`.`;
}
