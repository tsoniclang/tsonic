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
  JSDocSignature, JSDocNameReference, SourceFile, SourceFileSyntaxReceipt, ModuleDeclaration, ImportEqualsDeclaration,
  ExportDeclaration, ImportTypeNode, ImportClause, ImportSpecifier, JSDocText,
  JSDocLink, JSDocLinkPlain, JSDocLinkCode, JSDocTypeLiteral, JSDocParameterOrPropertyTag,
  Expression, JsxStructureSyntax, ModuleStructureSyntax, Phase, SingleExpressionSyntax, SyntaxPhaseCopy, SyntaxStructureReceipt,
} from "./contract.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { holdSyntaxPayload, copyNodeList, memoSyntaxPlan, requireSyntaxStructure, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

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

export function createAuxiliaryPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>,
  ports: () => SyntaxCopyPorts<P, Stop, Image>, expressionOf: (node: SingleExpressionSyntax<P>) => Expression<P>,
  sourceOf: (node: SourceFile<P>) => SourceFileSyntaxReceipt<P>, structureOf: (node: ModuleStructureSyntax<P> | JsxStructureSyntax<P>) => SyntaxStructureReceipt<P>):
  AuxiliaryPlans<P, Stop, Image> {
  function structure<Kind extends SyntaxStructureReceipt<P>["kind"]>(node: ModuleStructureSyntax<P> | JsxStructureSyntax<P>, kind: Kind) {
    return requireSyntaxStructure<P, Kind>(structureOf(node), kind);
  }
  const optional = <Value, Copied>(value: Value | null, read: (value: Value) => Copied): Copied | null => value === null ? null : read(value);
  const jsxOpeningFields = (node: JsxOpeningElement<P> | JsxSelfClosingElement<P>) => {
    const fields = structure(node, "jsx-opening");
    return { tagName: ports().JsxTagNameExpression(fields.name()), typeArguments: fields.args(ports().TypeNode),
      attributes: ports().JsxAttributes(fields.attributes()).read() };
  };
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
      return tsonic => {
        const fields = structure(node, "import-declaration");
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike),
          importClause: optional(fields.clause(), value => ports().ImportClause(value).read()), moduleSpecifier: ports().Expression(fields.specifier()),
          attributes: optional(fields.attributes(), value => ports().ImportAttributes(value).read()), tsonic };
      };
    })),
    ExternalModuleReference: node => memoSyntaxPlan(ExternalModuleReference, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    NamespaceImport: node => memoSyntaxPlan(NamespaceImport, node, () => withSyntaxPayload(phase.NamespaceImport, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().Identifier(structure(node, "namespace-import").name()).read(),
        tsonic,
      });
    })),
    NamedImports: node => memoSyntaxPlan(NamedImports, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: structure(node, "named-imports").elements(item => ports().ImportSpecifier(item).read()),
        tsonic,
      });
    })),
    ExportAssignment: node => memoSyntaxPlan(ExportAssignment, node, () => withSyntaxPayload(phase.ExportAssignment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isExportEquals } = node;
      return tsonic => {
        const fields = structure(node, "export-assignment");
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), isExportEquals,
          type: optional(fields.type(), ports().TypeNode), expression: ports().Expression(fields.expression()), tsonic };
      };
    })),
    NamespaceExportDeclaration: node => memoSyntaxPlan(NamespaceExportDeclaration, node, () => withSyntaxPayload(phase.NamespaceExportDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "namespace-export-declaration");
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), name: ports().Identifier(fields.name()).read(), tsonic };
      };
    })),
    NamespaceExport: node => memoSyntaxPlan(NamespaceExport, node, () => withSyntaxPayload(phase.NamespaceExport, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().ModuleExportName(structure(node, "namespace-export").name()),
        tsonic,
      });
    })),
    NamedExports: node => memoSyntaxPlan(NamedExports, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: structure(node, "named-exports").elements(item => ports().ExportSpecifier(item).read()),
        tsonic,
      });
    })),
    ExportSpecifier: node => memoSyntaxPlan(ExportSpecifier, node, () => withSyntaxPayload(phase.ExportSpecifier, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => {
        const fields = structure(node, "export-specifier");
        return { ...header, kind, isTypeOnly, propertyName: optional(fields.property(), ports().ModuleExportName),
          name: ports().ModuleExportName(fields.name()), tsonic };
      };
    })),
    JsxElement: node => memoSyntaxPlan(JsxElement, node, () => withSyntaxPayload(phase.JsxElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "jsx-element");
        return { ...header, kind, openingElement: ports().JsxOpeningElement(fields.opening()).read(), children: fields.children(ports().JsxChild),
          closingElement: ports().JsxClosingElement(fields.closing()).read(), tsonic };
      };
    })),
    JsxAttributes: node => memoSyntaxPlan(JsxAttributes, node, () => withSyntaxPayload(phase.JsxAttributes, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        properties: structure(node, "jsx-attributes").properties(ports().JsxAttributeLike),
        tsonic,
      });
    })),
    JsxNamespacedName: node => memoSyntaxPlan(JsxNamespacedName, node, () => withSyntaxPayload(phase.JsxNamespacedName, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "jsx-name");
        return { ...header, kind, namespace: ports().Identifier(fields.namespace()).read(), name: ports().Identifier(fields.name()).read(), tsonic };
      };
    })),
    JsxOpeningElement: node => memoSyntaxPlan(JsxOpeningElement, node, () => withSyntaxPayload(phase.JsxOpeningElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, ...jsxOpeningFields(node), tsonic });
    })),
    JsxSelfClosingElement: node => memoSyntaxPlan(JsxSelfClosingElement, node, () => withSyntaxPayload(phase.JsxSelfClosingElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({ ...header, kind, ...jsxOpeningFields(node), tsonic });
    })),
    JsxFragment: node => memoSyntaxPlan(JsxFragment, node, () => withSyntaxPayload(phase.JsxFragment, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "jsx-fragment");
        return { ...header, kind, openingFragment: ports().JsxOpeningFragment(fields.opening()).read(), children: fields.children(ports().JsxChild),
          closingFragment: ports().JsxClosingFragment(fields.closing()).read(), tsonic };
      };
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
      return tsonic => {
        const fields = structure(node, "jsx-attribute");
        return { ...header, kind, name: ports().JsxAttributeName(fields.name()), initializer: optional(fields.initializer(), ports().JsxAttributeValue), tsonic };
      };
    })),
    JsxSpreadAttribute: node => memoSyntaxPlan(JsxSpreadAttribute, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)),
        tsonic,
      });
    })),
    JsxClosingElement: node => memoSyntaxPlan(JsxClosingElement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tagName: ports().JsxTagNameExpression(structure(node, "jsx-closing").name()),
        tsonic,
      });
    })),
    JsxExpression: node => memoSyntaxPlan(JsxExpression, node, () => withSyntaxPayload(phase.JsxExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const fields = structure(node, "jsx-expression");
        return { ...header, kind, dotDotDotToken: fields.dots(), expression: optional(fields.expression(), ports().Expression), tsonic };
      };
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
        children: node.children.map(item => ports().SyntaxNode(item)),
        tsonic,
      });
    })),
    JSDoc: node => memoSyntaxPlan(JSDoc, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        comment: copyNodeList(node.comment, item => ports().JSDocComment(item)),
        tags: node.tags === null ? null : copyNodeList(node.tags, item => ports().JSDocTag(item)),
        tsonic,
      });
    })),
    JSDocTypeExpression: node => memoSyntaxPlan(JSDocTypeExpression, node, () => withSyntaxPayload(phase.JSDocTypeExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type),
        tsonic,
      });
    })),
    JSDocNonNullableType: node => memoSyntaxPlan(JSDocNonNullableType, node, () => withSyntaxPayload(phase.JSDocNonNullableType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type),
        tsonic,
      });
    })),
    JSDocNullableType: node => memoSyntaxPlan(JSDocNullableType, node, () => withSyntaxPayload(phase.JSDocNullableType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type),
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
        type: ports().TypeNode(node.type),
        tsonic,
      });
    })),
    JSDocOptionalType: node => memoSyntaxPlan(JSDocOptionalType, node, () => withSyntaxPayload(phase.JSDocOptionalType, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        type: ports().TypeNode(node.type),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: ports().SyntaxNode(node.typeExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        constraint: ports().SyntaxNode(node.constraint),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        nameExpression: ports().TypeNode(node.nameExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: ports().TypeNode(node.typeExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: ports().TypeNode(node.typeExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        importClause: node.importClause === null ? null : ports().ImportClause(node.importClause).read(),
        moduleSpecifier: ports().Expression(node.moduleSpecifier),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: ports().TypeNode(node.typeExpression),
        name: node.name === null ? null : ports().JSDocFullName(node.name),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: ports().TypeNode(node.typeExpression),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        typeExpression: node.typeExpression === null ? null : ports().SyntaxNode(node.typeExpression),
        name: node.name === null ? null : ports().JSDocFullName(node.name),
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
        type: node.type === null ? null : ports().TypeNode(node.type),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature),
        tsonic,
      });
    })),
    JSDocNameReference: node => memoSyntaxPlan(JSDocNameReference, node, () => withSyntaxPayload(phase.JSDocNameReference, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().EntityName(node.name),
        tsonic,
      });
    })),
    SourceFile: node => memoSyntaxPlan(SourceFile, node, () => withSyntaxPayload(phase.SourceFile, node.tsonic, () => tsonic =>
      ({ kind: "SourceFile", ...sourceOf(node).finish(item => ports().Statement(item)), tsonic }))),
    ModuleDeclaration: node => memoSyntaxPlan(ModuleDeclaration, node, () => withSyntaxPayload(phase.ModuleDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, keyword } = node;
      return tsonic => {
        const fields = structure(node, "namespace");
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), asteriskToken: fields.asterisk(),
          body: optional(fields.body(), ports().NodeBody), keyword, name: ports().ModuleName(fields.name()), tsonic };
      };
    })),
    ImportEqualsDeclaration: node => memoSyntaxPlan(ImportEqualsDeclaration, node, () => withSyntaxPayload(phase.ImportEqualsDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => {
        const fields = structure(node, "import-equals");
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), isTypeOnly,
          name: ports().Identifier(fields.name()).read(), moduleReference: ports().ModuleReference(fields.reference()), tsonic };
      };
    })),
    ExportDeclaration: node => memoSyntaxPlan(ExportDeclaration, node, () => withSyntaxPayload(phase.ExportDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => {
        const fields = structure(node, "export-declaration");
        return { ...header, kind, modifiers: fields.modifiers(ports().ModifierLike), isTypeOnly,
          exportClause: optional(fields.clause(), ports().NamedExportBindings), moduleSpecifier: optional(fields.specifier(), ports().Expression),
          attributes: optional(fields.attributes(), value => ports().ImportAttributes(value).read()), tsonic };
      };
    })),
    ImportTypeNode: node => memoSyntaxPlan(ImportTypeNode, node, () => withSyntaxPayload(phase.ImportTypeNode, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOf } = node;
      return tsonic => {
        const fields = structure(node, "import-type");
        return { ...header, kind, typeArguments: fields.args(ports().TypeNode), isTypeOf, argument: ports().TypeNode(fields.argument()),
          attributes: optional(fields.attributes(), value => ports().ImportAttributes(value).read()),
          qualifier: optional(fields.qualifier(), ports().EntityName), tsonic };
      };
    })),
    ImportClause: node => memoSyntaxPlan(ImportClause, node, () => withSyntaxPayload(phase.ImportClause, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, phaseModifier } = node;
      return tsonic => {
        const fields = structure(node, "import-clause");
        return { ...header, kind, phaseModifier, name: optional(fields.name(), value => ports().Identifier(value).read()),
          namedBindings: optional(fields.bindings(), ports().NamedImportBindings), tsonic };
      };
    })),
    ImportSpecifier: node => memoSyntaxPlan(ImportSpecifier, node, () => withSyntaxPayload(phase.ImportSpecifier, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isTypeOnly } = node;
      return tsonic => {
        const fields = structure(node, "import-specifier");
        return { ...header, kind, isTypeOnly, propertyName: optional(fields.property(), ports().ModuleExportName),
          name: ports().Identifier(fields.name()).read(), tsonic };
      };
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
        name: node.name === null ? null : ports().EntityName(node.name),
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
        name: node.name === null ? null : ports().EntityName(node.name),
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
        name: node.name === null ? null : ports().EntityName(node.name),
        tsonic,
      });
    })),
    JSDocTypeLiteral: node => memoSyntaxPlan(JSDocTypeLiteral, node, () => withSyntaxPayload(phase.JSDocTypeLiteral, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, isArrayType } = node;
      return tsonic => ({
        ...header,
        kind,
        jsDocPropertyTags: node.jsDocPropertyTags === null ? null : node.jsDocPropertyTags.map(item => ports().JSDocTag(item)),
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
        comment: node.comment === null ? null : copyNodeList(node.comment, item => ports().JSDocComment(item)),
        name: ports().EntityName(node.name),
        isBracketed,
        typeExpression: node.typeExpression === null ? null : ports().TypeNode(node.typeExpression),
        isNameFirst,
        tsonic,
      });
    })),
  };
}
