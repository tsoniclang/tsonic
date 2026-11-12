import type { TokenFlag, ImportPhaseModifierSyntaxKind, NodeList, ModifierList, Identifier, ImportDeclaration, ExternalModuleReference, NamespaceImport, NamedImports, ExportAssignment, NamespaceExportDeclaration, NamespaceExport, NamedExports, ExportSpecifier, ImportAttributes, JsxElement, JsxAttributes, JsxNamespacedName, JsxOpeningElement, JsxSelfClosingElement, JsxFragment, JsxOpeningFragment, JsxClosingFragment, JsxAttribute, JsxSpreadAttribute, JsxClosingElement, JsxExpression, JsxText, SyntaxList, SourceFile, CommentDirective, Pragma, CheckJsDirective, ModuleDeclaration, ImportEqualsDeclaration, ExportDeclaration, ImportTypeNode, ImportClause, ImportSpecifier, Expression, Statement, TypeNode, NodeBody, ModuleName, ModuleExportName, ModuleReference, NamedImportBindings, NamedExportBindings, EntityName, JsxChild, JsxAttributeLike, JsxAttributeName, JsxAttributeValue, JsxTagNameExpression, EndOfFile, DotDotDotToken, AsteriskToken, SyntaxNode } from "../ir-hir/contract.js";
import type { TypedType, TypedImport, TypedImportBinding, TypedModuleReference, TypedExport, TypedExportBinding, TypedExportAssignment, TypedNamespace, TypedSourceFile, TypedPhase } from "../ir-tir/contract.js";
import type { Cursor, TextStep } from "./parse-values.js";
import type { SyntaxValue, SyntaxReadPorts } from "./parse-syntax-values.js";
import { readString, readBoolean, readNull, readStringChoice, atomicText, fieldText, nullableText, arrayText } from "./parse-values.js";
import { readTypedImportText, readTypedModuleReferenceText, readTypedImportBindingText, readTypedExportAssignmentText, readTypedExportBindingText, readTypedTypeText, readTypedSourceFileText, readTypedNamespaceText, readTypedExportText } from "./parse-phase-declarations.js";
import { resolveSyntaxValue, readSyntaxRecord, finishSyntaxRecord, readSyntaxReference, readSyntaxArray, readNullableSyntax, readSyntaxList, readCommentDirective, readPragma, readCheckJsDirective } from "./parse-syntax-values.js";

export function readImportDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportDeclaration" | "JSImportDeclaration", finish: (value: SyntaxValue<ImportDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<ImportClause<TypedPhase> | null>, Root>(cursor, fields, "importClause", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ImportClause, done), done), importClauseValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "moduleSpecifier", (next, done) => readSyntaxReference(next, ports.Expression, done), moduleSpecifierValue =>
    fieldText<SyntaxValue<ImportAttributes<TypedPhase> | null>, Root>(cursor, fields, "attributes", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ImportAttributes, done), done), attributesValue =>
    fieldText<TypedImport, Root>(cursor, fields, "tsonic", readTypedImportText, tsonicValue =>
    finishSyntaxRecord<ImportDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(importClauseValue, importClauseResolved => resolveSyntaxValue(moduleSpecifierValue, moduleSpecifierResolved => resolveSyntaxValue(attributesValue, attributesResolved => ({ ...header, kind, modifiers: modifiersResolved, importClause: importClauseResolved, moduleSpecifier: moduleSpecifierResolved, attributes: attributesResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readExternalModuleReferenceSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ExternalModuleReference", finish: (value: SyntaxValue<ExternalModuleReference<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedModuleReference, Root>(cursor, fields, "tsonic", readTypedModuleReferenceText, tsonicValue =>
    finishSyntaxRecord<ExternalModuleReference<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readNamespaceImportSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NamespaceImport", finish: (value: SyntaxValue<NamespaceImport<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<TypedImportBinding, Root>(cursor, fields, "tsonic", readTypedImportBindingText, tsonicValue =>
    finishSyntaxRecord<NamespaceImport<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, name: nameResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readNamedImportsSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NamedImports", finish: (value: SyntaxValue<NamedImports<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<ImportSpecifier<TypedPhase>>>, Root>(cursor, fields, "elements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ImportSpecifier, done), "NodeList", done), elementsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<NamedImports<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(elementsValue, elementsResolved => ({ ...header, kind, elements: elementsResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readExportAssignmentSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ExportAssignment", finish: (value: SyntaxValue<ExportAssignment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<boolean, Root>(cursor, fields, "isExportEquals", (next, done) => atomicText(next, readBoolean, done), isExportEqualsValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedExportAssignment, Root>(cursor, fields, "tsonic", readTypedExportAssignmentText, tsonicValue =>
    finishSyntaxRecord<ExportAssignment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, modifiers: modifiersResolved, isExportEquals: isExportEqualsValue, type: typeResolved, expression: expressionResolved, tsonic: tsonicValue })))),
    }, finish)))))));
}

