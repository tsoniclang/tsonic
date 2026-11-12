import type { NodeList, Identifier, ParameterDeclaration, ExpressionWithTypeArguments, ImportAttributes, JSDoc, JSDocTypeExpression, JSDocNonNullableType, JSDocNullableType, JSDocAllType, JSDocVariadicType, JSDocOptionalType, JSDocTypeTag, JSDocUnknownTag, JSDocTemplateTag, JSDocReturnTag, JSDocPublicTag, JSDocPrivateTag, JSDocProtectedTag, JSDocReadonlyTag, JSDocOverrideTag, JSDocDeprecatedTag, JSDocSeeTag, JSDocImplementsTag, JSDocAugmentsTag, JSDocSatisfiesTag, JSDocThrowsTag, JSDocThisTag, JSDocImportTag, JSDocCallbackTag, JSDocOverloadTag, JSDocTypedefTag, JSDocSignature, JSDocNameReference, ImportClause, JSDocText, JSDocLink, JSDocLinkPlain, JSDocLinkCode, TypeParameterDeclaration, JSDocTypeLiteral, JSDocParameterOrPropertyTag, Expression, TypeNode, JSDocFullName, EntityName, JSDocComment, JSDocTag, SyntaxNode } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { Cursor, TextStep } from "./parse-values.js";
import type { SyntaxValue, SyntaxReadPorts } from "./parse-syntax-values.js";
import { readString, readBoolean, readNull, atomicText, fieldText, arrayText } from "./parse-values.js";
import { resolveSyntaxValue, readSyntaxRecord, finishSyntaxRecord, readSyntaxReference, readSyntaxArray, readNullableSyntax, readSyntaxList } from "./parse-syntax-values.js";

