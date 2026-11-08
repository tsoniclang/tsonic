import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceOperation, SourcePresence, SourceTypeEvidence, SourceUseDestination, SourceValueOperand } from "../../public/source/contracts.js";
import type { SourceLiteralValue } from "../../source-model/literals/value.js";
import { sourceBooleanLiteralDisposition, sourceFiniteLiteralDomain, sourcePresenceLiteralDisposition,
  sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralValueDomain } from "../../source-model/literals/value-domain.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { Node_Expression } from "../../source-navigation/ast.js";
import { sourceTypeFlowBinaryOperators, sourceTypeFlowUnaryOperators } from "./operators.js";
import { decideSourcePrimitiveBinaryOperator, decideSourcePrimitiveUnaryOperator,
  sourcePrimitiveBinaryOperators, sourcePrimitiveUnaryOperators,
  type SourcePrimitiveOperatorOperand } from "./operator-decisions.js";
import { produceSourceAwaitedType } from "./awaited.js";
import { sourceSemanticRefusal, type SourceSemanticProduction } from "./semantic-production.js";
import { produceSourceEvidenceDetails } from "./member-production.js";
import { sourceEnumOperator, sourceEnumDestination } from "../enum-numeric-uses.js";

export interface SourceOperationProduction extends SourceSemanticProduction {
  value(node: Node): SourceProductionResult<SourceTypeEvidence>;
  literal(node: Node): SourceLiteralValue | undefined;
  unboundLiteral(node: Node): SourceLiteralValue | undefined;
  destination(node: Node): SourceProductionResult<SourcePresence<SourceUseDestination>>;
  expected(node: Node): SourceProductionResult<SourcePrimitiveKind | undefined>;
}