export function readNamespaceExportDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NamespaceExportDeclaration", finish: (value: SyntaxValue<NamespaceExportDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<TypedExportBinding, Root>(cursor, fields, "tsonic", readTypedExportBindingText, tsonicValue =>
    finishSyntaxRecord<NamespaceExportDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readNamespaceExportSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NamespaceExport", finish: (value: SyntaxValue<NamespaceExport<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModuleExportName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.ModuleExportName, done), nameValue =>
    fieldText<TypedExportBinding, Root>(cursor, fields, "tsonic", readTypedExportBindingText, tsonicValue =>
    finishSyntaxRecord<NamespaceExport<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, name: nameResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readNamedExportsSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NamedExports", finish: (value: SyntaxValue<NamedExports<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<ExportSpecifier<TypedPhase>>>, Root>(cursor, fields, "elements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ExportSpecifier, done), "NodeList", done), elementsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<NamedExports<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(elementsValue, elementsResolved => ({ ...header, kind, elements: elementsResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readExportSpecifierSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ExportSpecifier", finish: (value: SyntaxValue<ExportSpecifier<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<boolean, Root>(cursor, fields, "isTypeOnly", (next, done) => atomicText(next, readBoolean, done), isTypeOnlyValue =>
    fieldText<SyntaxValue<ModuleExportName<TypedPhase> | null>, Root>(cursor, fields, "propertyName", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ModuleExportName, done), done), propertyNameValue =>
    fieldText<SyntaxValue<ModuleExportName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.ModuleExportName, done), nameValue =>
    fieldText<TypedExportBinding, Root>(cursor, fields, "tsonic", readTypedExportBindingText, tsonicValue =>
    finishSyntaxRecord<ExportSpecifier<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(propertyNameValue, propertyNameResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, isTypeOnly: isTypeOnlyValue, propertyName: propertyNameResolved, name: nameResolved, tsonic: tsonicValue }))),
    }, finish))))));
}

