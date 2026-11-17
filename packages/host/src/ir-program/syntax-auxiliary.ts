import type {
  ImportDeclaration, ExternalModuleReference, NamespaceImport, NamedImports, ExportAssignment,
  NamespaceExportDeclaration, NamespaceExport, NamedExports, ExportSpecifier, JsxElement,
  JsxAttributes, JsxNamespacedName, JsxOpeningElement, JsxSelfClosingElement, JsxFragment,
  JsxOpeningFragment, JsxClosingFragment, JsxAttribute, JsxSpreadAttribute, JsxClosingElement,
  JsxExpression, JsxText, SyntaxList, JSDoc, JSDocTypeExpression,
  JSDocNonNullableType, JSDocNullableType, JSDocAllType, JSDocVariadicType, JSDocOptionalType,
  JSDocTypeTag, JSDocUnknownTag, JSDocTemplateTag, JSDocReturnTag, JSDocPublicTag,
  JSDocPrivateTag, JSDocProtectedTag, JSDocReadonlyTag, JSDocOverrideTag, JSDocDeprecatedTag,
  JSDocSeeTag, JSDocImplementsTag, JSDocAugmentsTag, JSDocSatisfiesTag, JSDocThrowsTag,
  JSDocThisTag, JSDocImportTag, JSDocCallbackTag, JSDocOverloadTag, JSDocTypedefTag,
  JSDocSignature, JSDocNameReference, SourceFile, ModuleDeclaration, ImportEqualsDeclaration,
  ExportDeclaration, ImportTypeNode, ImportClause, ImportSpecifier, JSDocText,
  JSDocLink, JSDocLinkPlain, JSDocLinkCode, JSDocTypeLiteral, JSDocParameterOrPropertyTag,
} from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./syntax-arena.js";
import { copyNodeList, memoSyntaxPlan, syntaxHeader } from "./syntax-arena.js";
import {
  rewriteSourceFilePhase, rewriteNamespace, rewriteType,
} from "./canonical-phase.js";