export function produceSourceOperation(context: SourceOperationProduction, occurrence: Node): SourceProductionResult<SourceOperation> {
  const { ast, builder } = context;
  const refusal = (message: string) => sourceSemanticRefusal(occurrence, message);
  const component = builder.componentIdentity(occurrence, []);
  const details = produceSourceEvidenceDetails(context, occurrence);
  if (details.kind !== "resolved") return details;
  const primitive = (kind: SourcePrimitiveKind, literal = context.literal(occurrence)): SourceTypeEvidence => {
    const category = kind === "bool" ? "boolean" : kind === "char" ? "string" : "number";
    return builder.evidence({ type: builder.primitive(kind), component,
      category: { kind: "known", category }, numeric: category === "number" ? {
        producer: occurrence, category: { kind: "known", category }, kind: "operation" } : undefined, sum: undefined },
    [], context.input.syntax(occurrence), sourceLiteralValueDomain(literal, category, "present"), details.value);
  };
  const operand = (node: Node): SourceProductionResult<SourceValueOperand> => {
    const result = context.value(node);
    return result.kind === "resolved" ? { kind: "resolved", value: { occurrence: node, value: result.value } } : result;
  };
  const join = (values: readonly SourceTypeEvidence[]) => builder.join(component, "inferred", values, undefined);
  const exactBool = (value: SourceTypeEvidence): boolean => value.type.kind === "primitive" && value.type.primitive === "bool";
  const literalBool = (value: boolean): SourceTypeEvidence => builder.evidence({ type: builder.primitive("bool"), component,
    category: { kind: "known", category: "boolean" }, numeric: undefined, sum: undefined }, [], undefined,
  sourceFiniteLiteralDomain([{ kind: "boolean", value }]), details.value);

  function requiredDestination(target: Node): SourceProductionResult<SourceUseDestination> {
    const result = context.destination(target);
    return result.kind !== "resolved" ? result : result.value.kind === "present" ? { kind: "resolved", value: result.value.value }
      : refusal("A Source storage operation requires its exact original applied destination.");
  }

  if (ast.is.IsConditionalExpression(occurrence)) {
    const selected = ast.as.AsConditionalExpression(occurrence);
    if (selected?.Condition === undefined || selected.WhenTrue === undefined || selected.WhenFalse === undefined) return refusal("A conditional selection requires its original control and branches.");
    const control = operand(selected.Condition);
    if (control.kind !== "resolved") return control;
    if (!exactBool(control.value.value)) return refusal("A conditional operator requires an exact bool condition.");
    const whenTrue = operand(selected.WhenTrue), whenFalse = operand(selected.WhenFalse);
    if (whenTrue.kind !== "resolved") return whenTrue;
    if (whenFalse.kind !== "resolved") return whenFalse;
    const disposition = sourceBooleanLiteralDisposition(builder.domain(control.value.value));
    const result = join(disposition === "true" ? [whenTrue.value.value] : disposition === "false" ? [whenFalse.value.value]
      : [whenTrue.value.value, whenFalse.value.value]);
    return result.kind === "refused" ? result : { kind: "resolved", value: { occurrence, kind: "conditional", disposition,
      control: control.value, whenTrue: whenTrue.value, whenFalse: whenFalse.value, result: result.value } };
  }
  if (ast.is.IsAwaitExpression(occurrence)) {
    const expression = Node_Expression(ast, occurrence);
    if (expression === undefined) return refusal("An await operation requires its original operand.");
    const value = operand(expression);
    if (value.kind !== "resolved") return value;
    const completion = produceSourceAwaitedType(context, value.value.value);
    return completion.kind !== "resolved" ? completion : { kind: "resolved", value: { occurrence, kind: "await",
      operand: value.value, completion: completion.value, result: completion.value } };
  }
  if (ast.is.IsPrefixUnaryExpression(occurrence) || ast.is.IsPostfixUnaryExpression(occurrence)) {
    const syntax = ast.is.IsPrefixUnaryExpression(occurrence) ? ast.as.AsPrefixUnaryExpression(occurrence) : ast.as.AsPostfixUnaryExpression(occurrence);
    const operator = sourceTypeFlowUnaryOperators.get(ast.operatorKindName(occurrence) ?? "");
    if (syntax?.Operand === undefined || operator === undefined) return refusal("A unary operation requires its original operand and admitted operator.");
    const value = operand(syntax.Operand);
    if (value.kind !== "resolved") return value;
    const enumOperation = sourceEnumOperator(context, operator, [value.value.value], occurrence);
    if (enumOperation.kind !== "resolved") return enumOperation;
    if (enumOperation.value.kind === "enum") {
      const result = builder.evidence({ ...enumOperation.value.value, component,
        numeric: { producer: occurrence, category: enumOperation.value.value.category, kind: "operation" } },
      [], undefined, sourcePresentLiteralDomain, details.value);
      if (operator !== "bit-not") throw new Error("An admitted original unary enum operation must be its complement operation.");
      return { kind: "resolved", value: { occurrence, kind: "unary", operator, operands: [value.value], result } };
    }
    const defined = builder.produceDefinition(value.value.value);
    if (defined.kind !== "resolved") return defined;
    const type = defined.value.type;
    const unary = sourcePrimitiveUnaryOperators.find(selected => selected === operator);
    if (unary === undefined) return refusal("This unary operation has no canonical native meaning.");
    let calculation: SourceTypeEvidence;
    if (type.kind === "intrinsic" && type.intrinsic === "bigint") {
      if (operator !== "negate" && operator !== "bit-not" && operator !== "increment" && operator !== "decrement") return refusal("This unary operator has no admitted bigint result.");
      calculation = builder.evidence({ type: builder.intrinsic("bigint"), component, category: { kind: "known", category: "bigint" },
        numeric: { producer: occurrence, category: { kind: "known", category: "bigint" }, kind: "operation" }, sum: undefined }, [], undefined,
      sourceLiteralValueDomain(context.literal(occurrence), "bigint", "present"), details.value);
    } else {
      if (type.kind !== "primitive") return refusal("A unary operator requires one exact primitive operand.");
      const expected = context.expected(occurrence);
      if (expected.kind !== "resolved") return expected;
      const selected = context.unboundLiteral(occurrence) === undefined ? type.primitive : expected.value ?? type.primitive;
      const decision = decideSourcePrimitiveUnaryOperator(unary, selected);
      if (decision.kind === "refused") return refusal(decision.reason);
      calculation = primitive(decision.result);
      if (operator === "logical-not") {
        const disposition = sourceBooleanLiteralDisposition(builder.domain(value.value.value));
        if (disposition !== "dynamic") calculation = literalBool(disposition !== "true");
      }
    }
    if (unary === "increment" || unary === "decrement") {
      const destination = requiredDestination(syntax.Operand);
      if (destination.kind !== "resolved") return destination;
      return { kind: "resolved", value: { occurrence, kind: "update", operator: unary,
        form: ast.is.IsPrefixUnaryExpression(occurrence) ? "prefix" : "postfix", operand: value.value,
        destination: destination.value, result: destination.value.applied } };
    }
    return { kind: "resolved", value: { occurrence, kind: "unary", operator: unary, operands: [value.value], result: calculation } };
  }
  if (!ast.is.IsBinaryExpression(occurrence)) return refusal("This occurrence is outside the Source operation domain.");
  const syntax = ast.as.AsBinaryExpression(occurrence), token = ast.operatorKindName(occurrence) ?? "";
  const operator = sourceTypeFlowBinaryOperators.get(token);
  if (syntax?.Left === undefined || syntax.Right === undefined || operator === undefined) return refusal("A binary operation requires its original operands and admitted operator.");
  const right = operand(syntax.Right);
  if (right.kind !== "resolved") return right;
  if (operator === "assignment") {
    const destination = requiredDestination(syntax.Left);
    if (destination.kind !== "resolved") return destination;
    const admitted = sourceEnumDestination(context, right.value.value, destination.value.applied, occurrence);
    return admitted.kind !== "resolved" ? admitted : { kind: "resolved", value: { occurrence, kind: "assignment",
      target: syntax.Left, source: right.value, destination: destination.value, result: destination.value.applied } };
  }
  const left = operand(syntax.Left);
  if (left.kind !== "resolved") return left;
  const operands = [left.value, right.value] as const;
  if (operator === "sequence") return { kind: "resolved", value: { occurrence, kind: "sequence", operands, result: right.value.value } };
  if (operator === "in" || operator === "instanceof") return { kind: "resolved", value: { occurrence, kind: operator,
    left: left.value, right: right.value, result: primitive("bool") } };
  if (operator === "logical-and" || operator === "logical-or") {
    if (!exactBool(left.value.value)) return refusal("A logical operator requires an exact bool left operand.");
    const selected = sourceBooleanLiteralDisposition(builder.domain(left.value.value));
    const and = operator === "logical-and";
    const disposition = selected === "dynamic" ? "dynamic" : (selected === "true") === and ? "right" : "left";
    const controlResult = literalBool(!and);
    const result = join(disposition === "left" ? [controlResult] : disposition === "right" ? [right.value.value] : [controlResult, right.value.value]);
    if (result.kind === "refused") return result;
    return { kind: "resolved", value: and ? { occurrence, kind: "and", disposition, control: left.value, whenTrue: right.value,
      whenFalse: "control-false", result: result.value } : { occurrence, kind: "or", disposition, control: left.value,
      whenTrue: "control-true", whenFalse: right.value, result: result.value } };
  }
  if (operator === "coalesce") {
    const control = left.value.value;
    const disposition = sourcePresenceLiteralDisposition(builder.domain(control));
    if (ast.is.IsElementAccessExpression(syntax.Left)) {
      const receiver = ast.as.AsElementAccessExpression(syntax.Left)?.Expression;
      if (receiver !== undefined) {
        const value = context.value(receiver);
        if (value.kind !== "resolved") return value;
        const definition = builder.produceDefinition(value.value);
        if (definition.kind !== "resolved") return definition;
        if (definition.value.type.kind === "array" || definition.value.type.kind === "tuple") return refusal(
          "A dense-array element read cannot supply a nullable coalescing read domain.");
      }
    }
    if (disposition === "present") return { kind: "resolved", value: { occurrence, kind: "coalesce", disposition: "left",
      control: left.value, whenPresent: control, whenAbsent: right.value, result: control } };
    let present = control;
    if (control.type.kind === "optional") {
      const selected = builder.component(control, { kind: "optional-value" });
      if (selected.kind === "refused") return selected;
      present = selected.value;
    } else if (control.sum !== undefined) {
      const selected = join(control.sum.arms.filter(arm => !(arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence")));
      if (selected.kind === "refused") return selected;
      present = selected.value;
    } else if (control.type.kind === "primitive") return refusal("A coalescing operator requires a nullable or runtime-union left operand.");
    const result = join(disposition === "absent" ? [right.value.value] : [present, right.value.value]);
    return result.kind === "refused" ? result : { kind: "resolved", value: { occurrence, kind: "coalesce",
      disposition: disposition === "absent" ? "right" : "dynamic", control: left.value, whenPresent: present,
      whenAbsent: right.value, result: result.value } };
  }
  const binary = sourcePrimitiveBinaryOperators.find(selected => selected === operator);
  if (binary === undefined) return refusal("This binary operation has no canonical native meaning.");
  const enumOperation = sourceEnumOperator(context, binary, [left.value.value, right.value.value], occurrence);
  if (enumOperation.kind !== "resolved") return enumOperation;
  const first = builder.produceDefinition(left.value.value), second = builder.produceDefinition(right.value.value);
  if (first.kind !== "resolved") return first;
  if (second.kind !== "resolved") return second;
  const leftType = first.value.type, rightType = second.value.type;
  const comparison = ["less", "less-equal", "greater", "greater-equal", "equal", "not-equal", "equal-strict", "not-equal-strict"].includes(binary);
  let calculation: SourceTypeEvidence;
  if (enumOperation.value.kind === "comparison") calculation = primitive("bool");
  else if (enumOperation.value.kind === "enum") calculation = builder.evidence({ ...enumOperation.value.value, component,
    numeric: { producer: occurrence, category: enumOperation.value.value.category, kind: "operation" } },
  [], undefined, sourcePresentLiteralDomain, details.value);
  else if (binary === "add" && (leftType.kind === "string" || rightType.kind === "string")) {
    calculation = builder.evidence({ type: builder.string(), component, category: { kind: "known", category: "string" }, numeric: undefined,
      sum: undefined }, [], undefined, sourcePresentLiteralDomain, details.value);
  } else if (leftType.kind === "intrinsic" && leftType.intrinsic === "bigint" && rightType.kind === "intrinsic" && rightType.intrinsic === "bigint") {
    if (binary === "power" || binary.startsWith("shift")) return refusal("This binary operator has no admitted bigint result.");
    calculation = comparison ? primitive("bool") : builder.evidence({ type: builder.intrinsic("bigint"), component,
      category: { kind: "known", category: "bigint" }, numeric: { producer: occurrence, category: { kind: "known", category: "bigint" }, kind: "operation" }, sum: undefined },
    [], undefined, sourceLiteralValueDomain(context.literal(occurrence), "bigint", "present"), details.value);
  } else if (leftType.kind === "primitive" && rightType.kind === "primitive") {
    const parameter = (node: Node, primitive: SourcePrimitiveKind): SourcePrimitiveOperatorOperand => {
      const literal = context.unboundLiteral(node);
      return literal === undefined ? { kind: "fixed", primitive } : { kind: "unbound-literal", primitive, literal };
    };
    const expected = context.expected(occurrence);
    if (expected.kind !== "resolved") return expected;
    const decision = decideSourcePrimitiveBinaryOperator(binary, parameter(syntax.Left, leftType.primitive), parameter(syntax.Right, rightType.primitive), expected.value);
    if (decision.kind === "refused") return refusal(decision.reason);
    calculation = primitive(decision.result);
  } else if (comparison) calculation = primitive("bool");
  else return refusal("This binary operator has no admitted exact Source operand pair.");
  const compound = token.endsWith("EqualsToken") && !["KindEqualsEqualsToken", "KindEqualsEqualsEqualsToken", "KindExclamationEqualsToken",
    "KindExclamationEqualsEqualsToken", "KindLessThanEqualsToken", "KindGreaterThanEqualsToken"].includes(token);
  if (compound) {
    const destination = requiredDestination(syntax.Left);
    return destination.kind !== "resolved" ? destination : { kind: "resolved", value: { occurrence, kind: "compound", operator: binary,
      target: syntax.Left, operands, destination: destination.value, calculation, result: destination.value.applied } };
  }
  return { kind: "resolved", value: { occurrence, kind: "binary", operator: binary, operands, result: calculation } };
}