export function readJsxElementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxElement", finish: (value: SyntaxValue<JsxElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<JsxOpeningElement<TypedPhase>>, Root>(cursor, fields, "openingElement", (next, done) => readSyntaxReference(next, ports.JsxOpeningElement, done), openingElementValue =>
    fieldText<SyntaxValue<NodeList<JsxChild<TypedPhase>>>, Root>(cursor, fields, "children", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JsxChild, done), "NodeList", done), childrenValue =>
    fieldText<SyntaxValue<JsxClosingElement<TypedPhase>>, Root>(cursor, fields, "closingElement", (next, done) => readSyntaxReference(next, ports.JsxClosingElement, done), closingElementValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(openingElementValue, openingElementResolved => resolveSyntaxValue(childrenValue, childrenResolved => resolveSyntaxValue(closingElementValue, closingElementResolved => ({ ...header, kind, openingElement: openingElementResolved, children: childrenResolved, closingElement: closingElementResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJsxAttributesSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxAttributes", finish: (value: SyntaxValue<JsxAttributes<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<JsxAttributeLike<TypedPhase>>>, Root>(cursor, fields, "properties", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JsxAttributeLike, done), "NodeList", done), propertiesValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxAttributes<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(propertiesValue, propertiesResolved => ({ ...header, kind, properties: propertiesResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJsxNamespacedNameSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxNamespacedName", finish: (value: SyntaxValue<JsxNamespacedName<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "namespace", (next, done) => readSyntaxReference(next, ports.Identifier, done), namespaceValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxNamespacedName<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(namespaceValue, namespaceResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, namespace: namespaceResolved, name: nameResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJsxOpeningElementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxOpeningElement", finish: (value: SyntaxValue<JsxOpeningElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<JsxTagNameExpression<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.JsxTagNameExpression, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<JsxAttributes<TypedPhase>>, Root>(cursor, fields, "attributes", (next, done) => readSyntaxReference(next, ports.JsxAttributes, done), attributesValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxOpeningElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(attributesValue, attributesResolved => ({ ...header, kind, tagName: tagNameResolved, typeArguments: typeArgumentsResolved, attributes: attributesResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJsxSelfClosingElementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxSelfClosingElement", finish: (value: SyntaxValue<JsxSelfClosingElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<JsxTagNameExpression<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.JsxTagNameExpression, done), tagNameValue =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<JsxAttributes<TypedPhase>>, Root>(cursor, fields, "attributes", (next, done) => readSyntaxReference(next, ports.JsxAttributes, done), attributesValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxSelfClosingElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(attributesValue, attributesResolved => ({ ...header, kind, tagName: tagNameResolved, typeArguments: typeArgumentsResolved, attributes: attributesResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJsxFragmentSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxFragment", finish: (value: SyntaxValue<JsxFragment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<JsxOpeningFragment<TypedPhase>>, Root>(cursor, fields, "openingFragment", (next, done) => readSyntaxReference(next, ports.JsxOpeningFragment, done), openingFragmentValue =>
    fieldText<SyntaxValue<NodeList<JsxChild<TypedPhase>>>, Root>(cursor, fields, "children", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.JsxChild, done), "NodeList", done), childrenValue =>
    fieldText<SyntaxValue<JsxClosingFragment<TypedPhase>>, Root>(cursor, fields, "closingFragment", (next, done) => readSyntaxReference(next, ports.JsxClosingFragment, done), closingFragmentValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxFragment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(openingFragmentValue, openingFragmentResolved => resolveSyntaxValue(childrenValue, childrenResolved => resolveSyntaxValue(closingFragmentValue, closingFragmentResolved => ({ ...header, kind, openingFragment: openingFragmentResolved, children: childrenResolved, closingFragment: closingFragmentResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readJsxOpeningFragmentSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "JsxOpeningFragment", finish: (value: SyntaxValue<JsxOpeningFragment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxOpeningFragment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readJsxClosingFragmentSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "JsxClosingFragment", finish: (value: SyntaxValue<JsxClosingFragment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxClosingFragment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readJsxAttributeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxAttribute", finish: (value: SyntaxValue<JsxAttribute<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<JsxAttributeName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.JsxAttributeName, done), nameValue =>
    fieldText<SyntaxValue<JsxAttributeValue<TypedPhase> | null>, Root>(cursor, fields, "initializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.JsxAttributeValue, done), done), initializerValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxAttribute<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, name: nameResolved, initializer: initializerResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJsxSpreadAttributeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxSpreadAttribute", finish: (value: SyntaxValue<JsxSpreadAttribute<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxSpreadAttribute<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJsxClosingElementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxClosingElement", finish: (value: SyntaxValue<JsxClosingElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<JsxTagNameExpression<TypedPhase>>, Root>(cursor, fields, "tagName", (next, done) => readSyntaxReference(next, ports.JsxTagNameExpression, done), tagNameValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxClosingElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagNameValue, tagNameResolved => ({ ...header, kind, tagName: tagNameResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readJsxExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "JsxExpression", finish: (value: SyntaxValue<JsxExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<DotDotDotToken<TypedPhase> | null>, Root>(cursor, fields, "dotDotDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.DotDotDotToken, done), done), dotDotDotTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "expression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(dotDotDotTokenValue, dotDotDotTokenResolved => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, dotDotDotToken: dotDotDotTokenResolved, expression: expressionResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readJsxTextSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "JsxText", finish: (value: SyntaxValue<JsxText<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<boolean, Root>(cursor, fields, "containsOnlyTriviaWhiteSpaces", (next, done) => atomicText(next, readBoolean, done), containsOnlyTriviaWhiteSpacesValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<JsxText<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, containsOnlyTriviaWhiteSpaces: containsOnlyTriviaWhiteSpacesValue, tsonic: tsonicValue }),
    }, finish))))));
}

export function readSyntaxListSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SyntaxList", finish: (value: SyntaxValue<SyntaxList<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<readonly (SyntaxNode<TypedPhase>)[]>, Root>(cursor, fields, "children", (next, done) => readSyntaxArray(next, (next, done) => readSyntaxReference(next, ports.SyntaxNode, done), done), childrenValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<SyntaxList<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(childrenValue, childrenResolved => ({ ...header, kind, children: childrenResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readSourceFileSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SourceFile", finish: (value: SyntaxValue<SourceFile<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<Statement<TypedPhase>>>, Root>(cursor, fields, "statements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Statement, done), "NodeList", done), statementsValue =>
    fieldText<SyntaxValue<EndOfFile<TypedPhase>>, Root>(cursor, fields, "endOfFileToken", (next, done) => readSyntaxReference(next, ports.EndOfFile, done), endOfFileTokenValue =>
    fieldText<"Standard" | "JSX", Root>(cursor, fields, "languageVariant", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["Standard","JSX"]), done), languageVariantValue =>
    fieldText<"Unknown" | "JS" | "JSX" | "TS" | "TSX" | "External" | "JSON" | "Deferred", Root>(cursor, fields, "scriptKind", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["Unknown","JS","JSX","TS","TSX","External","JSON","Deferred"]), done), scriptKindValue =>
    fieldText<readonly CommentDirective[], Root>(cursor, fields, "commentDirectives", (next, done) => arrayText(next, (next, done) => atomicText(next, readCommentDirective, done), done), commentDirectivesValue =>
    fieldText<readonly Pragma[], Root>(cursor, fields, "pragmas", (next, done) => arrayText(next, (next, done) => atomicText(next, readPragma, done), done), pragmasValue =>
    fieldText<CheckJsDirective | null, Root>(cursor, fields, "checkJsDirective", (next, done) => nullableText(next, (next, done) => atomicText(next, readCheckJsDirective, done), done), checkJsDirectiveValue =>
    fieldText<TypedSourceFile, Root>(cursor, fields, "tsonic", readTypedSourceFileText, tsonicValue =>
    finishSyntaxRecord<SourceFile<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(statementsValue, statementsResolved => resolveSyntaxValue(endOfFileTokenValue, endOfFileTokenResolved => ({ ...header, kind, statements: statementsResolved, endOfFileToken: endOfFileTokenResolved, languageVariant: languageVariantValue, scriptKind: scriptKindValue, commentDirectives: commentDirectivesValue, pragmas: pragmasValue, checkJsDirective: checkJsDirectiveValue, tsonic: tsonicValue }))),
    }, finish))))))))));
}

export function readModuleDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ModuleDeclaration", finish: (value: SyntaxValue<ModuleDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<NodeBody<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.NodeBody, done), done), bodyValue =>
    fieldText<"ModuleKeyword" | "NamespaceKeyword", Root>(cursor, fields, "keyword", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["ModuleKeyword","NamespaceKeyword"]), done), keywordValue =>
    fieldText<SyntaxValue<ModuleName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.ModuleName, done), nameValue =>
    fieldText<TypedNamespace, Root>(cursor, fields, "tsonic", readTypedNamespaceText, tsonicValue =>
    finishSyntaxRecord<ModuleDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, modifiers: modifiersResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, keyword: keywordValue, name: nameResolved, tsonic: tsonicValue }))))),
    }, finish))))))));
}

