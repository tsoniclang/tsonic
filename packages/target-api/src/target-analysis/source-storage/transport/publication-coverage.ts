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
  return (ancestor: SourceStoragePublication, current: SourceStoragePublication): boolean => {
    const ancestorSubject = ancestor.receiver?.subject ?? ancestor.subject;
    const currentSubject = current.receiver?.subject ?? current.subject;
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
