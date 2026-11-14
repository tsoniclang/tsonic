import type { ImportDeclaration, ExternalModuleReference, NamespaceImport, NamedImports, ExportAssignment, NamespaceExportDeclaration, NamespaceExport, NamedExports, ExportSpecifier, JsxElement, JsxAttributes, JsxNamespacedName, JsxOpeningElement, JsxSelfClosingElement, JsxFragment, JsxOpeningFragment, JsxClosingFragment, JsxAttribute, JsxSpreadAttribute, JsxClosingElement, JsxExpression, JsxText, SyntaxList, JSDoc, JSDocTypeExpression, JSDocNonNullableType, JSDocNullableType, JSDocAllType, JSDocVariadicType, JSDocOptionalType, JSDocTypeTag, JSDocUnknownTag, JSDocTemplateTag, JSDocReturnTag, JSDocPublicTag, JSDocPrivateTag, JSDocProtectedTag, JSDocReadonlyTag, JSDocOverrideTag, JSDocDeprecatedTag, JSDocSeeTag, JSDocImplementsTag, JSDocAugmentsTag, JSDocSatisfiesTag, JSDocThrowsTag, JSDocThisTag, JSDocImportTag, JSDocCallbackTag, JSDocOverloadTag, JSDocTypedefTag, JSDocSignature, JSDocNameReference, SourceFile, ModuleDeclaration, ImportEqualsDeclaration, ExportDeclaration, ImportTypeNode, ImportClause, ImportSpecifier, JSDocText, JSDocLink, JSDocLinkPlain, JSDocLinkCode, JSDocTypeLiteral, JSDocParameterOrPropertyTag } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { SyntaxTextContext, TextWork } from "./text-values.js";
import { textSyntaxHeader, field, record, sequence, token, text, boolean, textNodeList, textCommentDirective, textPragma, textCheckJsDirective } from "./text-values.js";
import { textTypedImport, textTypedModuleReference, textTypedImportBinding, textTypedExportAssignment, textTypedExportBinding, textTypedNamespaceExport, textTypedSourceFile, textTypedNamespace, textTypedExport, textTypedType } from "./text-phase-declarations.js";

export function printImportDeclaration(node: ImportDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("importClause", (node.importClause === null ? token("null") : context.reference(node.importClause))),
    field("moduleSpecifier", context.reference(node.moduleSpecifier)),
    field("attributes", (node.attributes === null ? token("null") : context.reference(node.attributes))),
    field("tsonic", textTypedImport(node.tsonic)),
  ]);
}

export function printExternalModuleReference(node: ExternalModuleReference<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedModuleReference(node.tsonic)),
  ]);
}

export function printNamespaceImport(node: NamespaceImport<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedImportBinding(node.tsonic)),
  ]);
}

export function printNamedImports(node: NamedImports<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("elements", textNodeList(node.elements, context)),
    field("tsonic", token("null")),
  ]);
}

export function printExportAssignment(node: ExportAssignment<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("isExportEquals", boolean(node.isExportEquals)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedExportAssignment(node.tsonic)),
  ]);
}

export function printNamespaceExportDeclaration(node: NamespaceExportDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedExportBinding(node.tsonic)),
  ]);
}

export function printNamespaceExport(node: NamespaceExport<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedNamespaceExport(node.tsonic)),
  ]);
}

export function printNamedExports(node: NamedExports<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("elements", textNodeList(node.elements, context)),
    field("tsonic", token("null")),
  ]);
}

export function printExportSpecifier(node: ExportSpecifier<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("isTypeOnly", boolean(node.isTypeOnly)),
    field("propertyName", (node.propertyName === null ? token("null") : context.reference(node.propertyName))),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedExportBinding(node.tsonic)),
  ]);
}