export function readImportEqualsDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportEqualsDeclaration", finish: (value: SyntaxValue<ImportEqualsDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<boolean, Root>(cursor, fields, "isTypeOnly", (next, done) => atomicText(next, readBoolean, done), isTypeOnlyValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<SyntaxValue<ModuleReference<TypedPhase>>, Root>(cursor, fields, "moduleReference", (next, done) => readSyntaxReference(next, ports.ModuleReference, done), moduleReferenceValue =>
    fieldText<TypedImportBinding, Root>(cursor, fields, "tsonic", readTypedImportBindingText, tsonicValue =>
    finishSyntaxRecord<ImportEqualsDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(moduleReferenceValue, moduleReferenceResolved => ({ ...header, kind, modifiers: modifiersResolved, isTypeOnly: isTypeOnlyValue, name: nameResolved, moduleReference: moduleReferenceResolved, tsonic: tsonicValue })))),
    }, finish)))))));
}

export function readExportDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ExportDeclaration", finish: (value: SyntaxValue<ExportDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<boolean, Root>(cursor, fields, "isTypeOnly", (next, done) => atomicText(next, readBoolean, done), isTypeOnlyValue =>
    fieldText<SyntaxValue<NamedExportBindings<TypedPhase> | null>, Root>(cursor, fields, "exportClause", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.NamedExportBindings, done), done), exportClauseValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "moduleSpecifier", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), moduleSpecifierValue =>
    fieldText<SyntaxValue<ImportAttributes<TypedPhase> | null>, Root>(cursor, fields, "attributes", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ImportAttributes, done), done), attributesValue =>
    fieldText<TypedExport, Root>(cursor, fields, "tsonic", readTypedExportText, tsonicValue =>
    finishSyntaxRecord<ExportDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(exportClauseValue, exportClauseResolved => resolveSyntaxValue(moduleSpecifierValue, moduleSpecifierResolved => resolveSyntaxValue(attributesValue, attributesResolved => ({ ...header, kind, modifiers: modifiersResolved, isTypeOnly: isTypeOnlyValue, exportClause: exportClauseResolved, moduleSpecifier: moduleSpecifierResolved, attributes: attributesResolved, tsonic: tsonicValue }))))),
    }, finish))))))));
}

