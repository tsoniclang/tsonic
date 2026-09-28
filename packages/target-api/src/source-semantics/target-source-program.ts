import type { CheckedSourceProgram, SourceFile } from "@tsonic/tsts";
import { createSourceProgramNavigation } from "../source-navigation/index.js";
import { createSourceProgramDocuments } from "./source-documents.js";
import { createSourceProgramSemantics } from "./program-queries.js";
import type { TargetSourceProgram } from "./types.js";

export type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
export type {
  SourceAuthoredTypeSelection,
  SourceContextualValueTypeSelection,
  SourceContextualTupleLiteralSelection,
  SourceAuthoredOccurrence,
  SourceDocument,
  SourceFactSubjectQueries,
  SourceFileSemantics,
  SourceTypeQueries,
  SourceOccurrence,
  SourceOccurrenceLookup,
  SourceOperationEvidenceQueries,
  SourceProgramSemantics,
  SourceSemanticFactQueries,
  SourceProgramDocuments,
  SourceSelectedDeclarationQueries,
  SourceSyntheticOccurrence,
  SourceTypeRelationship,
  SourceTypeRefinement,
  SourceCallableTypeEvidence,
  SourceCallableParameterEvidence,
  SourceStandardTypeTransformation,
  SourceTypeComponentEvidence,
  SourceValueTypeRefinementSelection,
  TargetSourceProgram,
} from "./types.js";

export { createSourceProgramSemantics } from "./program-queries.js";
export type { SourceTypeArgumentBinding } from "./type-arguments.js";
export type { SourceStructuralMember, SourceStructuralMemberPair, SourceStructuralTypeMembers, SourceStructuralMemberCorrespondence } from "./structural-members.js";

export {
  sourceTypeSyntaxIsCompositional,
} from "./type-syntax.js";
export {
  orderEnumerableOwnStringProperties,
} from "./enumerable-own-properties.js";
export {
  selectSourceObjectLiteralAccessors,
} from "./object-literal-accessors.js";
export {
  sourceCallableUsesLexicalThis,
} from "./lexical-this.js";
export type {
  SourceObjectLiteralAccessorMember,
  SourceObjectLiteralAccessorOccurrence,
  SourceObjectLiteralAccessorSelection,
} from "./object-literal-accessors.js";
export type {
  SourceCallParameterSlot,
} from "./call-parameter-slots.js";
export {
  sourcePropertyTypeEvidenceNodes,
  sourceIndexedPropertyTypeEvidence,
  sourceTransformedTypeFactEvidenceNodes,
  sourceTupleElementTypeEvidenceNodes,
} from "./type-component-evidence.js";

export function createTargetSourceProgram(source: CheckedSourceProgram): TargetSourceProgram {
  const sourceFiles = Object.freeze(
    source.sourceFiles.filter((file): file is SourceFile => file !== undefined),
  );
  const navigation = createSourceProgramNavigation(source);
  return Object.freeze({
    ast: source.ast,
    sourceFiles,
    documents: createSourceProgramDocuments(source.ast, sourceFiles),
    sourceFacts: source.sourceFacts,
    navigation,
    semantics: createSourceProgramSemantics(source, {
      getFact: (subject, key) => source.sourceFacts.getFact(subject, key),
      hasFacts: subject => source.sourceFacts.getFacts(subject).length !== 0,
      getVirtualDeclarationDocument: name => source.sourceFacts.getVirtualDeclarationDocument(name),
    }, navigation),
  });
}
