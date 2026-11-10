import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import { sourceOpenLiteralDomain, sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralValueDomain } from "../../source-model/literals/value-domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { Node_Expression, sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import { sourceTypeFlowNumericLiteralKind } from "./numeric-creation.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import type { SourceSemanticProduction } from "./production-context.js";
import { produceSourceEvidenceDetails } from "./member-production.js";
import { sourceApplicationStaticReceiver } from "./application-references.js";
import { sourceScalarCreationDestination } from "./construction-slots.js";
import type { SourceTypeFlowAnalysisContext } from "./types.js";
import { sourceEnumDestination, sourceEnumUseRefusal, sourceEnumValueDomain } from "../enum-numeric-uses.js";
import { produceSourceReceiverUse } from "./receivers.js";

export interface SourceValueProduction extends SourceSemanticProduction {
  readonly context: SourceTypeFlowAnalysisContext;
  inferred(node: Node): SourceProductionResult<SourceTypeEvidence>;
  expected(node: Node): SourceProductionResult<SourceTypeEvidence | undefined>;
  construction(node: Node): SourceProductionResult<SourceTypeEvidence>;
  yielded(node: Node): SourceProductionResult<SourceTypeEvidence>;
}

export function sourceTypeFlowNumericCreation(context: Pick<SourceTypeFlowAnalysisContext, "source" | "literal">, node: Node): {
  readonly occurrence: Node;
  readonly literal: ReturnType<SourceTypeFlowAnalysisContext["literal"]>;
} {
  const { ast } = context.source;
  let occurrence = node;
  for (;;) {
    const parent = ast.parent(occurrence);
    if (parent === undefined) break;
    if (ast.is.IsParenthesizedExpression(parent) && Node_Expression(ast, parent) === occurrence) occurrence = parent;
    else if (ast.is.IsPrefixUnaryExpression(parent) && ast.as.AsPrefixUnaryExpression(parent)?.Operand === occurrence &&
      (ast.operatorKindName(parent) === "KindPlusToken" || ast.operatorKindName(parent) === "KindMinusToken")) occurrence = parent;
    else break;
  }
  return { occurrence, literal: context.literal(occurrence) };
}