export interface AuxiliaryPlans {
  readonly ImportDeclaration: (node: ImportDeclaration<TypedPhase>) => SyntaxPlan<ImportDeclaration<TypedPhase>>;
  readonly ExternalModuleReference: (node: ExternalModuleReference<TypedPhase>) => SyntaxPlan<ExternalModuleReference<TypedPhase>>;
  readonly NamespaceImport: (node: NamespaceImport<TypedPhase>) => SyntaxPlan<NamespaceImport<TypedPhase>>;
  readonly NamedImports: (node: NamedImports<TypedPhase>) => SyntaxPlan<NamedImports<TypedPhase>>;
  readonly ExportAssignment: (node: ExportAssignment<TypedPhase>) => SyntaxPlan<ExportAssignment<TypedPhase>>;
  readonly NamespaceExportDeclaration: (node: NamespaceExportDeclaration<TypedPhase>) => SyntaxPlan<NamespaceExportDeclaration<TypedPhase>>;
  readonly NamespaceExport: (node: NamespaceExport<TypedPhase>) => SyntaxPlan<NamespaceExport<TypedPhase>>;
  readonly NamedExports: (node: NamedExports<TypedPhase>) => SyntaxPlan<NamedExports<TypedPhase>>;
  readonly ExportSpecifier: (node: ExportSpecifier<TypedPhase>) => SyntaxPlan<ExportSpecifier<TypedPhase>>;
  readonly JsxElement: (node: JsxElement<TypedPhase>) => SyntaxPlan<JsxElement<TypedPhase>>;
  readonly JsxAttributes: (node: JsxAttributes<TypedPhase>) => SyntaxPlan<JsxAttributes<TypedPhase>>;
  readonly JsxNamespacedName: (node: JsxNamespacedName<TypedPhase>) => SyntaxPlan<JsxNamespacedName<TypedPhase>>;
  readonly JsxOpeningElement: (node: JsxOpeningElement<TypedPhase>) => SyntaxPlan<JsxOpeningElement<TypedPhase>>;
  readonly JsxSelfClosingElement: (node: JsxSelfClosingElement<TypedPhase>) => SyntaxPlan<JsxSelfClosingElement<TypedPhase>>;
  readonly JsxFragment: (node: JsxFragment<TypedPhase>) => SyntaxPlan<JsxFragment<TypedPhase>>;
  readonly JsxOpeningFragment: (node: JsxOpeningFragment<TypedPhase>) => SyntaxPlan<JsxOpeningFragment<TypedPhase>>;
  readonly JsxClosingFragment: (node: JsxClosingFragment<TypedPhase>) => SyntaxPlan<JsxClosingFragment<TypedPhase>>;
  readonly JsxAttribute: (node: JsxAttribute<TypedPhase>) => SyntaxPlan<JsxAttribute<TypedPhase>>;
  readonly JsxSpreadAttribute: (node: JsxSpreadAttribute<TypedPhase>) => SyntaxPlan<JsxSpreadAttribute<TypedPhase>>;
  readonly JsxClosingElement: (node: JsxClosingElement<TypedPhase>) => SyntaxPlan<JsxClosingElement<TypedPhase>>;
  readonly JsxExpression: (node: JsxExpression<TypedPhase>) => SyntaxPlan<JsxExpression<TypedPhase>>;
  readonly JsxText: (node: JsxText<TypedPhase>) => SyntaxPlan<JsxText<TypedPhase>>;
  readonly SyntaxList: (node: SyntaxList<TypedPhase>) => SyntaxPlan<SyntaxList<TypedPhase>>;
  readonly JSDoc: (node: JSDoc<TypedPhase>) => SyntaxPlan<JSDoc<TypedPhase>>;
  readonly JSDocTypeExpression: (node: JSDocTypeExpression<TypedPhase>) => SyntaxPlan<JSDocTypeExpression<TypedPhase>>;
  readonly JSDocNonNullableType: (node: JSDocNonNullableType<TypedPhase>) => SyntaxPlan<JSDocNonNullableType<TypedPhase>>;
  readonly JSDocNullableType: (node: JSDocNullableType<TypedPhase>) => SyntaxPlan<JSDocNullableType<TypedPhase>>;
  readonly JSDocAllType: (node: JSDocAllType<TypedPhase>) => SyntaxPlan<JSDocAllType<TypedPhase>>;
  readonly JSDocVariadicType: (node: JSDocVariadicType<TypedPhase>) => SyntaxPlan<JSDocVariadicType<TypedPhase>>;
  readonly JSDocOptionalType: (node: JSDocOptionalType<TypedPhase>) => SyntaxPlan<JSDocOptionalType<TypedPhase>>;
  readonly JSDocTypeTag: (node: JSDocTypeTag<TypedPhase>) => SyntaxPlan<JSDocTypeTag<TypedPhase>>;
  readonly JSDocUnknownTag: (node: JSDocUnknownTag<TypedPhase>) => SyntaxPlan<JSDocUnknownTag<TypedPhase>>;
  readonly JSDocTemplateTag: (node: JSDocTemplateTag<TypedPhase>) => SyntaxPlan<JSDocTemplateTag<TypedPhase>>;
  readonly JSDocReturnTag: (node: JSDocReturnTag<TypedPhase>) => SyntaxPlan<JSDocReturnTag<TypedPhase>>;
  readonly JSDocPublicTag: (node: JSDocPublicTag<TypedPhase>) => SyntaxPlan<JSDocPublicTag<TypedPhase>>;
  readonly JSDocPrivateTag: (node: JSDocPrivateTag<TypedPhase>) => SyntaxPlan<JSDocPrivateTag<TypedPhase>>;
  readonly JSDocProtectedTag: (node: JSDocProtectedTag<TypedPhase>) => SyntaxPlan<JSDocProtectedTag<TypedPhase>>;
  readonly JSDocReadonlyTag: (node: JSDocReadonlyTag<TypedPhase>) => SyntaxPlan<JSDocReadonlyTag<TypedPhase>>;
  readonly JSDocOverrideTag: (node: JSDocOverrideTag<TypedPhase>) => SyntaxPlan<JSDocOverrideTag<TypedPhase>>;
  readonly JSDocDeprecatedTag: (node: JSDocDeprecatedTag<TypedPhase>) => SyntaxPlan<JSDocDeprecatedTag<TypedPhase>>;
  readonly JSDocSeeTag: (node: JSDocSeeTag<TypedPhase>) => SyntaxPlan<JSDocSeeTag<TypedPhase>>;
  readonly JSDocImplementsTag: (node: JSDocImplementsTag<TypedPhase>) => SyntaxPlan<JSDocImplementsTag<TypedPhase>>;
  readonly JSDocAugmentsTag: (node: JSDocAugmentsTag<TypedPhase>) => SyntaxPlan<JSDocAugmentsTag<TypedPhase>>;
  readonly JSDocSatisfiesTag: (node: JSDocSatisfiesTag<TypedPhase>) => SyntaxPlan<JSDocSatisfiesTag<TypedPhase>>;
  readonly JSDocThrowsTag: (node: JSDocThrowsTag<TypedPhase>) => SyntaxPlan<JSDocThrowsTag<TypedPhase>>;
  readonly JSDocThisTag: (node: JSDocThisTag<TypedPhase>) => SyntaxPlan<JSDocThisTag<TypedPhase>>;
  readonly JSDocImportTag: (node: JSDocImportTag<TypedPhase>) => SyntaxPlan<JSDocImportTag<TypedPhase>>;
  readonly JSDocCallbackTag: (node: JSDocCallbackTag<TypedPhase>) => SyntaxPlan<JSDocCallbackTag<TypedPhase>>;
  readonly JSDocOverloadTag: (node: JSDocOverloadTag<TypedPhase>) => SyntaxPlan<JSDocOverloadTag<TypedPhase>>;
  readonly JSDocTypedefTag: (node: JSDocTypedefTag<TypedPhase>) => SyntaxPlan<JSDocTypedefTag<TypedPhase>>;
  readonly JSDocSignature: (node: JSDocSignature<TypedPhase>) => SyntaxPlan<JSDocSignature<TypedPhase>>;
  readonly JSDocNameReference: (node: JSDocNameReference<TypedPhase>) => SyntaxPlan<JSDocNameReference<TypedPhase>>;
  readonly SourceFile: (node: SourceFile<TypedPhase>) => SyntaxPlan<SourceFile<TypedPhase>>;
  readonly ModuleDeclaration: (node: ModuleDeclaration<TypedPhase>) => SyntaxPlan<ModuleDeclaration<TypedPhase>>;
  readonly ImportEqualsDeclaration: (node: ImportEqualsDeclaration<TypedPhase>) => SyntaxPlan<ImportEqualsDeclaration<TypedPhase>>;
  readonly ExportDeclaration: (node: ExportDeclaration<TypedPhase>) => SyntaxPlan<ExportDeclaration<TypedPhase>>;
  readonly ImportTypeNode: (node: ImportTypeNode<TypedPhase>) => SyntaxPlan<ImportTypeNode<TypedPhase>>;
  readonly ImportClause: (node: ImportClause<TypedPhase>) => SyntaxPlan<ImportClause<TypedPhase>>;
  readonly ImportSpecifier: (node: ImportSpecifier<TypedPhase>) => SyntaxPlan<ImportSpecifier<TypedPhase>>;
  readonly JSDocText: (node: JSDocText<TypedPhase>) => SyntaxPlan<JSDocText<TypedPhase>>;
  readonly JSDocLink: (node: JSDocLink<TypedPhase>) => SyntaxPlan<JSDocLink<TypedPhase>>;
  readonly JSDocLinkPlain: (node: JSDocLinkPlain<TypedPhase>) => SyntaxPlan<JSDocLinkPlain<TypedPhase>>;
  readonly JSDocLinkCode: (node: JSDocLinkCode<TypedPhase>) => SyntaxPlan<JSDocLinkCode<TypedPhase>>;
  readonly JSDocTypeLiteral: (node: JSDocTypeLiteral<TypedPhase>) => SyntaxPlan<JSDocTypeLiteral<TypedPhase>>;
  readonly JSDocParameterOrPropertyTag: (node: JSDocParameterOrPropertyTag<TypedPhase>) => SyntaxPlan<JSDocParameterOrPropertyTag<TypedPhase>>;
}

