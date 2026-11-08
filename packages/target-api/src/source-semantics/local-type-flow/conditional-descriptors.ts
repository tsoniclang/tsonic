import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceEvidenceExtends, type SourceEvidenceRelation } from "./evidence-relations.js";
import { sourceKeyDomainContains } from "./key-domains.js";
import { sourceProductionValues, sourceSemanticRefusal, type SourceSyntaxProduction } from "./semantic-production.js";

export function produceSourceConditionalType(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, input, reader, syntax } = context;
  if (!ast.is.IsConditionalTypeNode(syntax)) throw new Error("A Source conditional producer requires its original conditional TypeNode.");
  const conditional = ast.as.AsConditionalTypeNode(syntax);
  if (conditional?.CheckType === undefined || conditional.ExtendsType === undefined ||
    conditional.TrueType === undefined || conditional.FalseType === undefined) {
    return sourceSemanticRefusal(syntax, "An original conditional type is missing a required component.");
  }
  const checkNode = conditional.CheckType, patternNode = conditional.ExtendsType;
  const trueNode = conditional.TrueType, falseNode = conditional.FalseType;
  const check = reader.describeSyntax(checkNode, context.bindings);
  if (check.kind !== "resolved") return check;
  const inferred = new Map<Node, SourceTypeEvidence>();
  const bindings = (): readonly SourceTypeBinding[] => [...context.bindings.filter(binding => !inferred.has(binding.declaration)),
    ...[...inferred].map(([declaration, value]) => ({ declaration, value }))];
  const resolved = (value: SourceEvidenceRelation): SourceProductionResult<SourceEvidenceRelation> => ({ kind: "resolved", value });

  function combine(values: readonly SourceProductionResult<SourceEvidenceRelation>[]): SourceProductionResult<SourceEvidenceRelation> {
    const selected = sourceProductionValues(values);
    if (selected.kind !== "resolved") return selected;
    return resolved(selected.value.includes("no") ? "no" : selected.value.includes("deferred") ? "deferred" : "yes");
  }

  function match(pattern: Node, actual: SourceTypeEvidence): SourceProductionResult<SourceEvidenceRelation> {
    if (ast.is.IsInferTypeNode(pattern)) {
      const declaration = ast.as.AsInferTypeNode(pattern)?.TypeParameter;
      if (declaration === undefined || !ast.is.IsTypeParameterDeclaration(declaration)) return sourceSemanticRefusal(pattern,
        "An infer component requires its actual original type parameter declaration.");
      const annotation = ast.as.AsTypeParameterDeclaration(declaration)?.Constraint;
      if (annotation !== undefined) {
        const constraint = reader.describeSyntax(annotation, bindings());
        if (constraint.kind !== "resolved") return constraint;
        const fit = sourceEvidenceExtends(context, actual, constraint.value);
        if (fit.kind !== "resolved" || fit.value !== "yes") return fit;
      }
      const previous = inferred.get(declaration);
      const joined = previous === undefined ? { kind: "resolved" as const, value: actual }
        : builder.join(builder.componentIdentity(declaration, []), "inferred", [previous, actual], undefined);
      if (joined.kind === "refused") return joined;
      inferred.set(declaration, joined.value);
      return resolved("yes");
    }
    if (ast.is.IsParenthesizedTypeNode(pattern)) {
      const selected = ast.as.AsParenthesizedTypeNode(pattern)?.Type;
      return selected === undefined ? sourceSemanticRefusal(pattern, "An original parenthesized conditional component is missing.") : match(selected, actual);
    }
    if (actual.type.kind === "parameter" || actual.type.kind === "projection") return resolved("deferred");
    if (ast.is.IsIntersectionTypeNode(pattern)) return combine(ast.children(pattern).map(child => child === undefined
      ? sourceSemanticRefusal(pattern, "An original intersection pattern component is missing.") : match(child, actual)));
    if (ast.is.IsTypeReferenceNode(pattern) && actual.type.kind === "declared") {
      const declaration = actual.type.declaration;
      if (input.describe(input.syntax(pattern)).declaration === declaration) {
        const arguments_ = ast.typeArguments(pattern);
        if (arguments_.length !== actual.type.typeArguments.length) return resolved("no");
        return combine(arguments_.map((argument, index) => {
          if (argument === undefined) return sourceSemanticRefusal(pattern, "An original conditional type argument is missing.");
          const selected = builder.component(actual, { kind: "type-argument", declaration, index });
          return selected.kind === "refused" ? selected : match(argument, selected.value);
        }));
      }
    }
    const definition = builder.definition(actual);
    if (definition.kind === "refused") return definition;
    const selected = definition.value, type = selected.type;
    if (ast.is.IsArrayTypeNode(pattern)) {
      const element = ast.as.AsArrayTypeNode(pattern)?.ElementType;
      if (element === undefined) return sourceSemanticRefusal(pattern, "An original array pattern element is missing.");
      if (type.kind === "array") {
        if (type.readonly) return resolved("no");
        const value = builder.component(selected, { kind: "array-element" });
        return value.kind === "refused" ? value : match(element, value.value);
      }
      if (type.kind !== "tuple" || type.readonly) return resolved("no");
      return combine(type.elements.map((_, index) => {
        const value = builder.component(selected, { kind: "tuple-element", index });
        return value.kind === "refused" ? value : match(element, value.value);
      }));
    }
    if (ast.is.IsTypeOperatorNode(pattern) && ast.operatorKindName(pattern) === "KindReadonlyKeyword") {
      const inner = ast.as.AsTypeOperatorNode(pattern)?.Type;
      if (inner === undefined) return sourceSemanticRefusal(pattern, "An original readonly pattern component is missing.");
      if (ast.is.IsArrayTypeNode(inner) && (type.kind === "array" || type.kind === "tuple")) {
        const element = ast.as.AsArrayTypeNode(inner)?.ElementType;
        if (element === undefined) return sourceSemanticRefusal(inner, "An original readonly array pattern element is missing.");
        const values = type.kind === "array" ? [builder.component(selected, { kind: "array-element" })]
          : type.elements.map((_, index) => builder.component(selected, { kind: "tuple-element", index }));
        return combine(values.map(value => value.kind === "refused" ? value : match(element, value.value)));
      }
      if (ast.is.IsTupleTypeNode(inner)) return tuple(inner, selected, true);
    }
    if (ast.is.IsTupleTypeNode(pattern)) return tuple(pattern, selected, false);
    if (ast.is.IsFunctionTypeNode(pattern) || ast.is.IsConstructorTypeNode(pattern) || ast.is.IsMethodSignatureDeclaration(pattern)) {
      if (type.kind !== "shape" && type.kind !== "callable") return resolved("no");
      const signatures = ast.is.IsConstructorTypeNode(pattern) ? type.constructs : type.calls;
      if (signatures.length === 0) return resolved("no");
      const signature = signatures[signatures.length - 1]!;
      const matches: SourceProductionResult<SourceEvidenceRelation>[] = [];
      let index = 0;
      for (const parameter of ast.parameters(pattern)) {
        if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter)) return sourceSemanticRefusal(pattern,
          "An original conditional callable parameter is missing.");
        const annotation = ast.typeNode(parameter);
        if (annotation === undefined) return sourceSemanticRefusal(parameter, "An original conditional parameter requires its type component.");
        const name = ast.name(parameter);
        if (name !== undefined && ast.text(name) === "this") {
          if (signature.receiver === undefined) return resolved("no");
          const receiver = builder.component(selected, { kind: "receiver", signature: signature.identity });
          matches.push(receiver.kind === "refused" ? receiver : match(annotation, receiver.value));
          continue;
        }
        const rest = ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined;
        if (!rest && signature.parameters[index] === undefined) return resolved("no");
        const value = rest ? builder.component(selected, { kind: "signature-tail", signature: signature.identity, start: index, readonly: false })
          : builder.component(selected, { kind: "parameter", signature: signature.identity, index });
        matches.push(value.kind === "refused" ? value : match(annotation, value.value));
        index++;
      }
      const resultNode = ast.typeNode(pattern);
      if (resultNode === undefined) return sourceSemanticRefusal(pattern, "An original conditional callable result is missing.");
      const result = builder.component(selected, { kind: "result", signature: signature.identity });
      matches.push(result.kind === "refused" ? result : match(resultNode, result.value));
      return combine(matches);
    }
    if (ast.is.IsTypeLiteralNode(pattern)) {
      if (type.kind !== "shape" && type.kind !== "callable") return resolved("no");
      const expected = reader.describeSyntax(pattern, bindings());
      if (expected.kind !== "resolved") return expected;
      const correspondence = context.objects.correspondence(selected, expected.value, "correspondence", (destination, source) =>
        sourceKeyDomainContains(builder, destination, source));
      if (correspondence.kind !== "resolved") return correspondence;
      if (correspondence.value.kind === "unavailable") return resolved(correspondence.value.reason === "unresolved-shape" ? "deferred" : "no");
      const matches: SourceProductionResult<SourceEvidenceRelation>[] = [];
      for (const pair of correspondence.value.members) {
        if (pair.kind === "absent") {
          if (!pair.destination.optional) return resolved("no");
          continue;
        }
        if (pair.source.optional && !pair.destination.optional) return resolved("no");
        const declarations = pair.destination.declarations.filter(declaration => ast.parent(declaration) === pattern);
        if (declarations.length !== 1) return sourceSemanticRefusal(pattern, "A conditional member requires its exact original pattern declaration.");
        const member = declarations[0]!;
        const annotation = ast.is.IsMethodSignatureDeclaration(member) ? member : ast.typeNode(member);
        if (annotation === undefined) return sourceSemanticRefusal(member, "An original conditional member type is missing.");
        if (pair.source.readType === undefined) return resolved("no");
        matches.push(match(annotation, pair.source.readType));
      }
      if (correspondence.value.indexes.length > 0) matches.push(sourceEvidenceExtends(context, selected, expected.value));
      return combine(matches);
    }
    const expected = reader.describeSyntax(pattern, bindings());
    return expected.kind !== "resolved" ? expected : sourceEvidenceExtends(context, actual, expected.value);
  }

  function tuple(pattern: Node, actual: SourceTypeEvidence, readonlyPattern: boolean): SourceProductionResult<SourceEvidenceRelation> {
    if (actual.type.kind !== "tuple" || actual.type.readonly && !readonlyPattern) return resolved("no");
    const parts = ast.elements(pattern).map(member => {
      if (member === undefined) return undefined;
      const named = ast.is.IsNamedTupleMember(member) ? ast.as.AsNamedTupleMember(member) : undefined;
      const annotation = named?.Type ?? member;
      const rest = named?.DotDotDotToken !== undefined || ast.is.IsRestTypeNode(annotation);
      const optional = named?.QuestionToken !== undefined || ast.is.IsOptionalTypeNode(annotation);
      const value = ast.is.IsRestTypeNode(annotation) ? ast.as.AsRestTypeNode(annotation)?.Type
        : ast.is.IsOptionalTypeNode(annotation) ? ast.as.AsOptionalTypeNode(annotation)?.Type : annotation;
      return value === undefined ? undefined : { value, rest, optional };
    });
    if (parts.some(part => part === undefined)) return sourceSemanticRefusal(pattern, "An original tuple pattern component is missing.");
    const restIndex = parts.findIndex(part => part?.rest);
    if (parts.filter(part => part?.rest).length > 1) return sourceSemanticRefusal(pattern, "A tuple conditional requires one original rest place.");
    if (restIndex < 0 && actual.type.elements.length > parts.length || actual.type.elements.length < parts.filter(part => !part!.optional && !part!.rest).length) return resolved("no");
    const matches: SourceProductionResult<SourceEvidenceRelation>[] = [];
    for (const [index, part] of parts.entries()) {
      const current = part!;
      const suffix = restIndex < 0 ? 0 : parts.length - restIndex - 1;
      const actualIndex = restIndex >= 0 && index > restIndex ? actual.type.elements.length - (parts.length - index) : index;
      if (!current.rest && actual.type.elements[actualIndex] === undefined) {
        if (current.optional) continue;
        return resolved("no");
      }
      const value = current.rest ? builder.component(actual, { kind: "tuple-slice", start: index, endCount: suffix, readonly: false })
        : builder.component(actual, { kind: "tuple-element", index: actualIndex });
      matches.push(value.kind === "refused" ? value : match(current.value, value.value));
    }
    return combine(matches);
  }

  function branch(actual: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
    inferred.clear();
    if (originalCheck.kind === "parameter") inferred.set(originalCheck.parameter, actual);
    const matched = match(patternNode, actual);
    if (matched.kind !== "resolved") return matched;
    if (matched.value === "deferred") {
      const component = builder.componentIdentity(syntax, []);
      return { kind: "resolved", value: builder.evidence({ type: builder.projection(actual.type, { kind: "component", component }),
        component, category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
      [{ selector: { kind: "projection-source" }, value: actual }], context.component, sourceOpenLiteralDomain) };
    }
    return reader.describeSyntax(matched.value === "yes" ? trueNode : falseNode, bindings());
  }
  const originalCheck = input.describe(input.syntax(checkNode));
  if (originalCheck.kind === "parameter" && check.value.type.kind === "intrinsic" && check.value.type.intrinsic === "never") {
    return builder.join(builder.componentIdentity(syntax, []), "authored", [], context.component);
  }
  const results = check.value.sum !== undefined && originalCheck.kind === "parameter"
    ? sourceProductionValues(check.value.sum.arms.map(arm => branch(arm))) : sourceProductionValues([branch(check.value)]);
  return results.kind !== "resolved" ? results : builder.join(builder.componentIdentity(syntax, []), "authored", results.value, context.component);
}