export function produceSourceValue(production: SourceValueProduction, occurrence: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
  const { ast, input, builder, reader, context } = production;
  const form = context.source.admission.form(occurrence);
  if (form.kind === "refused") return form;
  const component = builder.componentIdentity(occurrence, []);
  const scalar = (type: SourceTypeEvidence["type"], category: "number" | "bigint" | "boolean" | "string" | "absence",
    domain = sourceLiteralValueDomain(context.literal(occurrence), category, "present")): SourceProductionResult<SourceTypeEvidence> => {
    const details = produceSourceEvidenceDetails(production, occurrence, bindings);
    if (details.kind !== "resolved") return details;
    return { kind: "resolved", value: builder.evidence({ type, component, category: { kind: "known", category },
      numeric: category === "number" || category === "bigint" ? { producer: occurrence, category: { kind: "known", category }, kind: "literal" } : undefined,
      sum: undefined }, [], input.syntax(occurrence), domain, details.value) };
  };

  if (ast.is.IsNumericLiteral(occurrence)) {
    const literal = context.literal(occurrence);
    if (literal === undefined) return sourceSemanticRefusal(occurrence, "An original numeric literal requires its exact token evidence.");
    const creation = sourceTypeFlowNumericCreation(context, occurrence);
    const expected = production.expected(creation.occurrence);
    if (expected.kind !== "resolved") return expected;
    let primitive: SourcePrimitiveKind;
    const destination = expected.value === undefined || creation.literal === undefined ? undefined
      : sourceScalarCreationDestination(builder, expected.value, creation.literal, "number");
    if (destination !== undefined && destination.kind !== "resolved") return destination;
    if (destination?.kind === "resolved" && destination.value.kind === "present" && destination.value.value.type.kind === "primitive") {
      primitive = destination.value.value.type.primitive;
    } else {
      const own = sourceTypeFlowNumericLiteralKind(creation.literal ?? literal);
      if (own.kind === "refused") return sourceSemanticRefusal(creation.occurrence, own.reason);
      primitive = own.primitive;
    }
    return scalar(builder.primitive(primitive), "number");
  }
  if (ast.is.IsBigIntLiteral(occurrence)) {
    const expected = production.expected(occurrence);
    if (expected.kind !== "resolved") return expected;
    const literal = context.literal(occurrence);
    const destination = expected.value === undefined || literal === undefined ? undefined
      : sourceScalarCreationDestination(builder, expected.value, literal, "bigint");
    if (destination !== undefined && destination.kind !== "resolved") return destination;
    return scalar(destination?.kind === "resolved" && destination.value.kind === "present" ? destination.value.value.type : builder.intrinsic("bigint"), "bigint");
  }
  if (ast.is.IsStringLiteral(occurrence) || ast.is.IsNoSubstitutionTemplateLiteral(occurrence)) return scalar(builder.string(), "string");
  const kind = ast.kindName(occurrence);
  if (kind === "KindThisKeyword") {
    const selected = produceSourceReceiverUse({ ast, input, builder, reader, navigation: context.source.navigation,
      value: context.value }, occurrence, bindings);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "present") return builder.join(component, "inferred", [selected.value.value.value], input.syntax(occurrence));
  }
  if (kind === "KindTrueKeyword" || kind === "KindFalseKeyword") return scalar(builder.primitive("bool"), "boolean");
  if (kind === "KindNullKeyword" || ast.is.IsOmittedExpression(occurrence)) return scalar(builder.intrinsic("absence"), "absence",
    { kind: "finite", values: [{ kind: "absence" }] });
  if (ast.is.IsCallExpression(occurrence) || ast.is.IsNewExpression(occurrence)) {
    const application = context.application(occurrence);
    return application.kind !== "resolved" ? application : { kind: "resolved", value: application.value.result };
  }
  if (ast.is.IsArrayLiteralExpression(occurrence) || ast.is.IsObjectLiteralExpression(occurrence)) return production.construction(occurrence);
  if (ast.is.IsConditionalExpression(occurrence) || ast.is.IsBinaryExpression(occurrence) || ast.is.IsPrefixUnaryExpression(occurrence) ||
    ast.is.IsPostfixUnaryExpression(occurrence) || ast.is.IsAwaitExpression(occurrence)) {
    const operation = context.operation(occurrence);
    return operation.kind !== "resolved" ? operation : { kind: "resolved", value: operation.value.result };
  }
  if (ast.is.IsYieldExpression(occurrence)) return production.yielded(occurrence);
  if (ast.is.IsPropertyAccessExpression(occurrence) || ast.is.IsElementAccessExpression(occurrence)) {
    const parent = ast.parent(occurrence);
    if (parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) && Node_Expression(ast, parent) === occurrence) {
      const parentForm = context.source.admission.form(parent);
      if (parentForm.kind === "refused") return parentForm;
      const selected = input.application(parent);
      const candidates = selected.kind === "applicable" ? [selected.selection] : selected.kind === "conditional-candidates" ? selected.candidates : [];
      if (candidates.length > 0 && candidates.every(candidate => sourceApplicationStaticReceiver(context.source, candidate.application) !== undefined)) {
        const original = candidates[0]!.application.callee.component;
        if (candidates.every(candidate => candidate.application.callee.component === original)) return reader.describeComponent(original, bindings);
      }
    }
    const selected = context.objects.use(occurrence);
    if (selected.kind !== "resolved") return selected;
    const type = selected.value.readType ?? selected.value.writeType;
    return type === undefined ? sourceSemanticRefusal(occurrence, "This original Source member use has no value in its actual access role.")
      : { kind: "resolved", value: type };
  }
  const transparent = sourceTransparentExpressionOperand(ast, occurrence);
  if (transparent !== undefined) {
    const actual = context.value(transparent, bindings);
    if (actual.kind !== "resolved") return actual;
    if (ast.is.IsAsExpression(occurrence) || ast.is.IsTypeAssertion(occurrence)) {
      if (ast.isConstAssertion(occurrence)) return actual;
      const annotation = ast.typeNode(occurrence);
      if (annotation === undefined) throw new Error("An original type assertion requires its actual type syntax.");
      const target = reader.describeSyntax(annotation, bindings);
      if (target.kind !== "resolved") return target;
      const admitted = sourceEnumDestination(production, actual.value, target.value, occurrence);
      return admitted.kind !== "resolved" ? admitted : target;
    }
    if (ast.is.IsNonNullExpression(occurrence) && actual.value.type.kind === "optional") return builder.component(actual.value, { kind: "optional-value" });
    return actual;
  }
  if (ast.is.IsVoidExpression(occurrence) || ast.is.IsTypeOfExpression(occurrence) || ast.is.IsDeleteExpression(occurrence)) {
    const expression = Node_Expression(ast, occurrence);
    if (expression === undefined) throw new Error("An original unary expression requires its actual operand occurrence.");
    const operand = context.value(expression, bindings);
    if (operand.kind !== "resolved") return operand;
    return ast.is.IsVoidExpression(occurrence) ? scalar(builder.intrinsic("void"), "absence", { kind: "finite", values: [{ kind: "absence" }] })
      : ast.is.IsTypeOfExpression(occurrence) ? scalar(builder.string(), "string", sourcePresentLiteralDomain)
        : scalar(builder.primitive("bool"), "boolean", sourcePresentLiteralDomain);
  }
  if (ast.is.IsTemplateExpression(occurrence)) {
    for (const span of ast.as.AsTemplateExpression(occurrence)?.TemplateSpans?.Nodes ?? []) {
      if (span === undefined || !ast.is.IsTemplateSpan(span)) throw new Error("An original template requires its actual span vector.");
      const expression = ast.as.AsTemplateSpan(span)?.Expression;
      if (expression === undefined) throw new Error("An original template span requires its actual interpolation occurrence.");
      const value = context.value(expression, bindings);
      if (value.kind !== "resolved") return value;
      const domain = sourceEnumValueDomain(production, value.value);
      if (domain.kind !== "resolved") return domain;
      if (domain.value.possible.length > 0) return sourceEnumUseRefusal(production, domain.value, occurrence, true);
    }
    return scalar(builder.string(), "string");
  }
  if (ast.is.IsTaggedTemplateExpression(occurrence)) return sourceSemanticRefusal(occurrence,
    "A tagged-template value has no supported Source native-demand closure.", "TSONIC_SOURCE_FORM_UNSUPPORTED");
  if (ast.is.IsIdentifier(occurrence) || kind === "KindThisKeyword" || kind === "KindSuperKeyword") {
    const declaration = context.source.navigation.sourceReferenceFor(occurrence)?.declaration;
    if (declaration !== undefined && declaration !== occurrence) {
      if (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) {
        const value = reader.describeComponent(input.classFacets(declaration).value, bindings);
        return value.kind !== "resolved" ? value : builder.join(component, "inferred", [value.value], input.syntax(occurrence));
      }
      if (ast.is.IsVariableDeclaration(declaration) || ast.is.IsParameterDeclaration(declaration) || ast.is.IsBindingElement(declaration) || ast.is.IsPropertyDeclaration(declaration)) {
        return production.inferred(occurrence);
      }
      return reader.describeComponent(input.syntax(occurrence), bindings);
    }
  }
  if (ast.is.IsVariableDeclaration(occurrence) || ast.is.IsBindingElement(occurrence) || ast.is.IsParameterDeclaration(occurrence) ||
    ast.is.IsPropertyDeclaration(occurrence)) return production.inferred(occurrence);
  const facts = input.describe(input.syntax(occurrence));
  if (facts.kind === "unavailable") return sourceSemanticRefusal(occurrence,
    "This original value has no supported solved Source production or original declared component.");
  const result = reader.describeComponent(facts.component, bindings);
  if (result.kind !== "resolved") return result;
  if (result.value.type.kind === "intrinsic" && result.value.type.intrinsic === "object" && facts.authoredTypeNode === undefined)
    return sourceSemanticRefusal(occurrence, "This original allocation requires its precise Source object production.");
  return result;
}