export function createAuxiliaryPlans(rewrite: TypeRewrite, ports: () => SyntaxCopyPorts): AuxiliaryPlans {
  const ImportDeclaration = new Map<ImportDeclaration<TypedPhase>, SyntaxPlan<ImportDeclaration<TypedPhase>>>();
  const ExternalModuleReference = new Map<ExternalModuleReference<TypedPhase>, SyntaxPlan<ExternalModuleReference<TypedPhase>>>();
  const NamespaceImport = new Map<NamespaceImport<TypedPhase>, SyntaxPlan<NamespaceImport<TypedPhase>>>();
  const NamedImports = new Map<NamedImports<TypedPhase>, SyntaxPlan<NamedImports<TypedPhase>>>();
  const ExportAssignment = new Map<ExportAssignment<TypedPhase>, SyntaxPlan<ExportAssignment<TypedPhase>>>();
  const NamespaceExportDeclaration = new Map<NamespaceExportDeclaration<TypedPhase>, SyntaxPlan<NamespaceExportDeclaration<TypedPhase>>>();
  const NamespaceExport = new Map<NamespaceExport<TypedPhase>, SyntaxPlan<NamespaceExport<TypedPhase>>>();
  const NamedExports = new Map<NamedExports<TypedPhase>, SyntaxPlan<NamedExports<TypedPhase>>>();
  const ExportSpecifier = new Map<ExportSpecifier<TypedPhase>, SyntaxPlan<ExportSpecifier<TypedPhase>>>();
  const JsxElement = new Map<JsxElement<TypedPhase>, SyntaxPlan<JsxElement<TypedPhase>>>();
  const JsxAttributes = new Map<JsxAttributes<TypedPhase>, SyntaxPlan<JsxAttributes<TypedPhase>>>();
  const JsxNamespacedName = new Map<JsxNamespacedName<TypedPhase>, SyntaxPlan<JsxNamespacedName<TypedPhase>>>();
  const JsxOpeningElement = new Map<JsxOpeningElement<TypedPhase>, SyntaxPlan<JsxOpeningElement<TypedPhase>>>();
  const JsxSelfClosingElement = new Map<JsxSelfClosingElement<TypedPhase>, SyntaxPlan<JsxSelfClosingElement<TypedPhase>>>();
  const JsxFragment = new Map<JsxFragment<TypedPhase>, SyntaxPlan<JsxFragment<TypedPhase>>>();
  const JsxOpeningFragment = new Map<JsxOpeningFragment<TypedPhase>, SyntaxPlan<JsxOpeningFragment<TypedPhase>>>();
  const JsxClosingFragment = new Map<JsxClosingFragment<TypedPhase>, SyntaxPlan<JsxClosingFragment<TypedPhase>>>();
  const JsxAttribute = new Map<JsxAttribute<TypedPhase>, SyntaxPlan<JsxAttribute<TypedPhase>>>();
  const JsxSpreadAttribute = new Map<JsxSpreadAttribute<TypedPhase>, SyntaxPlan<JsxSpreadAttribute<TypedPhase>>>();
  const JsxClosingElement = new Map<JsxClosingElement<TypedPhase>, SyntaxPlan<JsxClosingElement<TypedPhase>>>();
  const JsxExpression = new Map<JsxExpression<TypedPhase>, SyntaxPlan<JsxExpression<TypedPhase>>>();
  const JsxText = new Map<JsxText<TypedPhase>, SyntaxPlan<JsxText<TypedPhase>>>();
  const SyntaxList = new Map<SyntaxList<TypedPhase>, SyntaxPlan<SyntaxList<TypedPhase>>>();
  const JSDoc = new Map<JSDoc<TypedPhase>, SyntaxPlan<JSDoc<TypedPhase>>>();
  const JSDocTypeExpression = new Map<JSDocTypeExpression<TypedPhase>, SyntaxPlan<JSDocTypeExpression<TypedPhase>>>();
  const JSDocNonNullableType = new Map<JSDocNonNullableType<TypedPhase>, SyntaxPlan<JSDocNonNullableType<TypedPhase>>>();
  const JSDocNullableType = new Map<JSDocNullableType<TypedPhase>, SyntaxPlan<JSDocNullableType<TypedPhase>>>();
  const JSDocAllType = new Map<JSDocAllType<TypedPhase>, SyntaxPlan<JSDocAllType<TypedPhase>>>();
  const JSDocVariadicType = new Map<JSDocVariadicType<TypedPhase>, SyntaxPlan<JSDocVariadicType<TypedPhase>>>();
  const JSDocOptionalType = new Map<JSDocOptionalType<TypedPhase>, SyntaxPlan<JSDocOptionalType<TypedPhase>>>();
  const JSDocTypeTag = new Map<JSDocTypeTag<TypedPhase>, SyntaxPlan<JSDocTypeTag<TypedPhase>>>();
  const JSDocUnknownTag = new Map<JSDocUnknownTag<TypedPhase>, SyntaxPlan<JSDocUnknownTag<TypedPhase>>>();
  const JSDocTemplateTag = new Map<JSDocTemplateTag<TypedPhase>, SyntaxPlan<JSDocTemplateTag<TypedPhase>>>();
  const JSDocReturnTag = new Map<JSDocReturnTag<TypedPhase>, SyntaxPlan<JSDocReturnTag<TypedPhase>>>();
  const JSDocPublicTag = new Map<JSDocPublicTag<TypedPhase>, SyntaxPlan<JSDocPublicTag<TypedPhase>>>();
  const JSDocPrivateTag = new Map<JSDocPrivateTag<TypedPhase>, SyntaxPlan<JSDocPrivateTag<TypedPhase>>>();
  const JSDocProtectedTag = new Map<JSDocProtectedTag<TypedPhase>, SyntaxPlan<JSDocProtectedTag<TypedPhase>>>();
  const JSDocReadonlyTag = new Map<JSDocReadonlyTag<TypedPhase>, SyntaxPlan<JSDocReadonlyTag<TypedPhase>>>();
  const JSDocOverrideTag = new Map<JSDocOverrideTag<TypedPhase>, SyntaxPlan<JSDocOverrideTag<TypedPhase>>>();
  const JSDocDeprecatedTag = new Map<JSDocDeprecatedTag<TypedPhase>, SyntaxPlan<JSDocDeprecatedTag<TypedPhase>>>();
  const JSDocSeeTag = new Map<JSDocSeeTag<TypedPhase>, SyntaxPlan<JSDocSeeTag<TypedPhase>>>();
  const JSDocImplementsTag = new Map<JSDocImplementsTag<TypedPhase>, SyntaxPlan<JSDocImplementsTag<TypedPhase>>>();
  const JSDocAugmentsTag = new Map<JSDocAugmentsTag<TypedPhase>, SyntaxPlan<JSDocAugmentsTag<TypedPhase>>>();
  const JSDocSatisfiesTag = new Map<JSDocSatisfiesTag<TypedPhase>, SyntaxPlan<JSDocSatisfiesTag<TypedPhase>>>();
  const JSDocThrowsTag = new Map<JSDocThrowsTag<TypedPhase>, SyntaxPlan<JSDocThrowsTag<TypedPhase>>>();
  const JSDocThisTag = new Map<JSDocThisTag<TypedPhase>, SyntaxPlan<JSDocThisTag<TypedPhase>>>();
  const JSDocImportTag = new Map<JSDocImportTag<TypedPhase>, SyntaxPlan<JSDocImportTag<TypedPhase>>>();
  const JSDocCallbackTag = new Map<JSDocCallbackTag<TypedPhase>, SyntaxPlan<JSDocCallbackTag<TypedPhase>>>();
  const JSDocOverloadTag = new Map<JSDocOverloadTag<TypedPhase>, SyntaxPlan<JSDocOverloadTag<TypedPhase>>>();
  const JSDocTypedefTag = new Map<JSDocTypedefTag<TypedPhase>, SyntaxPlan<JSDocTypedefTag<TypedPhase>>>();
  const JSDocSignature = new Map<JSDocSignature<TypedPhase>, SyntaxPlan<JSDocSignature<TypedPhase>>>();
  const JSDocNameReference = new Map<JSDocNameReference<TypedPhase>, SyntaxPlan<JSDocNameReference<TypedPhase>>>();
  const SourceFile = new Map<SourceFile<TypedPhase>, SyntaxPlan<SourceFile<TypedPhase>>>();
  const ModuleDeclaration = new Map<ModuleDeclaration<TypedPhase>, SyntaxPlan<ModuleDeclaration<TypedPhase>>>();
  const ImportEqualsDeclaration = new Map<ImportEqualsDeclaration<TypedPhase>, SyntaxPlan<ImportEqualsDeclaration<TypedPhase>>>();
  const ExportDeclaration = new Map<ExportDeclaration<TypedPhase>, SyntaxPlan<ExportDeclaration<TypedPhase>>>();
  const ImportTypeNode = new Map<ImportTypeNode<TypedPhase>, SyntaxPlan<ImportTypeNode<TypedPhase>>>();
  const ImportClause = new Map<ImportClause<TypedPhase>, SyntaxPlan<ImportClause<TypedPhase>>>();
  const ImportSpecifier = new Map<ImportSpecifier<TypedPhase>, SyntaxPlan<ImportSpecifier<TypedPhase>>>();
  const JSDocText = new Map<JSDocText<TypedPhase>, SyntaxPlan<JSDocText<TypedPhase>>>();
  const JSDocLink = new Map<JSDocLink<TypedPhase>, SyntaxPlan<JSDocLink<TypedPhase>>>();
  const JSDocLinkPlain = new Map<JSDocLinkPlain<TypedPhase>, SyntaxPlan<JSDocLinkPlain<TypedPhase>>>();
  const JSDocLinkCode = new Map<JSDocLinkCode<TypedPhase>, SyntaxPlan<JSDocLinkCode<TypedPhase>>>();
  const JSDocTypeLiteral = new Map<JSDocTypeLiteral<TypedPhase>, SyntaxPlan<JSDocTypeLiteral<TypedPhase>>>();
  const JSDocParameterOrPropertyTag = new Map<JSDocParameterOrPropertyTag<TypedPhase>, SyntaxPlan<JSDocParameterOrPropertyTag<TypedPhase>>>();
  return {
    ImportDeclaration: node => memoSyntaxPlan(ImportDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      importClause: node.importClause === null ? null : ports().ImportClause(node.importClause)(),
      moduleSpecifier: ports().Expression(node.moduleSpecifier)(),
      attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes)(),
      tsonic: node.tsonic,
    })),
    ExternalModuleReference: node => memoSyntaxPlan(ExternalModuleReference, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    NamespaceImport: node => memoSyntaxPlan(NamespaceImport, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().Identifier(node.name)(),
      tsonic: node.tsonic,
    })),
    NamedImports: node => memoSyntaxPlan(NamedImports, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elements: copyNodeList(node.elements, item => ports().ImportSpecifier(item)()),
      tsonic: node.tsonic,
    })),
    ExportAssignment: node => memoSyntaxPlan(ExportAssignment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      isExportEquals: node.isExportEquals,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      expression: ports().Expression(node.expression)(),
      tsonic: { definition: node.tsonic.definition, type: rewrite.type(node.tsonic.type) },
    })),
    NamespaceExportDeclaration: node => memoSyntaxPlan(NamespaceExportDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().Identifier(node.name)(),
      tsonic: node.tsonic,
    })),
    NamespaceExport: node => memoSyntaxPlan(NamespaceExport, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().ModuleExportName(node.name)(),
      tsonic: node.tsonic,
    })),
    NamedExports: node => memoSyntaxPlan(NamedExports, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elements: copyNodeList(node.elements, item => ports().ExportSpecifier(item)()),
      tsonic: node.tsonic,
    })),
    ExportSpecifier: node => memoSyntaxPlan(ExportSpecifier, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      isTypeOnly: node.isTypeOnly,
      propertyName: node.propertyName === null ? null : ports().ModuleExportName(node.propertyName)(),
      name: ports().ModuleExportName(node.name)(),
      tsonic: node.tsonic,
    })),
    JsxElement: node => memoSyntaxPlan(JsxElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      openingElement: ports().JsxOpeningElement(node.openingElement)(),
      children: copyNodeList(node.children, item => ports().JsxChild(item)()),
      closingElement: ports().JsxClosingElement(node.closingElement)(),
      tsonic: node.tsonic,
    })),
    JsxAttributes: node => memoSyntaxPlan(JsxAttributes, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      properties: copyNodeList(node.properties, item => ports().JsxAttributeLike(item)()),
      tsonic: node.tsonic,
    })),
    JsxNamespacedName: node => memoSyntaxPlan(JsxNamespacedName, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      namespace: ports().Identifier(node.namespace)(),
      name: ports().Identifier(node.name)(),
      tsonic: node.tsonic,
    })),
    JsxOpeningElement: node => memoSyntaxPlan(JsxOpeningElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().JsxTagNameExpression(node.tagName)(),
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      attributes: ports().JsxAttributes(node.attributes)(),
      tsonic: node.tsonic,
    })),
    JsxSelfClosingElement: node => memoSyntaxPlan(JsxSelfClosingElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().JsxTagNameExpression(node.tagName)(),
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      attributes: ports().JsxAttributes(node.attributes)(),
      tsonic: node.tsonic,
    })),
    JsxFragment: node => memoSyntaxPlan(JsxFragment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      openingFragment: ports().JsxOpeningFragment(node.openingFragment)(),
      children: copyNodeList(node.children, item => ports().JsxChild(item)()),
      closingFragment: ports().JsxClosingFragment(node.closingFragment)(),
      tsonic: node.tsonic,
    })),
    JsxOpeningFragment: node => memoSyntaxPlan(JsxOpeningFragment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    JsxClosingFragment: node => memoSyntaxPlan(JsxClosingFragment, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    JsxAttribute: node => memoSyntaxPlan(JsxAttribute, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().JsxAttributeName(node.name)(),
      initializer: node.initializer === null ? null : ports().JsxAttributeValue(node.initializer)(),
      tsonic: node.tsonic,
    })),
    JsxSpreadAttribute: node => memoSyntaxPlan(JsxSpreadAttribute, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    JsxClosingElement: node => memoSyntaxPlan(JsxClosingElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().JsxTagNameExpression(node.tagName)(),
      tsonic: node.tsonic,
    })),
    JsxExpression: node => memoSyntaxPlan(JsxExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      dotDotDotToken: node.dotDotDotToken,
      expression: node.expression === null ? null : ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    JsxText: node => memoSyntaxPlan(JsxText, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tokenFlags: node.tokenFlags,
      containsOnlyTriviaWhiteSpaces: node.containsOnlyTriviaWhiteSpaces,
      tsonic: node.tsonic,
    })),
    SyntaxList: node => memoSyntaxPlan(SyntaxList, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      children: node.children.map(item => ports().SyntaxNode(item)()),
      tsonic: node.tsonic,
    })),
    JSDoc: node => memoSyntaxPlan(JSDoc, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      comment: copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tags: node.tags === null ? null : copyNodeList(node.tags, item => ports().JSDocTag(item)()),
      tsonic: node.tsonic,
    })),
    JSDocTypeExpression: node => memoSyntaxPlan(JSDocTypeExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: node.tsonic,
    })),
    JSDocNonNullableType: node => memoSyntaxPlan(JSDocNonNullableType, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: node.tsonic,
    })),
    JSDocNullableType: node => memoSyntaxPlan(JSDocNullableType, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: node.tsonic,
    })),
    JSDocAllType: node => memoSyntaxPlan(JSDocAllType, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    JSDocVariadicType: node => memoSyntaxPlan(JSDocVariadicType, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: node.tsonic,
    })),
    JSDocOptionalType: node => memoSyntaxPlan(JSDocOptionalType, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      type: ports().TypeNode(node.type)(),
      tsonic: node.tsonic,
    })),
    JSDocTypeTag: node => memoSyntaxPlan(JSDocTypeTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: ports().SyntaxNode(node.typeExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocUnknownTag: node => memoSyntaxPlan(JSDocUnknownTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocTemplateTag: node => memoSyntaxPlan(JSDocTemplateTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      constraint: ports().SyntaxNode(node.constraint)(),
      typeParameters: copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      tsonic: node.tsonic,
    })),
    JSDocReturnTag: node => memoSyntaxPlan(JSDocReturnTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocPublicTag: node => memoSyntaxPlan(JSDocPublicTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocPrivateTag: node => memoSyntaxPlan(JSDocPrivateTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocProtectedTag: node => memoSyntaxPlan(JSDocProtectedTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocReadonlyTag: node => memoSyntaxPlan(JSDocReadonlyTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocOverrideTag: node => memoSyntaxPlan(JSDocOverrideTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocDeprecatedTag: node => memoSyntaxPlan(JSDocDeprecatedTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      tsonic: node.tsonic,
    })),
    JSDocSeeTag: node => memoSyntaxPlan(JSDocSeeTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      nameExpression: ports().TypeNode(node.nameExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocImplementsTag: node => memoSyntaxPlan(JSDocImplementsTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      className: ports().ExpressionWithTypeArguments(node.className)(),
      tsonic: node.tsonic,
    })),
    JSDocAugmentsTag: node => memoSyntaxPlan(JSDocAugmentsTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      className: ports().ExpressionWithTypeArguments(node.className)(),
      tsonic: node.tsonic,
    })),
    JSDocSatisfiesTag: node => memoSyntaxPlan(JSDocSatisfiesTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: ports().TypeNode(node.typeExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocThrowsTag: node => memoSyntaxPlan(JSDocThrowsTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocThisTag: node => memoSyntaxPlan(JSDocThisTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: ports().TypeNode(node.typeExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocImportTag: node => memoSyntaxPlan(JSDocImportTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      importClause: node.importClause === null ? null : ports().ImportClause(node.importClause)(),
      moduleSpecifier: ports().Expression(node.moduleSpecifier)(),
      attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes)(),
      tsonic: node.tsonic,
    })),
    JSDocCallbackTag: node => memoSyntaxPlan(JSDocCallbackTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: ports().TypeNode(node.typeExpression)(),
      name: node.name === null ? null : ports().JSDocFullName(node.name)(),
      tsonic: node.tsonic,
    })),
    JSDocOverloadTag: node => memoSyntaxPlan(JSDocOverloadTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: ports().TypeNode(node.typeExpression)(),
      tsonic: node.tsonic,
    })),
    JSDocTypedefTag: node => memoSyntaxPlan(JSDocTypedefTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      typeExpression: node.typeExpression === null ? null : ports().SyntaxNode(node.typeExpression)(),
      name: node.name === null ? null : ports().JSDocFullName(node.name)(),
      tsonic: node.tsonic,
    })),
    JSDocSignature: node => memoSyntaxPlan(JSDocSignature, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: node.tsonic,
    })),
    JSDocNameReference: node => memoSyntaxPlan(JSDocNameReference, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().EntityName(node.name)(),
      tsonic: node.tsonic,
    })),
    SourceFile: node => memoSyntaxPlan(SourceFile, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      statements: copyNodeList(node.statements, item => ports().Statement(item)()),
      endOfFileToken: node.endOfFileToken,
      languageVariant: node.languageVariant,
      scriptKind: node.scriptKind,
      commentDirectives: node.commentDirectives,
      pragmas: node.pragmas,
      checkJsDirective: node.checkJsDirective,
      tsonic: rewriteSourceFilePhase(rewrite, node.tsonic),
    })),
    ModuleDeclaration: node => memoSyntaxPlan(ModuleDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().NodeBody(node.body)(),
      keyword: node.keyword,
      name: ports().ModuleName(node.name)(),
      tsonic: rewriteNamespace(rewrite, node.tsonic),
    })),
    ImportEqualsDeclaration: node => memoSyntaxPlan(ImportEqualsDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      isTypeOnly: node.isTypeOnly,
      name: ports().Identifier(node.name)(),
      moduleReference: ports().ModuleReference(node.moduleReference)(),
      tsonic: node.tsonic,
    })),
    ExportDeclaration: node => memoSyntaxPlan(ExportDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      isTypeOnly: node.isTypeOnly,
      exportClause: node.exportClause === null ? null : ports().NamedExportBindings(node.exportClause)(),
      moduleSpecifier: node.moduleSpecifier === null ? null : ports().Expression(node.moduleSpecifier)(),
      attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes)(),
      tsonic: node.tsonic,
    })),
    ImportTypeNode: node => memoSyntaxPlan(ImportTypeNode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item)()),
      isTypeOf: node.isTypeOf,
      argument: ports().TypeNode(node.argument)(),
      attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes)(),
      qualifier: node.qualifier === null ? null : ports().EntityName(node.qualifier)(),
      tsonic: rewriteType(rewrite, node.tsonic),
    })),
    ImportClause: node => memoSyntaxPlan(ImportClause, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      phaseModifier: node.phaseModifier,
      name: node.name === null ? null : ports().Identifier(node.name)(),
      namedBindings: node.namedBindings === null ? null : ports().NamedImportBindings(node.namedBindings)(),
      tsonic: node.tsonic,
    })),
    ImportSpecifier: node => memoSyntaxPlan(ImportSpecifier, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      isTypeOnly: node.isTypeOnly,
      propertyName: node.propertyName === null ? null : ports().ModuleExportName(node.propertyName)(),
      name: ports().Identifier(node.name)(),
      tsonic: node.tsonic,
    })),
    JSDocText: node => memoSyntaxPlan(JSDocText, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      tsonic: node.tsonic,
    })),
    JSDocLink: node => memoSyntaxPlan(JSDocLink, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      name: node.name === null ? null : ports().EntityName(node.name)(),
      tsonic: node.tsonic,
    })),
    JSDocLinkPlain: node => memoSyntaxPlan(JSDocLinkPlain, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      name: node.name === null ? null : ports().EntityName(node.name)(),
      tsonic: node.tsonic,
    })),
    JSDocLinkCode: node => memoSyntaxPlan(JSDocLinkCode, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      text: node.text,
      name: node.name === null ? null : ports().EntityName(node.name)(),
      tsonic: node.tsonic,
    })),
    JSDocTypeLiteral: node => memoSyntaxPlan(JSDocTypeLiteral, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      jsDocPropertyTags: node.jsDocPropertyTags === null ? null : node.jsDocPropertyTags.map(item => ports().JSDocTag(item)()),
      isArrayType: node.isArrayType,
      tsonic: node.tsonic,
    })),
    JSDocParameterOrPropertyTag: node => memoSyntaxPlan(JSDocParameterOrPropertyTag, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tagName: ports().Identifier(node.tagName)(),
      comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)()),
      name: ports().EntityName(node.name)(),
      isBracketed: node.isBracketed,
      typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression)(),
      isNameFirst: node.isNameFirst,
      tsonic: node.tsonic,
    })),
  };
}