export function printJsxElement(node: JsxElement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("openingElement", context.reference(node.openingElement)),
    field("children", textNodeList(node.children, context)),
    field("closingElement", context.reference(node.closingElement)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxAttributes(node: JsxAttributes<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("properties", textNodeList(node.properties, context)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxNamespacedName(node: JsxNamespacedName<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("namespace", context.reference(node.namespace)),
    field("name", context.reference(node.name)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxOpeningElement(node: JsxOpeningElement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("attributes", context.reference(node.attributes)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxSelfClosingElement(node: JsxSelfClosingElement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("attributes", context.reference(node.attributes)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxFragment(node: JsxFragment<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("openingFragment", context.reference(node.openingFragment)),
    field("children", textNodeList(node.children, context)),
    field("closingFragment", context.reference(node.closingFragment)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxOpeningFragment(node: JsxOpeningFragment<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printJsxClosingFragment(node: JsxClosingFragment<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printJsxAttribute(node: JsxAttribute<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("name", context.reference(node.name)),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", token("null")),
  ]);
}

export function printJsxSpreadAttribute(node: JsxSpreadAttribute<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxClosingElement(node: JsxClosingElement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("tsonic", token("null")),
  ]);
}

export function printJsxExpression(node: JsxExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("dotDotDotToken", (node.dotDotDotToken === null ? token("null") : context.reference(node.dotDotDotToken))),
    field("expression", (node.expression === null ? token("null") : context.reference(node.expression))),
    field("tsonic", token("null")),
  ]);
}

export function printJsxText(node: JsxText<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("containsOnlyTriviaWhiteSpaces", boolean(node.containsOnlyTriviaWhiteSpaces)),
    field("tsonic", token("null")),
  ]);
}

export function printSyntaxList(node: SyntaxList<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("children", sequence(node.children, entry => context.reference(entry))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDoc(node: JSDoc<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("comment", textNodeList(node.comment, context)),
    field("tags", (node.tags === null ? token("null") : textNodeList(node.tags, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocTypeExpression(node: JSDocTypeExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocNonNullableType(node: JSDocNonNullableType<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocNullableType(node: JSDocNullableType<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocAllType(node: JSDocAllType<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocVariadicType(node: JSDocVariadicType<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocOptionalType(node: JSDocOptionalType<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocTypeTag(node: JSDocTypeTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", context.reference(node.typeExpression)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocUnknownTag(node: JSDocUnknownTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocTemplateTag(node: JSDocTemplateTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("constraint", context.reference(node.constraint)),
    field("typeParameters", textNodeList(node.typeParameters, context)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocReturnTag(node: JSDocReturnTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", (node.typeExpression === null ? token("null") : context.reference(node.typeExpression))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocPublicTag(node: JSDocPublicTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocPrivateTag(node: JSDocPrivateTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocProtectedTag(node: JSDocProtectedTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocReadonlyTag(node: JSDocReadonlyTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocOverrideTag(node: JSDocOverrideTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocDeprecatedTag(node: JSDocDeprecatedTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocSeeTag(node: JSDocSeeTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("nameExpression", context.reference(node.nameExpression)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocImplementsTag(node: JSDocImplementsTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("className", context.reference(node.className)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocAugmentsTag(node: JSDocAugmentsTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("className", context.reference(node.className)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocSatisfiesTag(node: JSDocSatisfiesTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", context.reference(node.typeExpression)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocThrowsTag(node: JSDocThrowsTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", (node.typeExpression === null ? token("null") : context.reference(node.typeExpression))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocThisTag(node: JSDocThisTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", context.reference(node.typeExpression)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocImportTag(node: JSDocImportTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("importClause", (node.importClause === null ? token("null") : context.reference(node.importClause))),
    field("moduleSpecifier", context.reference(node.moduleSpecifier)),
    field("attributes", (node.attributes === null ? token("null") : context.reference(node.attributes))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocCallbackTag(node: JSDocCallbackTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", context.reference(node.typeExpression)),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocOverloadTag(node: JSDocOverloadTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", context.reference(node.typeExpression)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocTypedefTag(node: JSDocTypedefTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("typeExpression", (node.typeExpression === null ? token("null") : context.reference(node.typeExpression))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocSignature(node: JSDocSignature<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocNameReference(node: JSDocNameReference<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("name", context.reference(node.name)),
    field("tsonic", token("null")),
  ]);
}

export function printSourceFile(node: SourceFile<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("statements", textNodeList(node.statements, context)),
    field("endOfFileToken", context.reference(node.endOfFileToken)),
    field("languageVariant", text(node.languageVariant)),
    field("scriptKind", text(node.scriptKind)),
    field("commentDirectives", sequence(node.commentDirectives, entry => textCommentDirective(entry))),
    field("pragmas", sequence(node.pragmas, entry => textPragma(entry))),
    field("checkJsDirective", (node.checkJsDirective === null ? token("null") : textCheckJsDirective(node.checkJsDirective))),
    field("tsonic", textTypedSourceFile(node.tsonic)),
  ]);
}

export function printModuleDeclaration(node: ModuleDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("keyword", text(node.keyword)),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedNamespace(node.tsonic)),
  ]);
}

export function printImportEqualsDeclaration(node: ImportEqualsDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("isTypeOnly", boolean(node.isTypeOnly)),
    field("name", context.reference(node.name)),
    field("moduleReference", context.reference(node.moduleReference)),
    field("tsonic", textTypedImportBinding(node.tsonic)),
  ]);
}

export function printExportDeclaration(node: ExportDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("isTypeOnly", boolean(node.isTypeOnly)),
    field("exportClause", (node.exportClause === null ? token("null") : context.reference(node.exportClause))),
    field("moduleSpecifier", (node.moduleSpecifier === null ? token("null") : context.reference(node.moduleSpecifier))),
    field("attributes", (node.attributes === null ? token("null") : context.reference(node.attributes))),
    field("tsonic", textTypedExport(node.tsonic)),
  ]);
}

export function printImportTypeNode(node: ImportTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("isTypeOf", boolean(node.isTypeOf)),
    field("argument", context.reference(node.argument)),
    field("attributes", (node.attributes === null ? token("null") : context.reference(node.attributes))),
    field("qualifier", (node.qualifier === null ? token("null") : context.reference(node.qualifier))),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printImportClause(node: ImportClause<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("phaseModifier", (node.phaseModifier === null ? token("null") : text(node.phaseModifier))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("namedBindings", (node.namedBindings === null ? token("null") : context.reference(node.namedBindings))),
    field("tsonic", node.tsonic === null ? token("null") : textTypedImportBinding(node.tsonic)),
  ]);
}

export function printImportSpecifier(node: ImportSpecifier<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("isTypeOnly", boolean(node.isTypeOnly)),
    field("propertyName", (node.propertyName === null ? token("null") : context.reference(node.propertyName))),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedImportBinding(node.tsonic)),
  ]);
}

export function printJSDocText(node: JSDocText<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", sequence(node.text, entry => text(entry))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocLink(node: JSDocLink<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", sequence(node.text, entry => text(entry))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocLinkPlain(node: JSDocLinkPlain<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", sequence(node.text, entry => text(entry))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocLinkCode(node: JSDocLinkCode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", sequence(node.text, entry => text(entry))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocTypeLiteral(node: JSDocTypeLiteral<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("jsDocPropertyTags", (node.jsDocPropertyTags === null ? token("null") : sequence(node.jsDocPropertyTags, entry => context.reference(entry)))),
    field("isArrayType", boolean(node.isArrayType)),
    field("tsonic", token("null")),
  ]);
}

export function printJSDocParameterOrPropertyTag(node: JSDocParameterOrPropertyTag<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tagName", context.reference(node.tagName)),
    field("comment", (node.comment === null ? token("null") : textNodeList(node.comment, context))),
    field("name", context.reference(node.name)),
    field("isBracketed", boolean(node.isBracketed)),
    field("typeExpression", (node.typeExpression === null ? token("null") : context.reference(node.typeExpression))),
    field("isNameFirst", boolean(node.isNameFirst)),
    field("tsonic", token("null")),
  ]);
}
