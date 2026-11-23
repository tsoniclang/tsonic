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
  JSDocSignature, JSDocNameReference, SourceFile, SourceFileHeader, ModuleDeclaration, ImportEqualsDeclaration,
  ExportDeclaration, ImportTypeNode, ImportClause, ImportSpecifier, JSDocText,
  JSDocLink, JSDocLinkPlain, JSDocLinkCode, JSDocTypeLiteral, JSDocParameterOrPropertyTag,
  NodeList, Phase, Statement, SyntaxPhaseCopy,
} from "./contract.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { holdSyntaxPayload, copyNodeList, memoSyntaxPlan, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

export function copySourceFileHeader<P extends Phase, Statements>(
  node: SourceFileHeader<P>, statements: () => Statements, tsonic: P["SourceFile"],
): SourceFileHeader<P> & { readonly statements: Statements } {
  return {
    ...syntaxHeader(node),
    kind: node.kind,
    statements: statements(),
    endOfFileToken: node.endOfFileToken,
    languageVariant: node.languageVariant,
    scriptKind: node.scriptKind,
    commentDirectives: node.commentDirectives,
    pragmas: node.pragmas,
    checkJsDirective: node.checkJsDirective,
    tsonic,
  };
}

export interface AuxiliaryPlans<P extends Phase, Stop, Image> {
  readonly ImportDeclaration: (node: ImportDeclaration<P>) => SyntaxPlan<ImportDeclaration<P>, Stop, Image>;
  readonly ExternalModuleReference: (node: ExternalModuleReference<P>) => SyntaxPlan<ExternalModuleReference<P>, Stop, Image>;
  readonly NamespaceImport: (node: NamespaceImport<P>) => SyntaxPlan<NamespaceImport<P>, Stop, Image>;
  readonly NamedImports: (node: NamedImports<P>) => SyntaxPlan<NamedImports<P>, Stop, Image>;
  readonly ExportAssignment: (node: ExportAssignment<P>) => SyntaxPlan<ExportAssignment<P>, Stop, Image>;
  readonly NamespaceExportDeclaration: (node: NamespaceExportDeclaration<P>) => SyntaxPlan<NamespaceExportDeclaration<P>, Stop, Image>;
  readonly NamespaceExport: (node: NamespaceExport<P>) => SyntaxPlan<NamespaceExport<P>, Stop, Image>;
  readonly NamedExports: (node: NamedExports<P>) => SyntaxPlan<NamedExports<P>, Stop, Image>;
  readonly ExportSpecifier: (node: ExportSpecifier<P>) => SyntaxPlan<ExportSpecifier<P>, Stop, Image>;
  readonly JsxElement: (node: JsxElement<P>) => SyntaxPlan<JsxElement<P>, Stop, Image>;
  readonly JsxAttributes: (node: JsxAttributes<P>) => SyntaxPlan<JsxAttributes<P>, Stop, Image>;
  readonly JsxNamespacedName: (node: JsxNamespacedName<P>) => SyntaxPlan<JsxNamespacedName<P>, Stop, Image>;
  readonly JsxOpeningElement: (node: JsxOpeningElement<P>) => SyntaxPlan<JsxOpeningElement<P>, Stop, Image>;
  readonly JsxSelfClosingElement: (node: JsxSelfClosingElement<P>) => SyntaxPlan<JsxSelfClosingElement<P>, Stop, Image>;
  readonly JsxFragment: (node: JsxFragment<P>) => SyntaxPlan<JsxFragment<P>, Stop, Image>;
  readonly JsxOpeningFragment: (node: JsxOpeningFragment<P>) => SyntaxPlan<JsxOpeningFragment<P>, Stop, Image>;
  readonly JsxClosingFragment: (node: JsxClosingFragment<P>) => SyntaxPlan<JsxClosingFragment<P>, Stop, Image>;
  readonly JsxAttribute: (node: JsxAttribute<P>) => SyntaxPlan<JsxAttribute<P>, Stop, Image>;
  readonly JsxSpreadAttribute: (node: JsxSpreadAttribute<P>) => SyntaxPlan<JsxSpreadAttribute<P>, Stop, Image>;
  readonly JsxClosingElement: (node: JsxClosingElement<P>) => SyntaxPlan<JsxClosingElement<P>, Stop, Image>;
  readonly JsxExpression: (node: JsxExpression<P>) => SyntaxPlan<JsxExpression<P>, Stop, Image>;
  readonly JsxText: (node: JsxText<P>) => SyntaxPlan<JsxText<P>, Stop, Image>;
  readonly SyntaxList: (node: SyntaxList<P>) => SyntaxPlan<SyntaxList<P>, Stop, Image>;
  readonly JSDoc: (node: JSDoc<P>) => SyntaxPlan<JSDoc<P>, Stop, Image>;
  readonly JSDocTypeExpression: (node: JSDocTypeExpression<P>) => SyntaxPlan<JSDocTypeExpression<P>, Stop, Image>;
  readonly JSDocNonNullableType: (node: JSDocNonNullableType<P>) => SyntaxPlan<JSDocNonNullableType<P>, Stop, Image>;
  readonly JSDocNullableType: (node: JSDocNullableType<P>) => SyntaxPlan<JSDocNullableType<P>, Stop, Image>;
  readonly JSDocAllType: (node: JSDocAllType<P>) => SyntaxPlan<JSDocAllType<P>, Stop, Image>;
  readonly JSDocVariadicType: (node: JSDocVariadicType<P>) => SyntaxPlan<JSDocVariadicType<P>, Stop, Image>;
  readonly JSDocOptionalType: (node: JSDocOptionalType<P>) => SyntaxPlan<JSDocOptionalType<P>, Stop, Image>;
  readonly JSDocTypeTag: (node: JSDocTypeTag<P>) => SyntaxPlan<JSDocTypeTag<P>, Stop, Image>;
  readonly JSDocUnknownTag: (node: JSDocUnknownTag<P>) => SyntaxPlan<JSDocUnknownTag<P>, Stop, Image>;
  readonly JSDocTemplateTag: (node: JSDocTemplateTag<P>) => SyntaxPlan<JSDocTemplateTag<P>, Stop, Image>;
  readonly JSDocReturnTag: (node: JSDocReturnTag<P>) => SyntaxPlan<JSDocReturnTag<P>, Stop, Image>;
  readonly JSDocPublicTag: (node: JSDocPublicTag<P>) => SyntaxPlan<JSDocPublicTag<P>, Stop, Image>;
  readonly JSDocPrivateTag: (node: JSDocPrivateTag<P>) => SyntaxPlan<JSDocPrivateTag<P>, Stop, Image>;
  readonly JSDocProtectedTag: (node: JSDocProtectedTag<P>) => SyntaxPlan<JSDocProtectedTag<P>, Stop, Image>;
  readonly JSDocReadonlyTag: (node: JSDocReadonlyTag<P>) => SyntaxPlan<JSDocReadonlyTag<P>, Stop, Image>;
  readonly JSDocOverrideTag: (node: JSDocOverrideTag<P>) => SyntaxPlan<JSDocOverrideTag<P>, Stop, Image>;
  readonly JSDocDeprecatedTag: (node: JSDocDeprecatedTag<P>) => SyntaxPlan<JSDocDeprecatedTag<P>, Stop, Image>;
  readonly JSDocSeeTag: (node: JSDocSeeTag<P>) => SyntaxPlan<JSDocSeeTag<P>, Stop, Image>;
  readonly JSDocImplementsTag: (node: JSDocImplementsTag<P>) => SyntaxPlan<JSDocImplementsTag<P>, Stop, Image>;
  readonly JSDocAugmentsTag: (node: JSDocAugmentsTag<P>) => SyntaxPlan<JSDocAugmentsTag<P>, Stop, Image>;
  readonly JSDocSatisfiesTag: (node: JSDocSatisfiesTag<P>) => SyntaxPlan<JSDocSatisfiesTag<P>, Stop, Image>;
  readonly JSDocThrowsTag: (node: JSDocThrowsTag<P>) => SyntaxPlan<JSDocThrowsTag<P>, Stop, Image>;
  readonly JSDocThisTag: (node: JSDocThisTag<P>) => SyntaxPlan<JSDocThisTag<P>, Stop, Image>;
  readonly JSDocImportTag: (node: JSDocImportTag<P>) => SyntaxPlan<JSDocImportTag<P>, Stop, Image>;
  readonly JSDocCallbackTag: (node: JSDocCallbackTag<P>) => SyntaxPlan<JSDocCallbackTag<P>, Stop, Image>;
  readonly JSDocOverloadTag: (node: JSDocOverloadTag<P>) => SyntaxPlan<JSDocOverloadTag<P>, Stop, Image>;
  readonly JSDocTypedefTag: (node: JSDocTypedefTag<P>) => SyntaxPlan<JSDocTypedefTag<P>, Stop, Image>;
  readonly JSDocSignature: (node: JSDocSignature<P>) => SyntaxPlan<JSDocSignature<P>, Stop, Image>;
  readonly JSDocNameReference: (node: JSDocNameReference<P>) => SyntaxPlan<JSDocNameReference<P>, Stop, Image>;
  readonly SourceFile: (node: SourceFile<P>) => SyntaxPlan<SourceFile<P>, Stop, Image>;
  readonly ModuleDeclaration: (node: ModuleDeclaration<P>) => SyntaxPlan<ModuleDeclaration<P>, Stop, Image>;
  readonly ImportEqualsDeclaration: (node: ImportEqualsDeclaration<P>) => SyntaxPlan<ImportEqualsDeclaration<P>, Stop, Image>;
  readonly ExportDeclaration: (node: ExportDeclaration<P>) => SyntaxPlan<ExportDeclaration<P>, Stop, Image>;
  readonly ImportTypeNode: (node: ImportTypeNode<P>) => SyntaxPlan<ImportTypeNode<P>, Stop, Image>;
  readonly ImportClause: (node: ImportClause<P>) => SyntaxPlan<ImportClause<P>, Stop, Image>;
  readonly ImportSpecifier: (node: ImportSpecifier<P>) => SyntaxPlan<ImportSpecifier<P>, Stop, Image>;
  readonly JSDocText: (node: JSDocText<P>) => SyntaxPlan<JSDocText<P>, Stop, Image>;
  readonly JSDocLink: (node: JSDocLink<P>) => SyntaxPlan<JSDocLink<P>, Stop, Image>;
  readonly JSDocLinkPlain: (node: JSDocLinkPlain<P>) => SyntaxPlan<JSDocLinkPlain<P>, Stop, Image>;
  readonly JSDocLinkCode: (node: JSDocLinkCode<P>) => SyntaxPlan<JSDocLinkCode<P>, Stop, Image>;
  readonly JSDocTypeLiteral: (node: JSDocTypeLiteral<P>) => SyntaxPlan<JSDocTypeLiteral<P>, Stop, Image>;
  readonly JSDocParameterOrPropertyTag: (node: JSDocParameterOrPropertyTag<P>) => SyntaxPlan<JSDocParameterOrPropertyTag<P>, Stop, Image>;
}

