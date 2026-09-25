import { argumentPassingFactKey, sourceMarkerFactKey, sourcePrimitiveFactKey, type AstReader, type Node, type ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceCountedLoop, SourceProgramNavigation } from "../types.js";
import type { SourceFileSemantics } from "../../source-semantics/types.js";

interface IntegerUseEvidence {
  readonly sourceFacts: ReadonlySourceFactResolver | undefined;
  semanticsFor(node: Node): SourceFileSemantics;
}

export function sourceIntegerInduction(
  declaration: Node,
  ast: AstReader,
  navigation: SourceProgramNavigation,
  evidence: IntegerUseEvidence,
): SourceCountedLoop | undefined {
  if (!ast.is.IsVariableDeclaration(declaration) || ast.typeNode(declaration) !== undefined) return undefined;
  const list = ast.parent(declaration);
  const statement = list === undefined ? undefined : ast.parent(list);
  if (statement === undefined || !ast.is.IsForStatement(statement)) return undefined;
  const incrementor = ast.as.AsForStatement(statement)?.Incrementor;
  const loop = navigation.countedLoop(statement);
  if (loop?.counterDeclaration !== declaration || !ast.is.IsNumericLiteral(loop.start) ||
    Number(ast.text(loop.start)) !== 0) return undefined;
  const summary = navigation.declarationUseSummary(declaration);
  if (summary.captured || summary.exported || summary.memberWritten || summary.uses.length > 1024) return undefined;
  for (const use of summary.uses) {
    if (use.kind === "type-only") continue;
    let expression = use.reference;
    let parent = ast.parent(expression);
    while (parent !== undefined && ast.is.IsParenthesizedExpression(parent)) {
      expression = parent;
      parent = ast.parent(expression);
    }
    if (parent === undefined) return undefined;
    if (ast.is.IsElementAccessExpression(parent) &&
      ast.as.AsElementAccessExpression(parent)?.ArgumentExpression === expression) continue;
    if ((ast.is.IsPostfixUnaryExpression(parent) || ast.is.IsPrefixUnaryExpression(parent)) &&
      ast.operatorKindName(parent) === "KindPlusPlusToken" &&
      incrementor === parent) continue;
    if (ast.is.IsBinaryExpression(parent) && comparisons.has(ast.operatorKindName(parent) ?? "")) continue;
    if (ast.is.IsCallExpression(parent) && isIntegerValueArgument(parent, expression, ast, navigation, evidence)) continue;
    return undefined;
  }
  return loop;
}

function isIntegerValueArgument(
  call: Node, expression: Node, ast: AstReader, navigation: SourceProgramNavigation, evidence: IntegerUseEvidence,
): boolean {
  const facts = evidence.sourceFacts;
  if (facts === undefined || facts.getFact(call, sourceMarkerFactKey) !== undefined) return false;
  const semantics = evidence.semanticsFor(call);
  const selected = semantics.operations.call(call);
  if (selected?.sourceSelectedSignatureKind !== "resolved" || selected.outcome !== "applicable") return false;
  const declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
  if (declaration === undefined || !navigation.isProjectDeclaration(declaration) || ast.body(declaration) === undefined) return false;
  const argumentIndex = selected.sourceArguments.findIndex(argument => argument.expression === expression);
  const bindings = selected.sourceArgumentBindings.filter(binding => binding.sourceArgumentIndex === argumentIndex);
  const binding = bindings.length === 1 ? bindings[0] : undefined;
  if (binding?.sourceForm !== "value" || binding.sourceParameterForm !== "parameter") return false;
  const parameter = selected.sourceSelectedSignatureParameters.find(value => value.parameterIndex === binding.sourceParameterIndex);
  if (parameter?.authoredTypeNode === undefined || parameter.parameterDeclaration === undefined) return false;
  const primitive = facts.getFact(parameter.authoredTypeNode, sourcePrimitiveFactKey);
  if (primitive === undefined || !integerKinds.has(primitive.kind)) return false;
  return [expression, parameter.parameterDeclaration].every(subject =>
    (facts.getFact(subject, argumentPassingFactKey)?.mode ?? "by-value") === "by-value");
}

const integerKinds: ReadonlySet<string> = new Set([
  "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
  "int128", "uint128", "native-int", "native-uint",
]);

const comparisons: ReadonlySet<string> = new Set([
  "KindLessThanToken", "KindLessThanEqualsToken", "KindGreaterThanToken", "KindGreaterThanEqualsToken",
  "KindEqualsEqualsToken", "KindEqualsEqualsEqualsToken", "KindExclamationEqualsToken", "KindExclamationEqualsEqualsToken",
]);
