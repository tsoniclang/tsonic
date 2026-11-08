import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNodeCountedLoop, SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import type { SourceApplication, SourceDeclaredSlot, SourceDescriptorView } from "../../public/source/contracts.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourcePrimitiveIntegerBounds } from "../../source-semantics/local-type-flow/operator-decisions.js";
import type { SourceBindingExposureQueries } from "../binding-mutation-exposure.js";
import { sourceIntegerScalar } from "./domain.js";

export interface SourceIntegerInductionContext {
  readonly ast: AstReader;
  readonly navigation: SourceNodeNavigationFacts;
  readonly protocols: SourceBindingExposureQueries;
  readonly view: SourceDescriptorView;
  syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
  application(node: Node): SourceProductionResult<SourceApplication>;
  declaredSlot(node: Node): SourceProductionResult<SourceDeclaredSlot>;
}

export function sourceIntegerInduction(
  context: SourceIntegerInductionContext,
  declaration: Node,
): SourceProductionResult<SourceNodeCountedLoop | undefined> {
  const { ast, navigation } = context;
  const resolved = (value: SourceNodeCountedLoop | undefined): SourceProductionResult<SourceNodeCountedLoop | undefined> =>
    Object.freeze({ kind: "resolved", value });
  if (!navigation.includes(declaration)) throw new Error("Integer induction requires its exact original Source declaration.");
  if (!ast.is.IsVariableDeclaration(declaration) || ast.typeNode(declaration) !== undefined) return resolved(undefined);
  const list = ast.parent(declaration);
  const statement = list === undefined ? undefined : ast.parent(list);
  if (statement === undefined || !ast.is.IsForStatement(statement)) return resolved(undefined);
  const incrementor = ast.as.AsForStatement(statement)?.Incrementor;
  const loop = navigation.countedLoop(statement);
  if (loop?.counterDeclaration !== declaration || !ast.is.IsNumericLiteral(loop.start)) return resolved(undefined);
  const initial = context.syntaxDomain(loop.start);
  if (initial.kind !== "resolved") return initial;
  if (initial.value.kind !== "finite" || initial.value.values.length !== 1 || sourceIntegerScalar(initial.value.values[0]!) !== 0n)
    return resolved(undefined);
  const summary = navigation.declarationUseSummary(declaration);
  if (summary.captured || summary.exported || summary.memberWritten || summary.uses.length > 1024) return resolved(undefined);
  for (const use of summary.uses) {
    if (use.kind === "type-only") continue;
    let expression = use.reference;
    let parent = ast.parent(expression);
    while (parent !== undefined && ast.is.IsParenthesizedExpression(parent)) {
      expression = parent;
      parent = ast.parent(expression);
    }
    if (parent === undefined) return resolved(undefined);
    if (ast.is.IsElementAccessExpression(parent) &&
      ast.as.AsElementAccessExpression(parent)?.ArgumentExpression === expression) continue;
    if ((ast.is.IsPostfixUnaryExpression(parent) || ast.is.IsPrefixUnaryExpression(parent)) &&
      ast.operatorKindName(parent) === "KindPlusPlusToken" &&
      incrementor === parent) continue;
    if (ast.is.IsBinaryExpression(parent) && comparisons.has(ast.operatorKindName(parent) ?? "")) continue;
    if (ast.is.IsCallExpression(parent)) {
      const argument = isIntegerValueArgument(context, parent, expression);
      if (argument.kind !== "resolved") return argument;
      if (argument.value) continue;
    }
    return resolved(undefined);
  }
  return resolved(loop);
}

function isIntegerValueArgument(
  context: SourceIntegerInductionContext, call: Node, expression: Node,
): SourceProductionResult<boolean> {
  const { ast, navigation } = context;
  const resolved = (value: boolean): SourceProductionResult<boolean> => Object.freeze({ kind: "resolved", value });
  for (const subject of [call, expression]) {
    const passing = context.protocols.argumentPassing(subject);
    if (passing.kind === "refused") return passing;
    if (passing.value.kind === "present" && passing.value.value.mode !== "by-value") return resolved(false);
  }
  const pointer = context.protocols.pointerOperation(call);
  if (pointer.kind === "refused") return pointer;
  if (pointer.value.kind === "present") return resolved(false);
  const selected = context.application(call);
  if (selected.kind !== "resolved") return selected;
  const application = selected.value;
  if (application.kind !== "call" || application.argumentDisposition !== "evaluate") return resolved(false);
  const declaration = application.identity.signature.declaration;
  if (declaration === undefined || !navigation.isProjectDeclaration(declaration) || ast.body(declaration) === undefined) return resolved(false);
  const argumentIndex = application.sourceArguments.findIndex(argument => argument.occurrence === expression);
  if (argumentIndex < 0) return resolved(false);
  const authored = application.sourceArguments[argumentIndex]!;
  if (authored.operand.kind === "refused") return authored.operand;
  if (authored.form !== "value" || authored.operand.value.occurrence !== expression) return resolved(false);
  context.view.assertEvidence(authored.operand.value.value);
  const bindings = application.arguments.filter(binding => binding.sourceArgumentIndex === argumentIndex);
  const binding = bindings.length === 1 ? bindings[0] : undefined;
  const parameter = binding?.parameter.declaration;
  if (binding?.sourceForm !== "value" || binding.parameter.form !== "parameter" ||
    binding.parameter.signature !== application.identity.signature || parameter === undefined || ast.typeNode(parameter) === undefined)
    return resolved(false);
  const slot = context.declaredSlot(parameter);
  if (slot.kind !== "resolved") return slot;
  let value = slot.value.type;
  const visited = new Set<typeof value>();
  while (value.type.kind === "declared" || value.type.kind === "intersection") {
    if (visited.has(value) || visited.size >= 64) return resolved(false);
    visited.add(value);
    const definition = value.type.kind === "intersection"
      ? context.view.component(value, { kind: "intersection-result" }) : context.view.definition(value);
    if (definition.kind === "refused") return definition;
    value = definition.value;
  }
  context.view.assertEvidence(value);
  if (value.type.kind !== "primitive" || sourcePrimitiveIntegerBounds(value.type.primitive) === undefined)
    return resolved(false);
  const passing = context.protocols.argumentPassing(parameter);
  if (passing.kind === "refused") return passing;
  if (passing.value.kind === "present" && passing.value.value.mode !== "by-value") return resolved(false);
  return resolved(true);
}

const comparisons: ReadonlySet<string> = new Set([
  "KindLessThanToken", "KindLessThanEqualsToken", "KindGreaterThanToken", "KindGreaterThanEqualsToken",
  "KindEqualsEqualsToken", "KindEqualsEqualsEqualsToken", "KindExclamationEqualsToken", "KindExclamationEqualsEqualsToken",
]);