export function readJSDocSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDoc", finish: (value: SyntaxValue<JSDoc<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>>>, Root>(cursor, fields, "comment", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), commentValue =>
    fieldText<SyntaxValue<NodeList<JSDocTag<TypedPhase>> | null>, Root>(cursor, fields, "tags", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocTag, done), "NodeList", done), done), tagsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDoc<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(tagsValue, tagsResolved => ({ ...header, kind, comment: commentResolved, tags: tagsResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocTypeExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocTypeExpression", finish: (value: SyntaxValue<JSDocTypeExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocTypeExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJSDocNonNullableTypeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocNonNullableType", finish: (value: SyntaxValue<JSDocNonNullableType<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocNonNullableType<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJSDocNullableTypeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocNullableType", finish: (value: SyntaxValue<JSDocNullableType<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocNullableType<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJSDocAllTypeSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "JSDocAllType", finish: (value: SyntaxValue<JSDocAllType<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocAllType<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readJSDocVariadicTypeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocVariadicType", finish: (value: SyntaxValue<JSDocVariadicType<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocVariadicType<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJSDocOptionalTypeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocOptionalType", finish: (value: SyntaxValue<JSDocOptionalType<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocOptionalType<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJSDocTypeTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocTypeTag", finish: (value: SyntaxValue<JSDocTypeTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<SyntaxNode<TypedPhase>>, Root>(cursor, fields, "typeExpression", (next, done) => readSyntaxReference(next, ports.SyntaxNode, done), typeExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocTypeTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocUnknownTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocUnknownTag", finish: (value: SyntaxValue<JSDocUnknownTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocUnknownTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocTemplateTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocTemplateTag", finish: (value: SyntaxValue<JSDocTemplateTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<SyntaxNode<TypedPhase>>, Root>(cursor, fields, "constraint", (next, done) => readSyntaxReference(next, ports.SyntaxNode, done), constraintValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "typeParameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), typeParametersValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocTemplateTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(constraintValue, constraintResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, constraint: constraintResolved, typeParameters: typeParametersResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readJSDocReturnTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocReturnTag", finish: (value: SyntaxValue<JSDocReturnTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "typeExpression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocReturnTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocPublicTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocPublicTag", finish: (value: SyntaxValue<JSDocPublicTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocPublicTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocPrivateTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocPrivateTag", finish: (value: SyntaxValue<JSDocPrivateTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocPrivateTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocProtectedTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocProtectedTag", finish: (value: SyntaxValue<JSDocProtectedTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocProtectedTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocReadonlyTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocReadonlyTag", finish: (value: SyntaxValue<JSDocReadonlyTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocReadonlyTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocOverrideTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocOverrideTag", finish: (value: SyntaxValue<JSDocOverrideTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocOverrideTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocDeprecatedTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocDeprecatedTag", finish: (value: SyntaxValue<JSDocDeprecatedTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocDeprecatedTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJSDocSeeTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocSeeTag", finish: (value: SyntaxValue<JSDocSeeTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "nameExpression", (next, done) => readSyntaxReference(next, ports.TypeNode, done), nameExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocSeeTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(nameExpressionValue, nameExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, nameExpression: nameExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocImplementsTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocImplementsTag", finish: (value: SyntaxValue<JSDocImplementsTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<ExpressionWithTypeArguments<TypedPhase>>, Root>(cursor, fields, "className", (next, done) => readSyntaxReference(next, ports.ExpressionWithTypeArguments, done), classNameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocImplementsTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(classNameValue, classNameResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, className: classNameResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocAugmentsTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocAugmentsTag", finish: (value: SyntaxValue<JSDocAugmentsTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<ExpressionWithTypeArguments<TypedPhase>>, Root>(cursor, fields, "className", (next, done) => readSyntaxReference(next, ports.ExpressionWithTypeArguments, done), classNameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocAugmentsTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(classNameValue, classNameResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, className: classNameResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocSatisfiesTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocSatisfiesTag", finish: (value: SyntaxValue<JSDocSatisfiesTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "typeExpression", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocSatisfiesTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocThrowsTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocThrowsTag", finish: (value: SyntaxValue<JSDocThrowsTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "typeExpression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocThrowsTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocThisTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocThisTag", finish: (value: SyntaxValue<JSDocThisTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "typeExpression", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocThisTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocImportTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocImportTag", finish: (value: SyntaxValue<JSDocImportTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<ImportClause<TypedPhase> | null>, Root>(cursor, fields, "importClause", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ImportClause, done), done), importClauseValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "moduleSpecifier", (next, done) => readSyntaxReference(next, ports.Expression, done), moduleSpecifierValue =>
    fieldText<SyntaxValue<ImportAttributes<TypedPhase> | null>, Root>(cursor, fields, "attributes", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ImportAttributes, done), done), attributesValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocImportTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(importClauseValue, importClauseResolved => resolveSyntaxValue(moduleSpecifierValue, moduleSpecifierResolved => resolveSyntaxValue(attributesValue, attributesResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, importClause: importClauseResolved, moduleSpecifier: moduleSpecifierResolved, attributes: attributesResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readJSDocCallbackTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocCallbackTag", finish: (value: SyntaxValue<JSDocCallbackTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "typeExpression", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeExpressionValue =>
    fieldText<SyntaxValue<JSDocFullName<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.JSDocFullName, done), done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocCallbackTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, name: nameResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readJSDocOverloadTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocOverloadTag", finish: (value: SyntaxValue<JSDocOverloadTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "typeExpression", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeExpressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocOverloadTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJSDocTypedefTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocTypedefTag", finish: (value: SyntaxValue<JSDocTypedefTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<SyntaxNode<TypedPhase> | null>, Root>(cursor, fields, "typeExpression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.SyntaxNode, done), done), typeExpressionValue =>
    fieldText<SyntaxValue<JSDocFullName<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.JSDocFullName, done), done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocTypedefTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, typeExpression: typeExpressionResolved, name: nameResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readJSDocSignatureSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocSignature", finish: (value: SyntaxValue<JSDocSignature<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocSignature<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readJSDocNameReferenceSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocNameReference", finish: (value: SyntaxValue<JSDocNameReference<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<EntityName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.EntityName, done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocNameReference<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, name: nameResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJSDocTextSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "JSDocText", finish: (value: SyntaxValue<JSDocText<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<readonly (string)[], Root>(cursor, fields, "text", (next, done) => arrayText(next, (next, done) => atomicText(next, readString, done), done), textValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocText<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tsonic: tsonicValue }),
    }, finish))));
}

export function readJSDocLinkSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocLink", finish: (value: SyntaxValue<JSDocLink<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<readonly (string)[], Root>(cursor, fields, "text", (next, done) => arrayText(next, (next, done) => atomicText(next, readString, done), done), textValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.EntityName, done), done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocLink<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, text: textValue, name: nameResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readJSDocLinkPlainSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocLinkPlain", finish: (value: SyntaxValue<JSDocLinkPlain<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<readonly (string)[], Root>(cursor, fields, "text", (next, done) => arrayText(next, (next, done) => atomicText(next, readString, done), done), textValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.EntityName, done), done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocLinkPlain<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, text: textValue, name: nameResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readJSDocLinkCodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocLinkCode", finish: (value: SyntaxValue<JSDocLinkCode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<readonly (string)[], Root>(cursor, fields, "text", (next, done) => arrayText(next, (next, done) => atomicText(next, readString, done), done), textValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.EntityName, done), done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocLinkCode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, text: textValue, name: nameResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readJSDocTypeLiteralSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocTypeLiteral", finish: (value: SyntaxValue<JSDocTypeLiteral<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<readonly (JSDocTag<TypedPhase>)[] | null>, Root>(cursor, fields, "jsDocPropertyTags", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxArray(next, (next, done) => readSyntaxReference(next, ports.JSDocTag, done), done), done), jsDocPropertyTagsValue =>
    fieldText<boolean, Root>(cursor, fields, "isArrayType", (next, done) => atomicText(next, readBoolean, done), isArrayTypeValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocTypeLiteral<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(jsDocPropertyTagsValue, jsDocPropertyTagsResolved => ({ ...header, kind, jsDocPropertyTags: jsDocPropertyTagsResolved, isArrayType: isArrayTypeValue, tsonic: tsonicValue })),
    }, finish)))));
}

export function readJSDocParameterOrPropertyTagSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JSDocParameterTag" | "JSDocPropertyTag", finish: (value: SyntaxValue<JSDocParameterOrPropertyTag<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.Identifier, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<JSDocComment<TypedPhase>> | null>, Root>(cursor, fields, "comment", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JSDocComment, done), "NodeList", done), done), commentValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.EntityName, done), nameValue =>
    fieldText<boolean, Root>(cursor, fields, "isBracketed", (next, done) => atomicText(next, readBoolean, done), isBracketedValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "typeExpression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeExpressionValue =>
    fieldText<boolean, Root>(cursor, fields, "isNameFirst", (next, done) => atomicText(next, readBoolean, done), isNameFirstValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JSDocParameterOrPropertyTag<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(commentValue, commentResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(typeExpressionValue, typeExpressionResolved => ({ ...header, kind, tagName: tagNameResolved, comment: commentResolved, name: nameResolved, isBracketed: isBracketedValue, typeExpression: typeExpressionResolved, isNameFirst: isNameFirstValue, tsonic: tsonicValue }))))),
    }, finish)))))))));
}