export function createAuxiliaryPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>, ports: () => SyntaxCopyPorts<P, Stop, Image>): AuxiliaryPlans<P, Stop, Image> {
  const ImportDeclaration = new Map<ImportDeclaration<P>, SyntaxPlan<ImportDeclaration<P>, Stop, Image>>();
  const ExternalModuleReference = new Map<ExternalModuleReference<P>, SyntaxPlan<ExternalModuleReference<P>, Stop, Image>>();
  const NamespaceImport = new Map<NamespaceImport<P>, SyntaxPlan<NamespaceImport<P>, Stop, Image>>();
  const NamedImports = new Map<NamedImports<P>, SyntaxPlan<NamedImports<P>, Stop, Image>>();
  const ExportAssignment = new Map<ExportAssignment<P>, SyntaxPlan<ExportAssignment<P>, Stop, Image>>();
  const NamespaceExportDeclaration = new Map<NamespaceExportDeclaration<P>, SyntaxPlan<NamespaceExportDeclaration<P>, Stop, Image>>();
  const NamespaceExport = new Map<NamespaceExport<P>, SyntaxPlan<NamespaceExport<P>, Stop, Image>>();
  const NamedExports = new Map<NamedExports<P>, SyntaxPlan<NamedExports<P>, Stop, Image>>();
  const ExportSpecifier = new Map<ExportSpecifier<P>, SyntaxPlan<ExportSpecifier<P>, Stop, Image>>();
  const JsxElement = new Map<JsxElement<P>, SyntaxPlan<JsxElement<P>, Stop, Image>>();
  const JsxAttributes = new Map<JsxAttributes<P>, SyntaxPlan<JsxAttributes<P>, Stop, Image>>();
  const JsxNamespacedName = new Map<JsxNamespacedName<P>, SyntaxPlan<JsxNamespacedName<P>, Stop, Image>>();
  const JsxOpeningElement = new Map<JsxOpeningElement<P>, SyntaxPlan<JsxOpeningElement<P>, Stop, Image>>();
  const JsxSelfClosingElement = new Map<JsxSelfClosingElement<P>, SyntaxPlan<JsxSelfClosingElement<P>, Stop, Image>>();
  const JsxFragment = new Map<JsxFragment<P>, SyntaxPlan<JsxFragment<P>, Stop, Image>>();
  const JsxOpeningFragment = new Map<JsxOpeningFragment<P>, SyntaxPlan<JsxOpeningFragment<P>, Stop, Image>>();
  const JsxClosingFragment = new Map<JsxClosingFragment<P>, SyntaxPlan<JsxClosingFragment<P>, Stop, Image>>();
  const JsxAttribute = new Map<JsxAttribute<P>, SyntaxPlan<JsxAttribute<P>, Stop, Image>>();
  const JsxSpreadAttribute = new Map<JsxSpreadAttribute<P>, SyntaxPlan<JsxSpreadAttribute<P>, Stop, Image>>();
  const JsxClosingElement = new Map<JsxClosingElement<P>, SyntaxPlan<JsxClosingElement<P>, Stop, Image>>();
  const JsxExpression = new Map<JsxExpression<P>, SyntaxPlan<JsxExpression<P>, Stop, Image>>();
  const JsxText = new Map<JsxText<P>, SyntaxPlan<JsxText<P>, Stop, Image>>();
  const SyntaxList = new Map<SyntaxList<P>, SyntaxPlan<SyntaxList<P>, Stop, Image>>();
  const JSDoc = new Map<JSDoc<P>, SyntaxPlan<JSDoc<P>, Stop, Image>>();
  const JSDocTypeExpression = new Map<JSDocTypeExpression<P>, SyntaxPlan<JSDocTypeExpression<P>, Stop, Image>>();
  const JSDocNonNullableType = new Map<JSDocNonNullableType<P>, SyntaxPlan<JSDocNonNullableType<P>, Stop, Image>>();
  const JSDocNullableType = new Map<JSDocNullableType<P>, SyntaxPlan<JSDocNullableType<P>, Stop, Image>>();
  const JSDocAllType = new Map<JSDocAllType<P>, SyntaxPlan<JSDocAllType<P>, Stop, Image>>();
  const JSDocVariadicType = new Map<JSDocVariadicType<P>, SyntaxPlan<JSDocVariadicType<P>, Stop, Image>>();
  const JSDocOptionalType = new Map<JSDocOptionalType<P>, SyntaxPlan<JSDocOptionalType<P>, Stop, Image>>();
  const JSDocTypeTag = new Map<JSDocTypeTag<P>, SyntaxPlan<JSDocTypeTag<P>, Stop, Image>>();
  const JSDocUnknownTag = new Map<JSDocUnknownTag<P>, SyntaxPlan<JSDocUnknownTag<P>, Stop, Image>>();
  const JSDocTemplateTag = new Map<JSDocTemplateTag<P>, SyntaxPlan<JSDocTemplateTag<P>, Stop, Image>>();
  const JSDocReturnTag = new Map<JSDocReturnTag<P>, SyntaxPlan<JSDocReturnTag<P>, Stop, Image>>();
  const JSDocPublicTag = new Map<JSDocPublicTag<P>, SyntaxPlan<JSDocPublicTag<P>, Stop, Image>>();
  const JSDocPrivateTag = new Map<JSDocPrivateTag<P>, SyntaxPlan<JSDocPrivateTag<P>, Stop, Image>>();
  const JSDocProtectedTag = new Map<JSDocProtectedTag<P>, SyntaxPlan<JSDocProtectedTag<P>, Stop, Image>>();
  const JSDocReadonlyTag = new Map<JSDocReadonlyTag<P>, SyntaxPlan<JSDocReadonlyTag<P>, Stop, Image>>();
  const JSDocOverrideTag = new Map<JSDocOverrideTag<P>, SyntaxPlan<JSDocOverrideTag<P>, Stop, Image>>();
  const JSDocDeprecatedTag = new Map<JSDocDeprecatedTag<P>, SyntaxPlan<JSDocDeprecatedTag<P>, Stop, Image>>();
  const JSDocSeeTag = new Map<JSDocSeeTag<P>, SyntaxPlan<JSDocSeeTag<P>, Stop, Image>>();
  const JSDocImplementsTag = new Map<JSDocImplementsTag<P>, SyntaxPlan<JSDocImplementsTag<P>, Stop, Image>>();
  const JSDocAugmentsTag = new Map<JSDocAugmentsTag<P>, SyntaxPlan<JSDocAugmentsTag<P>, Stop, Image>>();
  const JSDocSatisfiesTag = new Map<JSDocSatisfiesTag<P>, SyntaxPlan<JSDocSatisfiesTag<P>, Stop, Image>>();
  const JSDocThrowsTag = new Map<JSDocThrowsTag<P>, SyntaxPlan<JSDocThrowsTag<P>, Stop, Image>>();
  const JSDocThisTag = new Map<JSDocThisTag<P>, SyntaxPlan<JSDocThisTag<P>, Stop, Image>>();
  const JSDocImportTag = new Map<JSDocImportTag<P>, SyntaxPlan<JSDocImportTag<P>, Stop, Image>>();
  const JSDocCallbackTag = new Map<JSDocCallbackTag<P>, SyntaxPlan<JSDocCallbackTag<P>, Stop, Image>>();
  const JSDocOverloadTag = new Map<JSDocOverloadTag<P>, SyntaxPlan<JSDocOverloadTag<P>, Stop, Image>>();
  const JSDocTypedefTag = new Map<JSDocTypedefTag<P>, SyntaxPlan<JSDocTypedefTag<P>, Stop, Image>>();
  const JSDocSignature = new Map<JSDocSignature<P>, SyntaxPlan<JSDocSignature<P>, Stop, Image>>();
  const JSDocNameReference = new Map<JSDocNameReference<P>, SyntaxPlan<JSDocNameReference<P>, Stop, Image>>();
  const SourceFile = new Map<SourceFile<P>, SyntaxPlan<SourceFile<P>, Stop, Image>>();
  const ModuleDeclaration = new Map<ModuleDeclaration<P>, SyntaxPlan<ModuleDeclaration<P>, Stop, Image>>();
  const ImportEqualsDeclaration = new Map<ImportEqualsDeclaration<P>, SyntaxPlan<ImportEqualsDeclaration<P>, Stop, Image>>();
  const ExportDeclaration = new Map<ExportDeclaration<P>, SyntaxPlan<ExportDeclaration<P>, Stop, Image>>();
  const ImportTypeNode = new Map<ImportTypeNode<P>, SyntaxPlan<ImportTypeNode<P>, Stop, Image>>();
  const ImportClause = new Map<ImportClause<P>, SyntaxPlan<ImportClause<P>, Stop, Image>>();
  const ImportSpecifier = new Map<ImportSpecifier<P>, SyntaxPlan<ImportSpecifier<P>, Stop, Image>>();
  const JSDocText = new Map<JSDocText<P>, SyntaxPlan<JSDocText<P>, Stop, Image>>();
  const JSDocLink = new Map<JSDocLink<P>, SyntaxPlan<JSDocLink<P>, Stop, Image>>();
  const JSDocLinkPlain = new Map<JSDocLinkPlain<P>, SyntaxPlan<JSDocLinkPlain<P>, Stop, Image>>();
  const JSDocLinkCode = new Map<JSDocLinkCode<P>, SyntaxPlan<JSDocLinkCode<P>, Stop, Image>>();
  const JSDocTypeLiteral = new Map<JSDocTypeLiteral<P>, SyntaxPlan<JSDocTypeLiteral<P>, Stop, Image>>();
  const JSDocParameterOrPropertyTag = new Map<JSDocParameterOrPropertyTag<P>, SyntaxPlan<JSDocParameterOrPropertyTag<P>, Stop, Image>>();
  return {
    ImportDeclaration: node => memoSyntaxPlan(ImportDeclaration, node, () => withSyntaxPayload(phase.ImportDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        importClause: node.importClause === null ? null : ports().ImportClause(node.importClause).read(),
        moduleSpecifier: ports().Expression(node.moduleSpecifier).read(),
        attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes).read(),
        tsonic,
      });
    })),
    ExternalModuleReference: node => memoSyntaxPlan(ExternalModuleReference, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    NamespaceImport: node => memoSyntaxPlan(NamespaceImport, node, () => withSyntaxPayload(phase.NamespaceImport, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().Identifier(node.name).read(),
        tsonic,
      });
    })),
    NamedImports: node => memoSyntaxPlan(NamedImports, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: copyNodeList(node.elements, item => ports().ImportSpecifier(item).read()),
        tsonic,
      });
    })),
    ExportAssignment: node => memoSyntaxPlan(ExportAssignment, node, () => withSyntaxPayload(phase.ExportAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isExportEquals } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        isExportEquals,
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        expression: ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    NamespaceExportDeclaration: node => memoSyntaxPlan(NamespaceExportDeclaration, node, () => withSyntaxPayload(phase.NamespaceExportDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().Identifier(node.name).read(),
        tsonic,
      });
    })),
    NamespaceExport: node => memoSyntaxPlan(NamespaceExport, node, () => withSyntaxPayload(phase.NamespaceExport, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().ModuleExportName(node.name).read(),
        tsonic,
      });
    })),
    NamedExports: node => memoSyntaxPlan(NamedExports, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: copyNodeList(node.elements, item => ports().ExportSpecifier(item).read()),
        tsonic,
      });
    })),
    ExportSpecifier: node => memoSyntaxPlan(ExportSpecifier, node, () => withSyntaxPayload(phase.ExportSpecifier, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => ({
        ...header,
        kind,
        isTypeOnly,
        propertyName: node.propertyName === null ? null : ports().ModuleExportName(node.propertyName).read(),
        name: ports().ModuleExportName(node.name).read(),
        tsonic,
      });
    })),
    JsxElement: node => memoSyntaxPlan(JsxElement, node, () => withSyntaxPayload(phase.JsxElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        openingElement: ports().JsxOpeningElement(node.openingElement).read(),
        children: copyNodeList(node.children, item => ports().JsxChild(item).read()),
        closingElement: ports().JsxClosingElement(node.closingElement).read(),
        tsonic,
      });
    })),
    JsxAttributes: node => memoSyntaxPlan(JsxAttributes, node, () => withSyntaxPayload(phase.JsxAttributes, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        properties: copyNodeList(node.properties, item => ports().JsxAttributeLike(item).read()),
        tsonic,
      });
    })),
    JsxNamespacedName: node => memoSyntaxPlan(JsxNamespacedName, node, () => withSyntaxPayload(phase.JsxNamespacedName, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        namespace: ports().Identifier(node.namespace).read(),
        name: ports().Identifier(node.name).read(),
        tsonic,
      });
    })),
    JsxOpeningElement: node => memoSyntaxPlan(JsxOpeningElement, node, () => withSyntaxPayload(phase.JsxOpeningElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().JsxTagNameExpression(node.tagName).read(),
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        attributes: ports().JsxAttributes(node.attributes).read(),
        tsonic,
      });
    })),
    JsxSelfClosingElement: node => memoSyntaxPlan(JsxSelfClosingElement, node, () => withSyntaxPayload(phase.JsxSelfClosingElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().JsxTagNameExpression(node.tagName).read(),
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        attributes: ports().JsxAttributes(node.attributes).read(),
        tsonic,
      });
    })),
    JsxFragment: node => memoSyntaxPlan(JsxFragment, node, () => withSyntaxPayload(phase.JsxFragment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        openingFragment: ports().JsxOpeningFragment(node.openingFragment).read(),
        children: copyNodeList(node.children, item => ports().JsxChild(item).read()),
        closingFragment: ports().JsxClosingFragment(node.closingFragment).read(),
        tsonic,
      });
    })),
    JsxOpeningFragment: node => memoSyntaxPlan(JsxOpeningFragment, node, () => withSyntaxPayload(phase.JsxOpeningFragment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    JsxClosingFragment: node => memoSyntaxPlan(JsxClosingFragment, node, () => withSyntaxPayload(phase.JsxClosingFragment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    JsxAttribute: node => memoSyntaxPlan(JsxAttribute, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().JsxAttributeName(node.name).read(),
        initializer: node.initializer === null ? null : ports().JsxAttributeValue(node.initializer).read(),
        tsonic,
      });
    })),
    JsxSpreadAttribute: node => memoSyntaxPlan(JsxSpreadAttribute, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    JsxClosingElement: node => memoSyntaxPlan(JsxClosingElement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().JsxTagNameExpression(node.tagName).read(),
        tsonic,
      });
    })),
    JsxExpression: node => memoSyntaxPlan(JsxExpression, node, () => withSyntaxPayload(phase.JsxExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, dotDotDotToken } = node;
      return tsonic => ({
        ...header,
        kind,
        dotDotDotToken,
        expression: node.expression === null ? null : ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    JsxText: node => memoSyntaxPlan(JsxText, node, () => withSyntaxPayload(phase.JsxText, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text, tokenFlags, containsOnlyTriviaWhiteSpaces } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tokenFlags,
        containsOnlyTriviaWhiteSpaces,
        tsonic,
      });
    })),
    SyntaxList: node => memoSyntaxPlan(SyntaxList, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        children: node.children.map(item => ports().SyntaxNode(item).read()),
        tsonic,
      });
    })),
    JSDoc: node => memoSyntaxPlan(JSDoc, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        comment: copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tags: node.tags === null ? null : copyNodeList(node.tags, item => ports().JSDocTag(item).read()),
        tsonic,
      });
    })),
    JSDocTypeExpression: node => memoSyntaxPlan(JSDocTypeExpression, node, () => withSyntaxPayload(phase.JSDocTypeExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    JSDocNonNullableType: node => memoSyntaxPlan(JSDocNonNullableType, node, () => withSyntaxPayload(phase.JSDocNonNullableType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    JSDocNullableType: node => memoSyntaxPlan(JSDocNullableType, node, () => withSyntaxPayload(phase.JSDocNullableType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    JSDocAllType: node => memoSyntaxPlan(JSDocAllType, node, () => withSyntaxPayload(phase.JSDocAllType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    JSDocVariadicType: node => memoSyntaxPlan(JSDocVariadicType, node, () => withSyntaxPayload(phase.JSDocVariadicType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    JSDocOptionalType: node => memoSyntaxPlan(JSDocOptionalType, node, () => withSyntaxPayload(phase.JSDocOptionalType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    JSDocTypeTag: node => memoSyntaxPlan(JSDocTypeTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: ports().SyntaxNode(node.typeExpression).read(),
        tsonic,
      });
    })),
    JSDocUnknownTag: node => memoSyntaxPlan(JSDocUnknownTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocTemplateTag: node => memoSyntaxPlan(JSDocTemplateTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        constraint: ports().SyntaxNode(node.constraint).read(),
        typeParameters: copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        tsonic,
      });
    })),
    JSDocReturnTag: node => memoSyntaxPlan(JSDocReturnTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression).read(),
        tsonic,
      });
    })),
    JSDocPublicTag: node => memoSyntaxPlan(JSDocPublicTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocPrivateTag: node => memoSyntaxPlan(JSDocPrivateTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocProtectedTag: node => memoSyntaxPlan(JSDocProtectedTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocReadonlyTag: node => memoSyntaxPlan(JSDocReadonlyTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocOverrideTag: node => memoSyntaxPlan(JSDocOverrideTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocDeprecatedTag: node => memoSyntaxPlan(JSDocDeprecatedTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        tsonic,
      });
    })),
    JSDocSeeTag: node => memoSyntaxPlan(JSDocSeeTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        nameExpression: ports().TypeNode(node.nameExpression).read(),
        tsonic,
      });
    })),
    JSDocImplementsTag: node => memoSyntaxPlan(JSDocImplementsTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        className: ports().ExpressionWithTypeArguments(node.className).read(),
        tsonic,
      });
    })),
    JSDocAugmentsTag: node => memoSyntaxPlan(JSDocAugmentsTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        className: ports().ExpressionWithTypeArguments(node.className).read(),
        tsonic,
      });
    })),
    JSDocSatisfiesTag: node => memoSyntaxPlan(JSDocSatisfiesTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: ports().TypeNode(node.typeExpression).read(),
        tsonic,
      });
    })),
    JSDocThrowsTag: node => memoSyntaxPlan(JSDocThrowsTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression).read(),
        tsonic,
      });
    })),
    JSDocThisTag: node => memoSyntaxPlan(JSDocThisTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: ports().TypeNode(node.typeExpression).read(),
        tsonic,
      });
    })),
    JSDocImportTag: node => memoSyntaxPlan(JSDocImportTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        importClause: node.importClause === null ? null : ports().ImportClause(node.importClause).read(),
        moduleSpecifier: ports().Expression(node.moduleSpecifier).read(),
        attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes).read(),
        tsonic,
      });
    })),
    JSDocCallbackTag: node => memoSyntaxPlan(JSDocCallbackTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: ports().TypeNode(node.typeExpression).read(),
        name: node.name === null ? null : ports().JSDocFullName(node.name).read(),
        tsonic,
      });
    })),
    JSDocOverloadTag: node => memoSyntaxPlan(JSDocOverloadTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: ports().TypeNode(node.typeExpression).read(),
        tsonic,
      });
    })),
    JSDocTypedefTag: node => memoSyntaxPlan(JSDocTypedefTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        typeExpression: node.typeExpression === null ? null : ports().SyntaxNode(node.typeExpression).read(),
        name: node.name === null ? null : ports().JSDocFullName(node.name).read(),
        tsonic,
      });
    })),
    JSDocSignature: node => memoSyntaxPlan(JSDocSignature, node, () => withSyntaxPayload(phase.JSDocSignature, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        tsonic,
      });
    })),
    JSDocNameReference: node => memoSyntaxPlan(JSDocNameReference, node, () => withSyntaxPayload(phase.JSDocNameReference, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().EntityName(node.name).read(),
        tsonic,
      });
    })),
    SourceFile: node => memoSyntaxPlan(SourceFile, node, () => withSyntaxPayload(phase.SourceFile, node.tsonic, () => tsonic =>
      copySourceFileHeader<P, NodeList<Statement<P>>>(node,
        () => copyNodeList(node.statements, item => ports().Statement(item).read()), tsonic))),
    ModuleDeclaration: node => memoSyntaxPlan(ModuleDeclaration, node, () => withSyntaxPayload(phase.ModuleDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, asteriskToken, keyword } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        asteriskToken,
        body: node.body === null ? null : ports().NodeBody(node.body).read(),
        keyword,
        name: ports().ModuleName(node.name).read(),
        tsonic,
      });
    })),
    ImportEqualsDeclaration: node => memoSyntaxPlan(ImportEqualsDeclaration, node, () => withSyntaxPayload(phase.ImportEqualsDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        isTypeOnly,
        name: ports().Identifier(node.name).read(),
        moduleReference: ports().ModuleReference(node.moduleReference).read(),
        tsonic,
      });
    })),
    ExportDeclaration: node => memoSyntaxPlan(ExportDeclaration, node, () => withSyntaxPayload(phase.ExportDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        isTypeOnly,
        exportClause: node.exportClause === null ? null : ports().NamedExportBindings(node.exportClause).read(),
        moduleSpecifier: node.moduleSpecifier === null ? null : ports().Expression(node.moduleSpecifier).read(),
        attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes).read(),
        tsonic,
      });
    })),
    ImportTypeNode: node => memoSyntaxPlan(ImportTypeNode, node, () => withSyntaxPayload(phase.ImportTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOf } = node;
      return tsonic => ({
        ...header,
        kind,
        typeArguments: node.typeArguments === null ? null : copyNodeList(node.typeArguments, item => ports().TypeNode(item).read()),
        isTypeOf,
        argument: ports().TypeNode(node.argument).read(),
        attributes: node.attributes === null ? null : ports().ImportAttributes(node.attributes).read(),
        qualifier: node.qualifier === null ? null : ports().EntityName(node.qualifier).read(),
        tsonic,
      });
    })),
    ImportClause: node => memoSyntaxPlan(ImportClause, node, () => withSyntaxPayload(phase.ImportClause, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, phaseModifier } = node;
      return tsonic => ({
        ...header,
        kind,
        phaseModifier,
        name: node.name === null ? null : ports().Identifier(node.name).read(),
        namedBindings: node.namedBindings === null ? null : ports().NamedImportBindings(node.namedBindings).read(),
        tsonic,
      });
    })),
    ImportSpecifier: node => memoSyntaxPlan(ImportSpecifier, node, () => withSyntaxPayload(phase.ImportSpecifier, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => ({
        ...header,
        kind,
        isTypeOnly,
        propertyName: node.propertyName === null ? null : ports().ModuleExportName(node.propertyName).read(),
        name: ports().Identifier(node.name).read(),
        tsonic,
      });
    })),
    JSDocText: node => memoSyntaxPlan(JSDocText, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        tsonic,
      });
    })),
    JSDocLink: node => memoSyntaxPlan(JSDocLink, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        name: node.name === null ? null : ports().EntityName(node.name).read(),
        tsonic,
      });
    })),
    JSDocLinkPlain: node => memoSyntaxPlan(JSDocLinkPlain, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        name: node.name === null ? null : ports().EntityName(node.name).read(),
        tsonic,
      });
    })),
    JSDocLinkCode: node => memoSyntaxPlan(JSDocLinkCode, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, text } = node;
      return tsonic => ({
        ...header,
        kind,
        text,
        name: node.name === null ? null : ports().EntityName(node.name).read(),
        tsonic,
      });
    })),
    JSDocTypeLiteral: node => memoSyntaxPlan(JSDocTypeLiteral, node, () => withSyntaxPayload(phase.JSDocTypeLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isArrayType } = node;
      return tsonic => ({
        ...header,
        kind,
        jsDocPropertyTags: node.jsDocPropertyTags === null ? null : node.jsDocPropertyTags.map(item => ports().JSDocTag(item).read()),
        isArrayType,
        tsonic,
      });
    })),
    JSDocParameterOrPropertyTag: node => memoSyntaxPlan(JSDocParameterOrPropertyTag, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isBracketed, isNameFirst } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().Identifier(node.tagName).read(),
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item).read()),
        name: ports().EntityName(node.name).read(),
        isBracketed,
        typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression).read(),
        isNameFirst,
        tsonic,
      });
    })),
  };
}
