import { constructJSDocParameterOrPropertyTag } from "./text-syntax-construction.js";
import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  TypedPhase
} from "./contract.js";
import type {
  Origin
} from "../ids/contract.js";
import type {
  JSDoc, JSDocAllType, JSDocAugmentsTag, JSDocCallbackTag, JSDocComment, JSDocDeprecatedTag, JSDocImplementsTag, JSDocImportTag, JSDocLink, JSDocLinkCode, JSDocLinkPlain, JSDocNameReference, JSDocNonNullableType, JSDocNullableType, JSDocOptionalType, JSDocOverloadTag, JSDocOverrideTag, JSDocParameterOrPropertyTag, JSDocPrivateTag, JSDocProtectedTag, JSDocPublicTag, JSDocReadonlyTag, JSDocReturnTag, JSDocSatisfiesTag, JSDocSeeTag, JSDocSignature, JSDocTag, JSDocTemplateTag, JSDocText, JSDocThisTag, JSDocThrowsTag, JSDocTypeExpression, JSDocTypeLiteral, JSDocTypeTag, JSDocTypedefTag, JSDocUnknownTag, JSDocVariadicType, NodeList, ParameterDeclaration, TextRange, TypeParameterDeclaration
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface SyntaxDocsTextReads {
  readonly work_L_ParameterDeclaration_: TirRecordCodec<NodeList<ParameterDeclaration<TypedPhase>>>;
  readonly work_L_TypeParameterDeclaration_: TirRecordCodec<NodeList<TypeParameterDeclaration<TypedPhase>>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
}

export interface SyntaxDocsTextModel {
  readonly work_JSDoc: (value: JSDoc<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocTypeExpression: (value: JSDocTypeExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocNonNullableType: (value: JSDocNonNullableType<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocNullableType: (value: JSDocNullableType<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocAllType: (value: JSDocAllType<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocVariadicType: (value: JSDocVariadicType<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocOptionalType: (value: JSDocOptionalType<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocTypeTag: (value: JSDocTypeTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocUnknownTag: (value: JSDocUnknownTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocTemplateTag: (value: JSDocTemplateTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocReturnTag: (value: JSDocReturnTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocPublicTag: (value: JSDocPublicTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocPrivateTag: (value: JSDocPrivateTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocProtectedTag: (value: JSDocProtectedTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocReadonlyTag: (value: JSDocReadonlyTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocOverrideTag: (value: JSDocOverrideTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocDeprecatedTag: (value: JSDocDeprecatedTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocSeeTag: (value: JSDocSeeTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocImplementsTag: (value: JSDocImplementsTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocAugmentsTag: (value: JSDocAugmentsTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocSatisfiesTag: (value: JSDocSatisfiesTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocThrowsTag: (value: JSDocThrowsTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocThisTag: (value: JSDocThisTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocImportTag: (value: JSDocImportTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocCallbackTag: (value: JSDocCallbackTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocOverloadTag: (value: JSDocOverloadTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocTypedefTag: (value: JSDocTypedefTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocSignature: (value: JSDocSignature<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocNameReference: (value: JSDocNameReference<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocText: (value: JSDocText<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocLink: (value: JSDocLink<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocLinkPlain: (value: JSDocLinkPlain<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocLinkCode: (value: JSDocLinkCode<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocTypeLiteral: (value: JSDocTypeLiteral<TypedPhase>) => TirTypedRecordWork;
  readonly work_JSDocParameterOrPropertyTag: (value: JSDocParameterOrPropertyTag<TypedPhase>) => TirTypedRecordWork;
  readonly work_L_JSDocComment_: TirRecordCodec<NodeList<JSDocComment<TypedPhase>>>;
  readonly work_L_JSDocTag_: TirRecordCodec<NodeList<JSDocTag<TypedPhase>>>;
}

export const createSyntaxDocsText = (kernel: TirTextKernel, read: SyntaxDocsTextReads): SyntaxDocsTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, booleanReader, nullReader, stringReader } = kernel;
  const work_JSDoc: (value: JSDoc<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDoc<TypedPhase>>("JSDoc", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDoc", literalReader<(JSDoc<TypedPhase>)["kind"]>("'JSDoc", ["JSDoc"]))
    .field("comment", "L<JSDocComment>", value => work_L_JSDocComment_.write(value.comment), lazyReader(() => work_L_JSDocComment_.reader))
    .field("tags", "?L<JSDocTag>", value => nullableWork(value.tags, actual => work_L_JSDocTag_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocTag_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_comment, field_tags, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, comment: field_comment, tags: field_tags, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocTypeExpression: (value: JSDocTypeExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocTypeExpression<TypedPhase>>("JSDocTypeExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocTypeExpression", literalReader<(JSDocTypeExpression<TypedPhase>)["kind"]>("'JSDocTypeExpression", ["JSDocTypeExpression"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocNonNullableType: (value: JSDocNonNullableType<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocNonNullableType<TypedPhase>>("JSDocNonNullableType", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocNonNullableType", literalReader<(JSDocNonNullableType<TypedPhase>)["kind"]>("'JSDocNonNullableType", ["JSDocNonNullableType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocNullableType: (value: JSDocNullableType<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocNullableType<TypedPhase>>("JSDocNullableType", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocNullableType", literalReader<(JSDocNullableType<TypedPhase>)["kind"]>("'JSDocNullableType", ["JSDocNullableType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocAllType: (value: JSDocAllType<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocAllType<TypedPhase>>("JSDocAllType", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocAllType", literalReader<(JSDocAllType<TypedPhase>)["kind"]>("'JSDocAllType", ["JSDocAllType"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocVariadicType: (value: JSDocVariadicType<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocVariadicType<TypedPhase>>("JSDocVariadicType", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocVariadicType", literalReader<(JSDocVariadicType<TypedPhase>)["kind"]>("'JSDocVariadicType", ["JSDocVariadicType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocOptionalType: (value: JSDocOptionalType<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocOptionalType<TypedPhase>>("JSDocOptionalType", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocOptionalType", literalReader<(JSDocOptionalType<TypedPhase>)["kind"]>("'JSDocOptionalType", ["JSDocOptionalType"]))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_type, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, type: field_type, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocTypeTag: (value: JSDocTypeTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocTypeTag<TypedPhase>>("JSDocTypeTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocTypeTag", literalReader<(JSDocTypeTag<TypedPhase>)["kind"]>("'JSDocTypeTag", ["JSDocTypeTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "$SyntaxNode", value => syntaxReference("$SyntaxNode", value.typeExpression), syntaxReads.SyntaxNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocUnknownTag: (value: JSDocUnknownTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocUnknownTag<TypedPhase>>("JSDocUnknownTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocUnknownTag", literalReader<(JSDocUnknownTag<TypedPhase>)["kind"]>("'JSDocUnknownTag", ["JSDocUnknownTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocTemplateTag: (value: JSDocTemplateTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocTemplateTag<TypedPhase>>("JSDocTemplateTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocTemplateTag", literalReader<(JSDocTemplateTag<TypedPhase>)["kind"]>("'JSDocTemplateTag", ["JSDocTemplateTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("constraint", "$SyntaxNode", value => syntaxReference("$SyntaxNode", value.constraint), syntaxReads.SyntaxNode)
    .field("typeParameters", "L<TypeParameterDeclaration>", value => read.work_L_TypeParameterDeclaration_.write(value.typeParameters), lazyReader(() => read.work_L_TypeParameterDeclaration_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_constraint, field_typeParameters, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, constraint: field_constraint,
      typeParameters: field_typeParameters, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocReturnTag: (value: JSDocReturnTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocReturnTag<TypedPhase>>("JSDocReturnTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocReturnTag", literalReader<(JSDocReturnTag<TypedPhase>)["kind"]>("'JSDocReturnTag", ["JSDocReturnTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "?$TypeNode", value => nullableWork(value.typeExpression, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocPublicTag: (value: JSDocPublicTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocPublicTag<TypedPhase>>("JSDocPublicTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocPublicTag", literalReader<(JSDocPublicTag<TypedPhase>)["kind"]>("'JSDocPublicTag", ["JSDocPublicTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocPrivateTag: (value: JSDocPrivateTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocPrivateTag<TypedPhase>>("JSDocPrivateTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocPrivateTag", literalReader<(JSDocPrivateTag<TypedPhase>)["kind"]>("'JSDocPrivateTag", ["JSDocPrivateTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocProtectedTag: (value: JSDocProtectedTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocProtectedTag<TypedPhase>>("JSDocProtectedTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocProtectedTag", literalReader<(JSDocProtectedTag<TypedPhase>)["kind"]>("'JSDocProtectedTag", ["JSDocProtectedTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocReadonlyTag: (value: JSDocReadonlyTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocReadonlyTag<TypedPhase>>("JSDocReadonlyTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocReadonlyTag", literalReader<(JSDocReadonlyTag<TypedPhase>)["kind"]>("'JSDocReadonlyTag", ["JSDocReadonlyTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocOverrideTag: (value: JSDocOverrideTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocOverrideTag<TypedPhase>>("JSDocOverrideTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocOverrideTag", literalReader<(JSDocOverrideTag<TypedPhase>)["kind"]>("'JSDocOverrideTag", ["JSDocOverrideTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocDeprecatedTag: (value: JSDocDeprecatedTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocDeprecatedTag<TypedPhase>>("JSDocDeprecatedTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocDeprecatedTag", literalReader<(JSDocDeprecatedTag<TypedPhase>)["kind"]>("'JSDocDeprecatedTag", ["JSDocDeprecatedTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocSeeTag: (value: JSDocSeeTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocSeeTag<TypedPhase>>("JSDocSeeTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocSeeTag", literalReader<(JSDocSeeTag<TypedPhase>)["kind"]>("'JSDocSeeTag", ["JSDocSeeTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("nameExpression", "$TypeNode", value => syntaxReference("$TypeNode", value.nameExpression), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_nameExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, nameExpression: field_nameExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocImplementsTag: (value: JSDocImplementsTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocImplementsTag<TypedPhase>>("JSDocImplementsTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocImplementsTag", literalReader<(JSDocImplementsTag<TypedPhase>)["kind"]>("'JSDocImplementsTag", ["JSDocImplementsTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("className", "$ExpressionWithTypeArguments", value => syntaxReference("$ExpressionWithTypeArguments", value.className), syntaxReads.ExpressionWithTypeArguments)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_className, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, className: field_className, tsonic: field_tsonic }),
      (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocAugmentsTag: (value: JSDocAugmentsTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocAugmentsTag<TypedPhase>>("JSDocAugmentsTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocAugmentsTag", literalReader<(JSDocAugmentsTag<TypedPhase>)["kind"]>("'JSDocAugmentsTag", ["JSDocAugmentsTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("className", "$ExpressionWithTypeArguments", value => syntaxReference("$ExpressionWithTypeArguments", value.className), syntaxReads.ExpressionWithTypeArguments)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_className, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, className: field_className, tsonic: field_tsonic }),
      (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocSatisfiesTag: (value: JSDocSatisfiesTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocSatisfiesTag<TypedPhase>>("JSDocSatisfiesTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocSatisfiesTag", literalReader<(JSDocSatisfiesTag<TypedPhase>)["kind"]>("'JSDocSatisfiesTag", ["JSDocSatisfiesTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "$TypeNode", value => syntaxReference("$TypeNode", value.typeExpression), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocThrowsTag: (value: JSDocThrowsTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocThrowsTag<TypedPhase>>("JSDocThrowsTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocThrowsTag", literalReader<(JSDocThrowsTag<TypedPhase>)["kind"]>("'JSDocThrowsTag", ["JSDocThrowsTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "?$TypeNode", value => nullableWork(value.typeExpression, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocThisTag: (value: JSDocThisTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocThisTag<TypedPhase>>("JSDocThisTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocThisTag", literalReader<(JSDocThisTag<TypedPhase>)["kind"]>("'JSDocThisTag", ["JSDocThisTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "$TypeNode", value => syntaxReference("$TypeNode", value.typeExpression), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocImportTag: (value: JSDocImportTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocImportTag<TypedPhase>>("JSDocImportTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocImportTag", literalReader<(JSDocImportTag<TypedPhase>)["kind"]>("'JSDocImportTag", ["JSDocImportTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("importClause", "?$ImportClause", value => nullableWork(value.importClause, actual => syntaxReference("$ImportClause", actual)), nullableReader(syntaxReads.ImportClause))
    .field("moduleSpecifier", "$Expression", value => syntaxReference("$Expression", value.moduleSpecifier), syntaxReads.Expression)
    .field("attributes", "?$ImportAttributes", value => nullableWork(value.attributes, actual => syntaxReference("$ImportAttributes", actual)), nullableReader(syntaxReads.ImportAttributes))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_importClause, field_moduleSpecifier, field_attributes, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, importClause: field_importClause,
      moduleSpecifier: field_moduleSpecifier, attributes: field_attributes, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_JSDocCallbackTag: (value: JSDocCallbackTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocCallbackTag<TypedPhase>>("JSDocCallbackTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocCallbackTag", literalReader<(JSDocCallbackTag<TypedPhase>)["kind"]>("'JSDocCallbackTag", ["JSDocCallbackTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "$TypeNode", value => syntaxReference("$TypeNode", value.typeExpression), syntaxReads.TypeNode)
    .field("name", "?$JSDocFullName", value => nullableWork(value.name, actual => syntaxReference("$JSDocFullName", actual)), nullableReader(syntaxReads.JSDocFullName))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocOverloadTag: (value: JSDocOverloadTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocOverloadTag<TypedPhase>>("JSDocOverloadTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocOverloadTag", literalReader<(JSDocOverloadTag<TypedPhase>)["kind"]>("'JSDocOverloadTag", ["JSDocOverloadTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "$TypeNode", value => syntaxReference("$TypeNode", value.typeExpression), syntaxReads.TypeNode)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocTypedefTag: (value: JSDocTypedefTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocTypedefTag<TypedPhase>>("JSDocTypedefTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocTypedefTag", literalReader<(JSDocTypedefTag<TypedPhase>)["kind"]>("'JSDocTypedefTag", ["JSDocTypedefTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("typeExpression", "?$SyntaxNode", value => nullableWork(value.typeExpression, actual => syntaxReference("$SyntaxNode", actual)), nullableReader(syntaxReads.SyntaxNode))
    .field("name", "?$JSDocFullName", value => nullableWork(value.name, actual => syntaxReference("$JSDocFullName", actual)), nullableReader(syntaxReads.JSDocFullName))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_typeExpression, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, typeExpression: field_typeExpression,
      name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocSignature: (value: JSDocSignature<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocSignature<TypedPhase>>("JSDocSignature", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocSignature", literalReader<(JSDocSignature<TypedPhase>)["kind"]>("'JSDocSignature", ["JSDocSignature"]))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("parameters", "L<ParameterDeclaration>", value => read.work_L_ParameterDeclaration_.write(value.parameters), lazyReader(() => read.work_L_ParameterDeclaration_.reader))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("fullSignature", "?$TypeNode", value => nullableWork(value.fullSignature, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_typeParameters, field_parameters, field_type, field_fullSignature, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, typeParameters: field_typeParameters, parameters: field_parameters, type: field_type,
      fullSignature: field_fullSignature, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocNameReference: (value: JSDocNameReference<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocNameReference<TypedPhase>>("JSDocNameReference", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocNameReference", literalReader<(JSDocNameReference<TypedPhase>)["kind"]>("'JSDocNameReference", ["JSDocNameReference"]))
    .field("name", "$EntityName", value => syntaxReference("$EntityName", value.name), syntaxReads.EntityName)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocText: (value: JSDocText<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocText<TypedPhase>>("JSDocText", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocText", literalReader<(JSDocText<TypedPhase>)["kind"]>("'JSDocText", ["JSDocText"]))
    .field("text", "[string]", value => sequenceWork("[string]", value.text, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocLink: (value: JSDocLink<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocLink<TypedPhase>>("JSDocLink", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocLink", literalReader<(JSDocLink<TypedPhase>)["kind"]>("'JSDocLink", ["JSDocLink"]))
    .field("text", "[string]", value => sequenceWork("[string]", value.text, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .field("name", "?$EntityName", value => nullableWork(value.name, actual => syntaxReference("$EntityName", actual)), nullableReader(syntaxReads.EntityName))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_name, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocLinkPlain: (value: JSDocLinkPlain<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocLinkPlain<TypedPhase>>("JSDocLinkPlain", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocLinkPlain", literalReader<(JSDocLinkPlain<TypedPhase>)["kind"]>("'JSDocLinkPlain", ["JSDocLinkPlain"]))
    .field("text", "[string]", value => sequenceWork("[string]", value.text, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .field("name", "?$EntityName", value => nullableWork(value.name, actual => syntaxReference("$EntityName", actual)), nullableReader(syntaxReads.EntityName))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_name, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocLinkCode: (value: JSDocLinkCode<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocLinkCode<TypedPhase>>("JSDocLinkCode", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocLinkCode", literalReader<(JSDocLinkCode<TypedPhase>)["kind"]>("'JSDocLinkCode", ["JSDocLinkCode"]))
    .field("text", "[string]", value => sequenceWork("[string]", value.text, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .field("name", "?$EntityName", value => nullableWork(value.name, actual => syntaxReference("$EntityName", actual)), nullableReader(syntaxReads.EntityName))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_text, field_name, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, text: field_text, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_JSDocTypeLiteral: (value: JSDocTypeLiteral<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocTypeLiteral<TypedPhase>>("JSDocTypeLiteral", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'JSDocTypeLiteral", literalReader<(JSDocTypeLiteral<TypedPhase>)["kind"]>("'JSDocTypeLiteral", ["JSDocTypeLiteral"]))
    .field("jsDocPropertyTags", "?[$JSDocTag]", value => nullableWork(value.jsDocPropertyTags, actual => sequenceWork("[$JSDocTag]", actual, actual => syntaxReference("$JSDocTag", actual))), nullableReader(sequenceReader("[$JSDocTag]", syntaxReads.JSDocTag)))
    .field("isArrayType", "boolean", value => scalarWork("boolean", value.isArrayType), booleanReader)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_jsDocPropertyTags, field_isArrayType, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, jsDocPropertyTags: field_jsDocPropertyTags, isArrayType: field_isArrayType, tsonic: field_tsonic }),
      (kind, make) => ({ kind, value: make(kind),
    })));
  const work_JSDocParameterOrPropertyTag: (value: JSDocParameterOrPropertyTag<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<JSDocParameterOrPropertyTag<TypedPhase>>("JSDocParameterOrPropertyTag", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "JSDocParameterKind", literalReader<(JSDocParameterOrPropertyTag<TypedPhase>)["kind"]>("JSDocParameterKind", ["JSDocParameterTag","JSDocPropertyTag"]))
    .field("tagName", "$Identifier", value => syntaxReference("$Identifier", value.tagName), syntaxReads.Identifier)
    .field("comment", "?L<JSDocComment>", value => nullableWork(value.comment, actual => work_L_JSDocComment_.write(actual)), nullableReader(lazyReader(() => work_L_JSDocComment_.reader)))
    .field("name", "$EntityName", value => syntaxReference("$EntityName", value.name), syntaxReads.EntityName)
    .field("isBracketed", "boolean", value => scalarWork("boolean", value.isBracketed), booleanReader)
    .field("typeExpression", "?$TypeNode", value => nullableWork(value.typeExpression, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("isNameFirst", "boolean", value => scalarWork("boolean", value.isNameFirst), booleanReader)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tagName, field_comment, field_name, field_isBracketed, field_typeExpression, field_isNameFirst, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tagName: field_tagName, comment: field_comment, name: field_name, isBracketed: field_isBracketed,
      typeExpression: field_typeExpression, isNameFirst: field_isNameFirst, tsonic: field_tsonic,
    }), constructJSDocParameterOrPropertyTag));
  const work_L_JSDocComment_: TirRecordCodec<NodeList<JSDocComment<TypedPhase>>> = defineRecord<NodeList<JSDocComment<TypedPhase>>>("L<JSDocComment>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$JSDocComment]", value => sequenceWork("[$JSDocComment]", value.nodes, actual => syntaxReference("$JSDocComment", actual)), sequenceReader("[$JSDocComment]", syntaxReads.JSDocComment))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_JSDocTag_: TirRecordCodec<NodeList<JSDocTag<TypedPhase>>> = defineRecord<NodeList<JSDocTag<TypedPhase>>>("L<JSDocTag>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange.write(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$JSDocTag]", value => sequenceWork("[$JSDocTag]", value.nodes, actual => syntaxReference("$JSDocTag", actual)), sequenceReader("[$JSDocTag]", syntaxReads.JSDocTag))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  return { work_JSDoc, work_JSDocTypeExpression, work_JSDocNonNullableType, work_JSDocNullableType, work_JSDocAllType, work_JSDocVariadicType, work_JSDocOptionalType, work_JSDocTypeTag, work_JSDocUnknownTag, work_JSDocTemplateTag, work_JSDocReturnTag, work_JSDocPublicTag, work_JSDocPrivateTag, work_JSDocProtectedTag, work_JSDocReadonlyTag, work_JSDocOverrideTag, work_JSDocDeprecatedTag, work_JSDocSeeTag, work_JSDocImplementsTag, work_JSDocAugmentsTag, work_JSDocSatisfiesTag, work_JSDocThrowsTag, work_JSDocThisTag, work_JSDocImportTag, work_JSDocCallbackTag, work_JSDocOverloadTag, work_JSDocTypedefTag, work_JSDocSignature, work_JSDocNameReference, work_JSDocText, work_JSDocLink, work_JSDocLinkPlain, work_JSDocLinkCode, work_JSDocTypeLiteral, work_JSDocParameterOrPropertyTag, work_L_JSDocComment_, work_L_JSDocTag_ };
};
