import type { Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceStorageIsScalarType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageIsDataMember, type SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageScope } from "../graph/scoped-model.js";
import type { SourceStorageDomainWitness } from "../graph/domain-witnesses.js";
import type { SourceStoragePublication } from "../graph/domain-publications.js";
import type { createSourceStorageTransport } from "./transport.js";

export function createSourceStoragePublicationCoverage(
  source: TargetSourceProgram,
  transport: ReturnType<typeof createSourceStorageTransport>,
  budget: SourceStorageBudget,
  boundariesFor: (subject: SourceStorageSubject, bindings: SourceStorageScope) => readonly SourceStorageDomainWitness[],
) {
  const { ast, semantics } = source;
  const typeKeys = new Map<Type, number>();
  const constructorEdges = new Map<Type, ReadonlySet<string> | undefined>();
  const edgesOf = (root: Type, types: ReturnType<TargetSourceProgram["semantics"]["forFile"]>["types"]) => {
    if (constructorEdges.has(root)) return constructorEdges.get(root);
    const key = (type: Type): number => {
      const existing = typeKeys.get(type);
      if (existing !== undefined) return existing;
      typeKeys.set(type, typeKeys.size);
      return typeKeys.size - 1;
    };
    const edges = new Set<string>();
    const visited = new Set<string>();
    const pending: { readonly type: Type; readonly parent: number; readonly position: number }[] = [{ type: root, parent: -1, position: 0 }];
    let failed = false;
    while (pending.length !== 0) {
      if (!budget.step()) { failed = true; break; }
      const { type, parent, position } = pending.pop()!;
      const occurrence = `${key(type)}:${parent}:${position}`;
      if (visited.has(occurrence)) continue;
      visited.add(occurrence);
      if (types.isUnion(type) || types.isIntersection(type)) {
        for (const member of types.unionOrIntersectionTypes(type)) pending.push({ type: member, parent, position });
        continue;
      }
      const target = types.isTypeReference(type) ? types.typeReferenceTarget(type) : undefined;
      const constructor = key(target ?? type);
      edges.add(`${parent}:${position}:${constructor}`);
      if (target !== undefined && target !== type) types.typeArguments(type).forEach((argument, index) =>
        pending.push({ type: argument, parent: constructor, position: index }));
    }
    const selected = failed ? undefined : edges;
    constructorEdges.set(root, selected);
    return selected;
  };
  const recursiveInstantiationCovers = (ancestor: Type, current: Type,
    types: ReturnType<TargetSourceProgram["semantics"]["forFile"]>["types"]): boolean => {
    if (ancestor === current || !types.isTypeReference(ancestor) || !types.isTypeReference(current) ||
      types.typeReferenceTarget(ancestor) !== types.typeReferenceTarget(current)) return false;
    const covering = edgesOf(ancestor, types);
    const repeated = edgesOf(current, types);
    return covering !== undefined && repeated !== undefined && [...repeated].every(edge => covering.has(edge));
  };
  return (ancestor: SourceStoragePublication, current: SourceStoragePublication): boolean => {
    const ancestorSubject = ancestor.receiver?.subject ?? ancestor.subject;
    const currentSubject = current.receiver?.subject ?? current.subject;
    if (ancestor.subject === current.subject && ancestor.receiver?.subject === current.receiver?.subject &&
      recursiveInstantiationCovers(ancestor.type, current.type, semantics.forFile(current.sourceFile).types)) return true;
    if (!semantics.forFile(current.sourceFile).types.isIdentical(ancestor.type, current.type) ||
      ancestorSubject.node !== currentSubject.node || ancestorSubject.kind !== currentSubject.kind ||
      ancestorSubject.projection.length >= currentSubject.projection.length ||
      transport.subject(currentSubject.node, currentSubject.kind,
        currentSubject.projection.slice(0, ancestorSubject.projection.length)) !== ancestorSubject) return false;
    if (boundariesFor(ancestorSubject, ancestor.bindings).some(boundary => boundary.exposure === current.exposure &&
      (boundary.kind === "external-input" && (boundary.owner === current.inputOwner ||
        boundary.owner === undefined && ancestorSubject === current.inputOwner) ||
        boundary.kind === "external-write" || boundary.kind === "opaque-write"))) return true;
    const types = semantics.forFile(current.sourceFile).types;
    const original = sourceStorageSubjectType(source, ancestorSubject, transport.sourceFileFor(ancestorSubject));
    const repeated = sourceStorageSubjectType(source, currentSubject, transport.sourceFileFor(currentSubject));
    if (original === undefined || repeated === undefined || !types.isIdentical(original, repeated) ||
      types.isAny(original) || types.isUnknown(original) || types.couldContainTypeVariables(original)) return false;
    const alternatives = types.isUnion(current.type) ? types.unionOrIntersectionTypes(current.type) : [current.type];
    return alternatives.every(present => {
      if (!budget.step()) return false;
      if (types.isNullish(present) || sourceStorageIsScalarType(present, semantics.forFile(current.sourceFile))) return true;
      if (types.isAny(present) || types.isUnknown(present) || types.couldContainTypeVariables(present) ||
        types.callSignatures(present).length !== 0 || types.constructSignatures(present).length !== 0) return false;
      const indexes = types.indexInfos(present);
      const properties = types.propertyInfos(present);
      if (indexes.length === 0 && properties.length === 0) return false;
      return indexes.every(index => index.readonly) && properties.every(property =>
        property.readonly && [property.symbol, ...property.rootSymbols].every(symbol =>
          semantics.forFile(current.sourceFile).declarations.symbolDeclarations(symbol).every(declaration =>
            sourceStorageIsDataMember(declaration, ast))));
    });
  };
}
