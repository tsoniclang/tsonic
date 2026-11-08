import type { Node } from "@tsonic/tsts";
import type { SourceInputCallCandidate } from "../../host-input/call-input.js";
import type { SourcePresence, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { Node_Expression } from "../../source-navigation/ast.js";
import { produceSourceHeritageBindings, type SourceCallableProduction } from "./callable-production.js";
import { produceSourceEffectiveArguments } from "./argument-places.js";
import { sourceLiteralDomainsEqual } from "../../source-model/literals/domain.js";

export function produceSourceArgumentContext(context: SourceCallableProduction, occurrence: Node,
  invocation: Node): SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
  const { ast, input, builder, reader } = context;
  const none = { kind: "resolved", value: { kind: "none" } } as const;
  const selected = input.application(invocation);
  if (selected.kind === "untyped") return none;
  const candidates = selected.kind === "applicable" ? [selected.selection] : selected.candidates;
  const values: SourceTypeEvidence[] = [];
  for (const candidate of candidates) {
    const value = parameter(candidate);
    if (value.kind !== "resolved") return value;
    if (value.value.kind === "none") return none;
    values.push(value.value.value);
  }
  if (values.length === 0 || !values.every(value => value.type === values[0]!.type &&
    value.category.kind === "known" && values[0]!.category.kind === "known" && value.category.category === values[0]!.category.category &&
    sourceLiteralDomainsEqual(builder.domain(value), builder.domain(values[0]!)))) return none;
  return { kind: "resolved", value: { kind: "present", value: values[0]! } };

  function parameter(candidate: SourceInputCallCandidate): SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
    const authoredIndex = candidate.sourceArguments.findIndex(argument => argument.expression === occurrence || argument.occurrence === occurrence);
    if (authoredIndex < 0) return none;
    const bindings: SourceTypeBinding[] = [];
    const original = candidate.application;
    for (const argument of [...(original.class?.arguments ?? []), ...original.signatureArguments]) {
      if (argument.declaration === undefined || argument.explicitTypeNode === undefined) continue;
      const value = reader.describeSyntax(argument.explicitTypeNode, bindings);
      if (value.kind !== "resolved") return value;
      bindings.push({ declaration: argument.declaration, value: value.value });
    }
    if (original.receiver?.role === "value" && original.class !== undefined && original.class.arguments.some(argument =>
      !bindings.some(binding => binding.declaration === argument.declaration))) {
      const receiver = context.value(original.receiver.occurrence, bindings);
      if (receiver.kind !== "resolved") return receiver;
      if (receiver.value.type.kind === "declared") {
        for (const [index, declaration] of ast.typeParameters(receiver.value.type.declaration).entries()) {
          if (declaration === undefined) throw new Error("An original receiver must retain its complete original class binder vector.");
          const value = builder.component(receiver.value, { kind: "type-argument", declaration: receiver.value.type.declaration, index });
          if (value.kind === "refused") return value;
          if (!bindings.some(binding => binding.declaration === declaration)) bindings.push({ declaration, value: value.value });
        }
        const inherited = produceSourceHeritageBindings(context, receiver.value.type.declaration, bindings);
        if (inherited.kind !== "resolved") return inherited;
        bindings.splice(0, bindings.length, ...inherited.value);
      }
    }
    const before: import("../../public/source/contracts.js").SourceAuthoredArgument[] = [];
    for (const argument of candidate.sourceArguments.slice(0, authoredIndex)) {
      if (argument.form === "value") continue;
      const value = context.value(argument.expression, bindings);
      if (value.kind !== "resolved") return value;
      before.push({ occurrence: argument.occurrence, form: "spread", operand: { occurrence: argument.expression, value: value.value } });
    }
    const expanded = produceSourceEffectiveArguments(builder, before);
    if (expanded.kind !== "resolved") return expanded;
    if (expanded.value.some(argument => argument.sourceForm === "spread-sequence")) return none;
    const effectiveIndex = candidate.sourceArguments.slice(0, authoredIndex).filter(argument => argument.form === "value").length + expanded.value.length;
    const shape = input.describeSignature(original.signature);
    const formalIndex = shape.parameters.findIndex(parameter => parameter.rest || parameter.index === effectiveIndex);
    if (formalIndex < 0) return none;
    const formal = shape.parameters[formalIndex]!;
    let declaration = formal.declaration;
    let target = shape.target;
    const seen = new Set([original.signature]);
    while (declaration === undefined && target !== undefined) {
      if (seen.has(target)) throw new Error("An original callable target relation cannot cycle.");
      seen.add(target);
      const selected = input.describeSignature(target);
      declaration = selected.parameters[formalIndex]?.declaration;
      target = selected.target;
    }
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    if (annotation === undefined) return none;
    const value = reader.describeSyntax(annotation, bindings);
    if (value.kind !== "resolved") return value;
    if (!formal.rest) return candidate.sourceArguments[authoredIndex]!.form === "spread" ? none
      : { kind: "resolved", value: { kind: "present", value: value.value } };
    const definition = builder.produceDefinition(value.value);
    if (definition.kind !== "resolved") return definition;
    const type = definition.value.type;
    if (candidate.sourceArguments[authoredIndex]!.form === "spread") {
      const selected = type.kind === "tuple" ? builder.component(definition.value, {
        kind: "tuple-slice", start: effectiveIndex - formal.index, endCount: 0, readonly: type.readonly,
      }) : definition;
      return selected.kind !== "resolved" ? selected : { kind: "resolved", value: { kind: "present", value: selected.value } };
    }
    const offset = effectiveIndex - formal.index;
    const selected = type.kind === "array" ? builder.component(definition.value, { kind: "array-element" })
      : type.kind === "tuple" && type.elements[offset] !== undefined ? builder.component(definition.value, { kind: "tuple-element", index: offset })
        : undefined;
    if (selected === undefined) return none;
    if (selected.kind !== "resolved") return selected;
    if (type.kind === "tuple" && type.elements[offset]?.kind === "rest") {
      const tail = builder.produceDefinition(selected.value);
      if (tail.kind !== "resolved") return tail;
      if (tail.value.type.kind !== "array") return none;
      const element = builder.component(tail.value, { kind: "array-element" });
      return element.kind !== "resolved" ? element : { kind: "resolved", value: { kind: "present", value: element.value } };
    }
    return { kind: "resolved", value: { kind: "present", value: selected.value } };
  }
}

export function sourceArgumentContextSite(context: Pick<SourceCallableProduction, "ast">,
  occurrence: Node): { readonly occurrence: Node; readonly invocation: Node } | undefined {
  const { ast } = context;
  let current = occurrence;
  let parent = ast.parent(current);
  while (parent !== undefined && ast.is.IsParenthesizedExpression(parent) && Node_Expression(ast, parent) === current) {
    current = parent;
    parent = ast.parent(current);
  }
  if (parent !== undefined && ast.is.IsSpreadElement(parent) && Node_Expression(ast, parent) === current) parent = ast.parent(parent);
  return parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
    Node_Expression(ast, parent) !== current ? { occurrence: current, invocation: parent } : undefined;
}