export function sourceStoredValueDomain(context: SourceSemanticProduction, value: SourceTypeEvidence,
  declaration: Node, mutable: boolean): SourceProductionResult<SourceTypeEvidence> {
  if (!mutable) return { kind: "resolved", value };
  const domain = context.builder.domain(value);
  if (domain.kind !== "finite") return { kind: "resolved", value };
  const original = context.builder.originalComponent(value);
  const members = context.builder.members(value);
  if (members.kind !== "resolved") return members;
  const children: import("../descriptor-contracts.js").SourceEvidenceComponent[] = [];
  const type = value.type;
  if (type.kind === "array") {
    const element = context.builder.component(value, { kind: "array-element" });
    if (element.kind === "refused") return element;
    children.push({ selector: { kind: "array-element" }, value: element.value });
  } else if (type.kind !== "primitive" && type.kind !== "string" && type.kind !== "intrinsic") return { kind: "resolved", value };
  return { kind: "resolved", value: context.builder.evidence({ ...value, component: context.builder.componentIdentity(declaration, []) },
    children, original.kind === "present" ? original.value : undefined,
    domain.values.some(unit => unit.kind === "absence") ? sourceOpenLiteralDomain : sourcePresentLiteralDomain,
    { members: members.value, origins: context.builder.sourceOriginSubjects(value) }) };
}
