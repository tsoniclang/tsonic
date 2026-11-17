import type * as Hir from "../ir-hir/contract.js";
import { sameVector, sameNodeKind, sameNodeList } from "./syntax-compare-common.js";

export function sameJSDoc(left: Hir.JSDoc<Hir.Phase>, right: Hir.JSDoc<Hir.Phase>): boolean {
  return sameNodeList(left.comment, right.comment) &&
    (left.tags === null ? right.tags === null : right.tags !== null && sameNodeList(left.tags, right.tags));
}

export function sameJSDocAugmentsTag(left: Hir.JSDocAugmentsTag<Hir.Phase>, right: Hir.JSDocAugmentsTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocCallbackTag(left: Hir.JSDocCallbackTag<Hir.Phase>, right: Hir.JSDocCallbackTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.typeExpression, right.typeExpression) &&
    (left.name === null ? right.name === null : right.name !== null && sameNodeKind(left.name, right.name));
}

export function sameJSDocDeprecatedTag(left: Hir.JSDocDeprecatedTag<Hir.Phase>, right: Hir.JSDocDeprecatedTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocImplementsTag(left: Hir.JSDocImplementsTag<Hir.Phase>, right: Hir.JSDocImplementsTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocImportTag(left: Hir.JSDocImportTag<Hir.Phase>, right: Hir.JSDocImportTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    ((left.importClause === null) === (right.importClause === null)) &&
    sameNodeKind(left.moduleSpecifier, right.moduleSpecifier) &&
    ((left.attributes === null) === (right.attributes === null));
}

export function sameJSDocLink(left: Hir.JSDocLink<Hir.Phase>, right: Hir.JSDocLink<Hir.Phase>): boolean {
  return sameVector(left.text, right.text, Object.is) &&
    (left.name === null ? right.name === null : right.name !== null && sameNodeKind(left.name, right.name));
}

export function sameJSDocLinkCode(left: Hir.JSDocLinkCode<Hir.Phase>, right: Hir.JSDocLinkCode<Hir.Phase>): boolean {
  return sameVector(left.text, right.text, Object.is) &&
    (left.name === null ? right.name === null : right.name !== null && sameNodeKind(left.name, right.name));
}

export function sameJSDocLinkPlain(left: Hir.JSDocLinkPlain<Hir.Phase>, right: Hir.JSDocLinkPlain<Hir.Phase>): boolean {
  return sameVector(left.text, right.text, Object.is) &&
    (left.name === null ? right.name === null : right.name !== null && sameNodeKind(left.name, right.name));
}

export function sameJSDocNameReference(left: Hir.JSDocNameReference<Hir.Phase>, right: Hir.JSDocNameReference<Hir.Phase>): boolean {
  return sameNodeKind(left.name, right.name);
}

export function sameJSDocNonNullableType(left: Hir.JSDocNonNullableType<Hir.Phase>, right: Hir.JSDocNonNullableType<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function sameJSDocNullableType(left: Hir.JSDocNullableType<Hir.Phase>, right: Hir.JSDocNullableType<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function sameJSDocOptionalType(left: Hir.JSDocOptionalType<Hir.Phase>, right: Hir.JSDocOptionalType<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function sameJSDocOverloadTag(left: Hir.JSDocOverloadTag<Hir.Phase>, right: Hir.JSDocOverloadTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.typeExpression, right.typeExpression);
}

export function sameJSDocOverrideTag(left: Hir.JSDocOverrideTag<Hir.Phase>, right: Hir.JSDocOverrideTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocParameterOrPropertyTag(left: Hir.JSDocParameterOrPropertyTag<Hir.Phase, "JSDocParameterTag" | "JSDocPropertyTag">, right: Hir.JSDocParameterOrPropertyTag<Hir.Phase, "JSDocParameterTag" | "JSDocPropertyTag">): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.name, right.name) &&
    Object.is(left.isBracketed, right.isBracketed) &&
    (left.typeExpression === null ? right.typeExpression === null : right.typeExpression !== null && sameNodeKind(left.typeExpression, right.typeExpression)) &&
    Object.is(left.isNameFirst, right.isNameFirst);
}

export function sameJSDocPrivateTag(left: Hir.JSDocPrivateTag<Hir.Phase>, right: Hir.JSDocPrivateTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocProtectedTag(left: Hir.JSDocProtectedTag<Hir.Phase>, right: Hir.JSDocProtectedTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocPublicTag(left: Hir.JSDocPublicTag<Hir.Phase>, right: Hir.JSDocPublicTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocReadonlyTag(left: Hir.JSDocReadonlyTag<Hir.Phase>, right: Hir.JSDocReadonlyTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocReturnTag(left: Hir.JSDocReturnTag<Hir.Phase>, right: Hir.JSDocReturnTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    (left.typeExpression === null ? right.typeExpression === null : right.typeExpression !== null && sameNodeKind(left.typeExpression, right.typeExpression));
}

export function sameJSDocSatisfiesTag(left: Hir.JSDocSatisfiesTag<Hir.Phase>, right: Hir.JSDocSatisfiesTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.typeExpression, right.typeExpression);
}

export function sameJSDocSeeTag(left: Hir.JSDocSeeTag<Hir.Phase>, right: Hir.JSDocSeeTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.nameExpression, right.nameExpression);
}

export function sameJSDocSignature(left: Hir.JSDocSignature<Hir.Phase>, right: Hir.JSDocSignature<Hir.Phase>): boolean {
  return (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameJSDocTemplateTag(left: Hir.JSDocTemplateTag<Hir.Phase>, right: Hir.JSDocTemplateTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.constraint, right.constraint) &&
    sameNodeList(left.typeParameters, right.typeParameters);
}

export function sameJSDocText(left: Hir.JSDocText<Hir.Phase>, right: Hir.JSDocText<Hir.Phase>): boolean {
  return sameVector(left.text, right.text, Object.is);
}

export function sameJSDocThisTag(left: Hir.JSDocThisTag<Hir.Phase>, right: Hir.JSDocThisTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.typeExpression, right.typeExpression);
}

export function sameJSDocThrowsTag(left: Hir.JSDocThrowsTag<Hir.Phase>, right: Hir.JSDocThrowsTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    (left.typeExpression === null ? right.typeExpression === null : right.typeExpression !== null && sameNodeKind(left.typeExpression, right.typeExpression));
}

export function sameJSDocTypeExpression(left: Hir.JSDocTypeExpression<Hir.Phase>, right: Hir.JSDocTypeExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function sameJSDocTypeLiteral(left: Hir.JSDocTypeLiteral<Hir.Phase>, right: Hir.JSDocTypeLiteral<Hir.Phase>): boolean {
  return (left.jsDocPropertyTags === null ? right.jsDocPropertyTags === null : right.jsDocPropertyTags !== null && sameVector(left.jsDocPropertyTags, right.jsDocPropertyTags, sameNodeKind)) &&
    Object.is(left.isArrayType, right.isArrayType);
}

export function sameJSDocTypeTag(left: Hir.JSDocTypeTag<Hir.Phase>, right: Hir.JSDocTypeTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    sameNodeKind(left.typeExpression, right.typeExpression);
}

export function sameJSDocTypedefTag(left: Hir.JSDocTypedefTag<Hir.Phase>, right: Hir.JSDocTypedefTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment)) &&
    (left.typeExpression === null ? right.typeExpression === null : right.typeExpression !== null && sameNodeKind(left.typeExpression, right.typeExpression)) &&
    (left.name === null ? right.name === null : right.name !== null && sameNodeKind(left.name, right.name));
}

export function sameJSDocUnknownTag(left: Hir.JSDocUnknownTag<Hir.Phase>, right: Hir.JSDocUnknownTag<Hir.Phase>): boolean {
  return (left.comment === null ? right.comment === null : right.comment !== null && sameNodeList(left.comment, right.comment));
}

export function sameJSDocVariadicType(left: Hir.JSDocVariadicType<Hir.Phase>, right: Hir.JSDocVariadicType<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}