export function readImportTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportType", finish: (value: SyntaxValue<ImportTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<boolean, Root>(cursor, fields, "isTypeOf", (next, done) => atomicText(next, readBoolean, done), isTypeOfValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "argument", (next, done) => readSyntaxReference(next, ports.TypeNode, done), argumentValue =>
    fieldText<SyntaxValue<ImportAttributes<TypedPhase> | null>, Root>(cursor, fields, "attributes", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ImportAttributes, done), done), attributesValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase> | null>, Root>(cursor, fields, "qualifier", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.EntityName, done), done), qualifierValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<ImportTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(argumentValue, argumentResolved => resolveSyntaxValue(attributesValue, attributesResolved => resolveSyntaxValue(qualifierValue, qualifierResolved => ({ ...header, kind, typeArguments: typeArgumentsResolved, isTypeOf: isTypeOfValue, argument: argumentResolved, attributes: attributesResolved, qualifier: qualifierResolved, tsonic: tsonicValue }))))),
    }, finish))))))));
}

export function readImportClauseSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportClause", finish: (value: SyntaxValue<ImportClause<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<ImportPhaseModifierSyntaxKind | null, Root>(cursor, fields, "phaseModifier", (next, done) => nullableText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["TypeKeyword","DeferKeyword"]), done), done), phaseModifierValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), nameValue =>
    fieldText<SyntaxValue<NamedImportBindings<TypedPhase> | null>, Root>(cursor, fields, "namedBindings", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.NamedImportBindings, done), done), namedBindingsValue =>
    fieldText<TypedImportBinding, Root>(cursor, fields, "tsonic", readTypedImportBindingText, tsonicValue =>
    finishSyntaxRecord<ImportClause<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(namedBindingsValue, namedBindingsResolved => ({ ...header, kind, phaseModifier: phaseModifierValue, name: nameResolved, namedBindings: namedBindingsResolved, tsonic: tsonicValue }))),
    }, finish))))));
}

export function readImportSpecifierSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportSpecifier", finish: (value: SyntaxValue<ImportSpecifier<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<boolean, Root>(cursor, fields, "isTypeOnly", (next, done) => atomicText(next, readBoolean, done), isTypeOnlyValue =>
    fieldText<SyntaxValue<ModuleExportName<TypedPhase> | null>, Root>(cursor, fields, "propertyName", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.ModuleExportName, done), done), propertyNameValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<TypedImportBinding, Root>(cursor, fields, "tsonic", readTypedImportBindingText, tsonicValue =>
    finishSyntaxRecord<ImportSpecifier<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(propertyNameValue, propertyNameResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, isTypeOnly: isTypeOnlyValue, propertyName: propertyNameResolved, name: nameResolved, tsonic: tsonicValue }))),
    }, finish))))));
}
