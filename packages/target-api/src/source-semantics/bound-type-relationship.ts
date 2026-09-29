import type { Node, Signature, Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./types.js";

export function sourceBoundTypeRelationship(
  authored: Type,
  selected: Type,
  { types, declarations }: SourceFileSemantics,
  bindingFor: (declaration: Node) => Type | undefined,
): "bound" | "identity" | undefined {
  const active = new Map<Type, Set<Type>>();
  const matchSignatures = (left: readonly Signature[], right: readonly Signature[]):
    "bound" | "identity" | undefined => {
    if (left.length !== right.length) return undefined;
    return combine(left.map((signature, index) => {
      const selected = right[index]!;
      const declaration = declarations.signatureDeclaration(signature);
      if (declaration === undefined || declarations.signatureDeclaration(selected) !== declaration) return undefined;
      const parameters = types.signatureParameterInfos(signature);
      const selectedParameters = types.signatureParameterInfos(selected);
      const result = types.returnType(signature);
      const selectedResult = types.returnType(selected);
      if (parameters.length !== selectedParameters.length || result === undefined || selectedResult === undefined) return undefined;
      const receiver = types.signatureThisParameterInfo(signature);
      const selectedReceiver = types.signatureThisParameterInfo(selected);
      if ((receiver === undefined) !== (selectedReceiver === undefined)) return undefined;
      return combine([
        match(result, selectedResult),
        ...(receiver === undefined || selectedReceiver === undefined ? [] : [match(receiver.type, selectedReceiver.type)]),
        ...parameters.map((parameter, position) => {
          const other = selectedParameters[position]!;
          return parameter.declaration !== undefined && parameter.declaration === other.declaration &&
            parameter.parameterKind === other.parameterKind ? match(parameter.type, other.type) : undefined;
        }),
      ]);
    }));
  };
  const match = (left: Type, right: Type): "bound" | "identity" | undefined => {
    const symbol = declarations.typeSymbol(left);
    const declaration = symbol === undefined ? undefined : declarations.primarySymbolDeclaration(symbol);
    const binding = declaration === undefined ? undefined : bindingFor(declaration);
    if (binding !== undefined) {
      if (left === right || binding === right) return "bound";
      if (types.couldContainTypeVariables(binding) || types.couldContainTypeVariables(right)) return undefined;
      return types.isIdentical(binding, right) ? "bound" : undefined;
    }
    if (left === right) return "identity";
    if (active.get(left)?.has(right)) return undefined;
    const pairs = active.get(left) ?? new Set<Type>();
    active.set(left, pairs);
    pairs.add(right);
    try {
      const leftAlias = types.aliasApplication(left);
      const rightAlias = types.aliasApplication(right);
      if (leftAlias !== undefined && rightAlias !== undefined && leftAlias.declaration === rightAlias.declaration) {
        if (leftAlias.bindings.length !== rightAlias.bindings.length) return undefined;
        const results = leftAlias.bindings.map((argument, index) => {
          const other = rightAlias.bindings[index]!;
          return argument.declaration === other.declaration ? match(argument.argument, other.argument) : undefined;
        });
        return combine(results);
      }
      const leftTarget = types.isTypeReference(left) ? types.typeReferenceTarget(left) : undefined;
      const rightTarget = types.isTypeReference(right) ? types.typeReferenceTarget(right) : undefined;
      const leftSymbol = leftTarget === undefined ? undefined : declarations.typeSymbol(leftTarget);
      const rightSymbol = rightTarget === undefined ? undefined : declarations.typeSymbol(rightTarget);
      const leftDeclaration = leftSymbol === undefined ? undefined : declarations.primarySymbolDeclaration(leftSymbol);
      const rightDeclaration = rightSymbol === undefined ? undefined : declarations.primarySymbolDeclaration(rightSymbol);
      if (leftTarget !== undefined && rightTarget !== undefined &&
        (leftTarget === rightTarget || leftDeclaration !== undefined && leftDeclaration === rightDeclaration)) {
        const leftArguments = types.typeArguments(left);
        const rightArguments = types.typeArguments(right);
        return leftArguments.length === rightArguments.length
          ? combine(leftArguments.map((argument, index) => match(argument, rightArguments[index]!)))
          : undefined;
      }
      if (leftTarget !== undefined || rightTarget !== undefined) return undefined;
      if (types.isUnion(left) && types.isUnion(right)) {
        const leftMembers = types.unionOrIntersectionTypes(left);
        const remaining = new Set(types.unionOrIntersectionTypes(right));
        if (leftMembers.length !== remaining.size) return undefined;
        const results: ("bound" | "identity")[] = [];
        for (const member of leftMembers) {
          const candidates = [...remaining].flatMap(other => {
            const result = match(member, other);
            return result === undefined ? [] : [{ other, result }];
          });
          if (candidates.length !== 1) return undefined;
          remaining.delete(candidates[0]!.other);
          results.push(candidates[0]!.result);
        }
        return combine(results);
      }
      const otherSymbol = declarations.typeSymbol(right);
      if (symbol !== undefined || otherSymbol !== undefined) {
        if (symbol === undefined || otherSymbol === undefined || declaration === undefined ||
          declarations.primarySymbolDeclaration(otherSymbol) !== declaration) return undefined;
        const relation = types.structuralMembers(right, left);
        if (relation.kind !== "available" || relation.members.length !== types.propertyInfos(right).length ||
          relation.source.indexes.length !== relation.destination.indexes.length) return undefined;
        return combine([
          ...relation.members.map(member => {
            if (member.kind !== "present" || member.source.read !== member.destination.read ||
              member.source.property.optional !== member.destination.property.optional ||
              member.source.property.readonly !== member.destination.property.readonly ||
              member.destination.declarations.length === 0 ||
              member.source.declarations.length !== member.destination.declarations.length ||
              member.destination.declarations.some(node => !member.source.declarations.includes(node))) return undefined;
            return match(member.destination.property.type, member.source.property.type);
          }),
          matchSignatures(relation.destination.calls, relation.source.calls),
          matchSignatures(relation.destination.constructs, relation.source.constructs),
          ...relation.destination.indexes.map((entry, index) => {
            const other = relation.source.indexes[index]!;
            return entry.declaration === undefined || entry.declaration !== other.declaration || entry.readonly !== other.readonly ||
              entry.keyType === undefined || entry.valueType === undefined || other.keyType === undefined || other.valueType === undefined
              ? undefined : combine([match(entry.keyType, other.keyType), match(entry.valueType, other.valueType)]);
          }),
        ]);
      }
      if (types.couldContainTypeVariables(left) || types.couldContainTypeVariables(right)) return undefined;
      const leftString = types.stringLiteralValue(left);
      const rightString = types.stringLiteralValue(right);
      if (leftString !== undefined || rightString !== undefined) {
        return leftString === rightString ? "identity" : undefined;
      }
      return types.isIdentical(left, right) ? "identity" : undefined;
    } finally {
      pairs.delete(right);
      if (pairs.size === 0) active.delete(left);
    }
  };
  return match(authored, selected);
}

function combine(results: readonly ("bound" | "identity" | undefined)[]): "bound" | "identity" | undefined {
  return results.some(result => result === undefined) ? undefined
    : results.includes("bound") ? "bound" : "identity";
}
