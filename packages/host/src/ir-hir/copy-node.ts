import type {
  Phase, PreparedSyntaxSlot, SignatureSyntaxFields, SyntaxCopyResult, SyntaxNode, SyntaxStructureReceipt, ArrayLiteralExpression, ArrayTypeNode, ArrowFunction, AsExpression, AwaitExpression,
  BigIntLiteral, BinaryExpression, BindingElement, BindingName, BindingPattern,
  Block, BlockOrExpression, BreakStatement, CallExpression,
  CallSignatureDeclaration, CaseBlock, CaseClause, CaseOrDefaultClause, CatchClause,
  ClassDeclaration, ClassElement, ClassExpression, ClassStaticBlockDeclaration, ComputedPropertyName,
  ConditionalExpression, ConditionalTypeNode, ConstructSignatureDeclaration, ConstructorDeclaration, ConstructorTypeNode,
  ContinueStatement, DebuggerStatement, Decorator, DefaultClause, DeleteExpression,
  DoStatement, ElementAccessExpression, EmptyStatement, EntityName, EnumDeclaration,
  EnumMember, ExportAssignment, ExportDeclaration, ExportSpecifier, Expression,
  ExpressionStatement, ExpressionWithTypeArguments, ExternalModuleReference, ForInStatement, ForInitializer,
  ForOfStatement, ForStatement, FunctionDeclaration, FunctionExpression, FunctionSyntaxReceipt, FunctionTypeNode,
  GetAccessorDeclaration, HeritageClause, Identifier, IfStatement, ImportAttribute,
  ImportAttributeName, ImportAttributes, ImportClause, ImportDeclaration, ImportEqualsDeclaration,
  ImportSpecifier, ImportTypeNode, IndexSignatureDeclaration, IndexedAccessTypeNode, InferTypeNode,
  InterfaceDeclaration, IntersectionTypeNode, JSDoc, JSDocAllType, JSDocAugmentsTag,
  JSDocCallbackTag, JSDocComment, JSDocDeprecatedTag, JSDocFullName, JSDocImplementsTag,
  JSDocImportTag, JSDocLink, JSDocLinkCode, JSDocLinkPlain, JSDocNameReference,
  JSDocNonNullableType, JSDocNullableType, JSDocOptionalType, JSDocOverloadTag, JSDocOverrideTag,
  JSDocParameterOrPropertyTag, JSDocPrivateTag, JSDocProtectedTag, JSDocPublicTag, JSDocReadonlyTag,
  JSDocReturnTag, JSDocSatisfiesTag, JSDocSeeTag, JSDocSignature, JSDocTag,
  JSDocTemplateTag, JSDocText, JSDocThisTag, JSDocThrowsTag, JSDocTypeExpression,
  JSDocTypeLiteral, JSDocTypeTag, JSDocTypedefTag, JSDocUnknownTag, JSDocVariadicType,
  JsxAttribute, JsxAttributeLike, JsxAttributeName, JsxAttributeValue, JsxAttributes,
  JsxChild, JsxClosingElement, JsxClosingFragment, JsxElement, JsxExpression,
  JsxFragment, JsxNamespacedName, JsxOpeningElement, JsxOpeningFragment, JsxSelfClosingElement,
  JsxSpreadAttribute, JsxTagNameExpression, JsxText, KeywordExpression, KeywordTypeNode,
  LabeledStatement, LeftHandSideExpression, LiteralTypeChild, LiteralTypeNode, MappedTypeNode,
  MemberName, MetaProperty, MethodDeclaration, MethodSignatureDeclaration, MissingDeclaration,
  ModifierLike, ModuleBlock, ModuleDeclaration, ModuleExportName, ModuleName,
  ModuleReference, NamedExportBindings, NamedExports, NamedImportBindings, NamedImports,
  NamedTupleMember, NamespaceExport, NamespaceExportDeclaration, NamespaceImport, NewExpression,
  NoSubstitutionTemplateLiteral, NodeBody, NodeHeader, NodeList, NonNullExpression,
  NotEmittedStatement, NotEmittedTypeElement, NumericLiteral, ObjectLiteralElementLike, ObjectLiteralExpression,
  OmittedExpression, OptionalTypeNode, ParameterDeclaration, ParenthesizedExpression, ParenthesizedTypeNode,
  PartiallyEmittedExpression, PostfixUnaryExpression, PrefixUnaryExpression, PrivateIdentifier, PropertyAccessExpression,
  PropertyAssignment, PropertyDeclaration, PropertyName, PropertySignatureDeclaration, QualifiedName,
  RegularExpressionLiteral, RestTypeNode, ReturnStatement, SatisfiesExpression, SemicolonClassElement,
  SetAccessorDeclaration, ShorthandPropertyAssignment, SourceFile, SpreadAssignment, SpreadElement,
  Statement, StringLiteral, SwitchStatement, SyntaxList, SyntheticReferenceExpression,
  TaggedTemplateExpression, TemplateExpression, TemplateHead, TemplateLiteral, TemplateLiteralTypeNode,
  TemplateLiteralTypeSpan, TemplateMiddle, TemplateMiddleOrTail, TemplateSpan, TemplateTail,
  ThisTypeNode, ThrowStatement, TryStatement, TupleTypeNode, TypeAliasDeclaration,
  TypeAssertion, TypeElement, TypeLiteralNode, TypeNode, TypeOfExpression,
  TypeOperatorNode, TypeParameterDeclaration, TypePredicateNode, TypePredicateParameterName, TypeQueryNode,
  TypeReferenceNode, UnionTypeNode, VariableDeclaration, VariableDeclarationList, VariableStatement,
  VoidExpression, WhileStatement, WithStatement, YieldExpression,
} from "./contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";

export interface SyntaxPlan<Value extends NodeHeader, Stop, Image> {
  readonly prepare: () => Stop | null;
  readonly materialize: (image: Image) => void;
  readonly read: () => Value;
}

export function copied<Value>(value: Value): { readonly kind: "copied"; readonly value: Value } {
  return { kind: "copied", value };
}

const wrongStructure: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "A syntax constructor requires its actual admitted field receipt." };

export function requireSyntaxStructure<P extends Phase, Kind extends SyntaxStructureReceipt<P>["kind"]>(
  receipt: SyntaxStructureReceipt<P>, kind: Kind): Extract<SyntaxStructureReceipt<P>, { readonly kind: Kind }> {
  function matches(value: SyntaxStructureReceipt<P>): value is Extract<SyntaxStructureReceipt<P>, { readonly kind: Kind }> {
    return value.kind === kind;
  }
  return requirePresent(matches(receipt) ? receipt : undefined, wrongStructure);
}

export function holdSyntaxPayload<Value, Image>(value: Value): SyntaxCopyResult<PreparedSyntaxSlot<Value, Image>, never> {
  return copied(() => value);
}

export function withSyntaxPayload<Payload, Value extends NodeHeader, Stop, Image>(
  project: (value: Payload) => SyntaxCopyResult<PreparedSyntaxSlot<Payload, Image>, Stop>, payload: Payload,
  prepare: () => (payload: Payload) => Value,
): SyntaxCopyResult<PreparedSyntaxSlot<Value, Image>, Stop> {
  const projected = project(payload);
  if (projected.kind === "refused") return projected;
  const build = prepare();
  return copied(image => build(projected.value(image)));
}

export function borrowedSyntaxPlan<Value extends NodeHeader, Image>(value: Value): SyntaxPlan<Value, never, Image> {
  return { prepare: () => null, materialize: () => undefined, read: () => value };
}

export interface SyntaxCopyPorts<P extends Phase, Stop, Image> {
  readonly Identifier: (node: Identifier<P>) => SyntaxPlan<Identifier<P>, Stop, Image>;
  readonly PrivateIdentifier: (node: PrivateIdentifier<P>) => SyntaxPlan<PrivateIdentifier<P>, Stop, Image>;
  readonly QualifiedName: (node: QualifiedName<P>) => SyntaxPlan<QualifiedName<P>, Stop, Image>;
  readonly ComputedPropertyName: (node: ComputedPropertyName<P>) => SyntaxPlan<ComputedPropertyName<P>, Stop, Image>;
  readonly Decorator: (node: Decorator<P>) => SyntaxPlan<Decorator<P>, Stop, Image>;
  readonly EmptyStatement: (node: EmptyStatement<P>) => SyntaxPlan<EmptyStatement<P>, Stop, Image>;
  readonly IfStatement: (node: IfStatement<P>) => SyntaxPlan<IfStatement<P>, Stop, Image>;
  readonly DoStatement: (node: DoStatement<P>) => SyntaxPlan<DoStatement<P>, Stop, Image>;
  readonly WhileStatement: (node: WhileStatement<P>) => SyntaxPlan<WhileStatement<P>, Stop, Image>;
  readonly ForStatement: (node: ForStatement<P>) => SyntaxPlan<ForStatement<P>, Stop, Image>;
  readonly ForInStatement: (node: ForInStatement<P>) => SyntaxPlan<ForInStatement<P>, Stop, Image>;
  readonly ForOfStatement: (node: ForOfStatement<P>) => SyntaxPlan<ForOfStatement<P>, Stop, Image>;
  readonly BreakStatement: (node: BreakStatement<P>) => SyntaxPlan<BreakStatement<P>, Stop, Image>;
  readonly ContinueStatement: (node: ContinueStatement<P>) => SyntaxPlan<ContinueStatement<P>, Stop, Image>;
  readonly ReturnStatement: (node: ReturnStatement<P>) => SyntaxPlan<ReturnStatement<P>, Stop, Image>;
  readonly WithStatement: (node: WithStatement<P>) => SyntaxPlan<WithStatement<P>, Stop, Image>;
  readonly SwitchStatement: (node: SwitchStatement<P>) => SyntaxPlan<SwitchStatement<P>, Stop, Image>;
  readonly CaseBlock: (node: CaseBlock<P>) => SyntaxPlan<CaseBlock<P>, Stop, Image>;
  readonly CaseClause: (node: CaseClause<P>) => SyntaxPlan<CaseClause<P>, Stop, Image>;
  readonly DefaultClause: (node: DefaultClause<P>) => SyntaxPlan<DefaultClause<P>, Stop, Image>;
  readonly ThrowStatement: (node: ThrowStatement<P>) => SyntaxPlan<ThrowStatement<P>, Stop, Image>;
  readonly TryStatement: (node: TryStatement<P>) => SyntaxPlan<TryStatement<P>, Stop, Image>;
  readonly CatchClause: (node: CatchClause<P>) => SyntaxPlan<CatchClause<P>, Stop, Image>;
  readonly DebuggerStatement: (node: DebuggerStatement<P>) => SyntaxPlan<DebuggerStatement<P>, Stop, Image>;
  readonly LabeledStatement: (node: LabeledStatement<P>) => SyntaxPlan<LabeledStatement<P>, Stop, Image>;
  readonly ExpressionStatement: (node: ExpressionStatement<P>) => SyntaxPlan<ExpressionStatement<P>, Stop, Image>;
  readonly Block: (node: Block<P>) => SyntaxPlan<Block<P>, Stop, Image>;
  readonly VariableStatement: (node: VariableStatement<P>) => SyntaxPlan<VariableStatement<P>, Stop, Image>;
  readonly VariableDeclaration: (node: VariableDeclaration<P>) => SyntaxPlan<VariableDeclaration<P>, Stop, Image>;
  readonly VariableDeclarationList: (node: VariableDeclarationList<P>) => SyntaxPlan<VariableDeclarationList<P>, Stop, Image>;
  readonly BindingPattern: (node: BindingPattern<P>) => SyntaxPlan<BindingPattern<P>, Stop, Image>;
  readonly ParameterDeclaration: (node: ParameterDeclaration<P>) => SyntaxPlan<ParameterDeclaration<P>, Stop, Image>;
  readonly BindingElement: (node: BindingElement<P>) => SyntaxPlan<BindingElement<P>, Stop, Image>;
  readonly MissingDeclaration: (node: MissingDeclaration<P>) => SyntaxPlan<MissingDeclaration<P>, Stop, Image>;
  readonly FunctionDeclaration: (node: FunctionDeclaration<P>) => SyntaxPlan<FunctionDeclaration<P>, Stop, Image>;
  readonly ClassDeclaration: (node: ClassDeclaration<P>) => SyntaxPlan<ClassDeclaration<P>, Stop, Image>;
  readonly ClassExpression: (node: ClassExpression<P>) => SyntaxPlan<ClassExpression<P>, Stop, Image>;
  readonly HeritageClause: (node: HeritageClause<P>) => SyntaxPlan<HeritageClause<P>, Stop, Image>;
  readonly InterfaceDeclaration: (node: InterfaceDeclaration<P>) => SyntaxPlan<InterfaceDeclaration<P>, Stop, Image>;
  readonly TypeAliasDeclaration: (node: TypeAliasDeclaration<P>) => SyntaxPlan<TypeAliasDeclaration<P>, Stop, Image>;
  readonly EnumMember: (node: EnumMember<P>) => SyntaxPlan<EnumMember<P>, Stop, Image>;
  readonly EnumDeclaration: (node: EnumDeclaration<P>) => SyntaxPlan<EnumDeclaration<P>, Stop, Image>;
  readonly ModuleBlock: (node: ModuleBlock<P>) => SyntaxPlan<ModuleBlock<P>, Stop, Image>;
  readonly NotEmittedStatement: (node: NotEmittedStatement<P>) => SyntaxPlan<NotEmittedStatement<P>, Stop, Image>;
  readonly NotEmittedTypeElement: (node: NotEmittedTypeElement<P>) => SyntaxPlan<NotEmittedTypeElement<P>, Stop, Image>;
  readonly ImportDeclaration: (node: ImportDeclaration<P>) => SyntaxPlan<ImportDeclaration<P>, Stop, Image>;
  readonly ExternalModuleReference: (node: ExternalModuleReference<P>) => SyntaxPlan<ExternalModuleReference<P>, Stop, Image>;
  readonly NamespaceImport: (node: NamespaceImport<P>) => SyntaxPlan<NamespaceImport<P>, Stop, Image>;
  readonly NamedImports: (node: NamedImports<P>) => SyntaxPlan<NamedImports<P>, Stop, Image>;
  readonly ExportAssignment: (node: ExportAssignment<P>) => SyntaxPlan<ExportAssignment<P>, Stop, Image>;
  readonly NamespaceExportDeclaration: (node: NamespaceExportDeclaration<P>) => SyntaxPlan<NamespaceExportDeclaration<P>, Stop, Image>;
  readonly NamespaceExport: (node: NamespaceExport<P>) => SyntaxPlan<NamespaceExport<P>, Stop, Image>;
  readonly NamedExports: (node: NamedExports<P>) => SyntaxPlan<NamedExports<P>, Stop, Image>;
  readonly ExportSpecifier: (node: ExportSpecifier<P>) => SyntaxPlan<ExportSpecifier<P>, Stop, Image>;
  readonly CallSignatureDeclaration: (node: CallSignatureDeclaration<P>) => SyntaxPlan<CallSignatureDeclaration<P>, Stop, Image>;
  readonly ConstructSignatureDeclaration: (node: ConstructSignatureDeclaration<P>) => SyntaxPlan<ConstructSignatureDeclaration<P>, Stop, Image>;
  readonly ConstructorDeclaration: (node: ConstructorDeclaration<P>) => SyntaxPlan<ConstructorDeclaration<P>, Stop, Image>;
  readonly GetAccessorDeclaration: (node: GetAccessorDeclaration<P>) => SyntaxPlan<GetAccessorDeclaration<P>, Stop, Image>;
  readonly SetAccessorDeclaration: (node: SetAccessorDeclaration<P>) => SyntaxPlan<SetAccessorDeclaration<P>, Stop, Image>;
  readonly IndexSignatureDeclaration: (node: IndexSignatureDeclaration<P>) => SyntaxPlan<IndexSignatureDeclaration<P>, Stop, Image>;
  readonly MethodSignatureDeclaration: (node: MethodSignatureDeclaration<P>) => SyntaxPlan<MethodSignatureDeclaration<P>, Stop, Image>;
  readonly MethodDeclaration: (node: MethodDeclaration<P>) => SyntaxPlan<MethodDeclaration<P>, Stop, Image>;
  readonly PropertySignatureDeclaration: (node: PropertySignatureDeclaration<P>) => SyntaxPlan<PropertySignatureDeclaration<P>, Stop, Image>;
  readonly PropertyDeclaration: (node: PropertyDeclaration<P>) => SyntaxPlan<PropertyDeclaration<P>, Stop, Image>;
  readonly SemicolonClassElement: (node: SemicolonClassElement<P>) => SyntaxPlan<SemicolonClassElement<P>, Stop, Image>;
  readonly ClassStaticBlockDeclaration: (node: ClassStaticBlockDeclaration<P>) => SyntaxPlan<ClassStaticBlockDeclaration<P>, Stop, Image>;
  readonly OmittedExpression: (node: OmittedExpression<P>) => SyntaxPlan<OmittedExpression<P>, Stop, Image>;
  readonly KeywordExpression: (node: KeywordExpression<P>) => SyntaxPlan<KeywordExpression<P>, Stop, Image>;
  readonly StringLiteral: (node: StringLiteral<P>) => SyntaxPlan<StringLiteral<P>, Stop, Image>;
  readonly NumericLiteral: (node: NumericLiteral<P>) => SyntaxPlan<NumericLiteral<P>, Stop, Image>;
  readonly BigIntLiteral: (node: BigIntLiteral<P>) => SyntaxPlan<BigIntLiteral<P>, Stop, Image>;
  readonly RegularExpressionLiteral: (node: RegularExpressionLiteral<P>) => SyntaxPlan<RegularExpressionLiteral<P>, Stop, Image>;
  readonly NoSubstitutionTemplateLiteral: (node: NoSubstitutionTemplateLiteral<P>) => SyntaxPlan<NoSubstitutionTemplateLiteral<P>, Stop, Image>;
  readonly BinaryExpression: (node: BinaryExpression<P>) => SyntaxPlan<BinaryExpression<P>, Stop, Image>;
  readonly PrefixUnaryExpression: (node: PrefixUnaryExpression<P>) => SyntaxPlan<PrefixUnaryExpression<P>, Stop, Image>;
  readonly PostfixUnaryExpression: (node: PostfixUnaryExpression<P>) => SyntaxPlan<PostfixUnaryExpression<P>, Stop, Image>;
  readonly YieldExpression: (node: YieldExpression<P>) => SyntaxPlan<YieldExpression<P>, Stop, Image>;
  readonly ArrowFunction: (node: ArrowFunction<P>) => SyntaxPlan<ArrowFunction<P>, Stop, Image>;
  readonly FunctionExpression: (node: FunctionExpression<P>) => SyntaxPlan<FunctionExpression<P>, Stop, Image>;
  readonly AsExpression: (node: AsExpression<P>) => SyntaxPlan<AsExpression<P>, Stop, Image>;
  readonly SatisfiesExpression: (node: SatisfiesExpression<P>) => SyntaxPlan<SatisfiesExpression<P>, Stop, Image>;
  readonly ConditionalExpression: (node: ConditionalExpression<P>) => SyntaxPlan<ConditionalExpression<P>, Stop, Image>;
  readonly PropertyAccessExpression: (node: PropertyAccessExpression<P>) => SyntaxPlan<PropertyAccessExpression<P>, Stop, Image>;
  readonly ElementAccessExpression: (node: ElementAccessExpression<P>) => SyntaxPlan<ElementAccessExpression<P>, Stop, Image>;
  readonly CallExpression: (node: CallExpression<P>) => SyntaxPlan<CallExpression<P>, Stop, Image>;
  readonly NewExpression: (node: NewExpression<P>) => SyntaxPlan<NewExpression<P>, Stop, Image>;
  readonly MetaProperty: (node: MetaProperty<P>) => SyntaxPlan<MetaProperty<P>, Stop, Image>;
  readonly NonNullExpression: (node: NonNullExpression<P>) => SyntaxPlan<NonNullExpression<P>, Stop, Image>;
  readonly SpreadElement: (node: SpreadElement<P>) => SyntaxPlan<SpreadElement<P>, Stop, Image>;
  readonly TemplateExpression: (node: TemplateExpression<P>) => SyntaxPlan<TemplateExpression<P>, Stop, Image>;
  readonly TemplateSpan: (node: TemplateSpan<P>) => SyntaxPlan<TemplateSpan<P>, Stop, Image>;
  readonly TaggedTemplateExpression: (node: TaggedTemplateExpression<P>) => SyntaxPlan<TaggedTemplateExpression<P>, Stop, Image>;
  readonly ParenthesizedExpression: (node: ParenthesizedExpression<P>) => SyntaxPlan<ParenthesizedExpression<P>, Stop, Image>;
  readonly ArrayLiteralExpression: (node: ArrayLiteralExpression<P>) => SyntaxPlan<ArrayLiteralExpression<P>, Stop, Image>;
  readonly ObjectLiteralExpression: (node: ObjectLiteralExpression<P>) => SyntaxPlan<ObjectLiteralExpression<P>, Stop, Image>;
  readonly SpreadAssignment: (node: SpreadAssignment<P>) => SyntaxPlan<SpreadAssignment<P>, Stop, Image>;
  readonly PropertyAssignment: (node: PropertyAssignment<P>) => SyntaxPlan<PropertyAssignment<P>, Stop, Image>;
  readonly ShorthandPropertyAssignment: (node: ShorthandPropertyAssignment<P>) => SyntaxPlan<ShorthandPropertyAssignment<P>, Stop, Image>;
  readonly DeleteExpression: (node: DeleteExpression<P>) => SyntaxPlan<DeleteExpression<P>, Stop, Image>;
  readonly TypeOfExpression: (node: TypeOfExpression<P>) => SyntaxPlan<TypeOfExpression<P>, Stop, Image>;
  readonly VoidExpression: (node: VoidExpression<P>) => SyntaxPlan<VoidExpression<P>, Stop, Image>;
  readonly AwaitExpression: (node: AwaitExpression<P>) => SyntaxPlan<AwaitExpression<P>, Stop, Image>;
  readonly TypeAssertion: (node: TypeAssertion<P>) => SyntaxPlan<TypeAssertion<P>, Stop, Image>;
  readonly KeywordTypeNode: (node: KeywordTypeNode<P>) => SyntaxPlan<KeywordTypeNode<P>, Stop, Image>;
  readonly UnionTypeNode: (node: UnionTypeNode<P>) => SyntaxPlan<UnionTypeNode<P>, Stop, Image>;
  readonly IntersectionTypeNode: (node: IntersectionTypeNode<P>) => SyntaxPlan<IntersectionTypeNode<P>, Stop, Image>;
  readonly ConditionalTypeNode: (node: ConditionalTypeNode<P>) => SyntaxPlan<ConditionalTypeNode<P>, Stop, Image>;
  readonly TypeOperatorNode: (node: TypeOperatorNode<P>) => SyntaxPlan<TypeOperatorNode<P>, Stop, Image>;
  readonly InferTypeNode: (node: InferTypeNode<P>) => SyntaxPlan<InferTypeNode<P>, Stop, Image>;
  readonly ArrayTypeNode: (node: ArrayTypeNode<P>) => SyntaxPlan<ArrayTypeNode<P>, Stop, Image>;
  readonly IndexedAccessTypeNode: (node: IndexedAccessTypeNode<P>) => SyntaxPlan<IndexedAccessTypeNode<P>, Stop, Image>;
  readonly TypeReferenceNode: (node: TypeReferenceNode<P>) => SyntaxPlan<TypeReferenceNode<P>, Stop, Image>;
  readonly ExpressionWithTypeArguments: (node: ExpressionWithTypeArguments<P>) => SyntaxPlan<ExpressionWithTypeArguments<P>, Stop, Image>;
  readonly LiteralTypeNode: (node: LiteralTypeNode<P>) => SyntaxPlan<LiteralTypeNode<P>, Stop, Image>;
  readonly ThisTypeNode: (node: ThisTypeNode<P>) => SyntaxPlan<ThisTypeNode<P>, Stop, Image>;
  readonly TypePredicateNode: (node: TypePredicateNode<P>) => SyntaxPlan<TypePredicateNode<P>, Stop, Image>;
  readonly ImportAttribute: (node: ImportAttribute<P>) => SyntaxPlan<ImportAttribute<P>, Stop, Image>;
  readonly ImportAttributes: (node: ImportAttributes<P>) => SyntaxPlan<ImportAttributes<P>, Stop, Image>;
  readonly TypeQueryNode: (node: TypeQueryNode<P>) => SyntaxPlan<TypeQueryNode<P>, Stop, Image>;
  readonly MappedTypeNode: (node: MappedTypeNode<P>) => SyntaxPlan<MappedTypeNode<P>, Stop, Image>;
  readonly TypeLiteralNode: (node: TypeLiteralNode<P>) => SyntaxPlan<TypeLiteralNode<P>, Stop, Image>;
  readonly TupleTypeNode: (node: TupleTypeNode<P>) => SyntaxPlan<TupleTypeNode<P>, Stop, Image>;
  readonly NamedTupleMember: (node: NamedTupleMember<P>) => SyntaxPlan<NamedTupleMember<P>, Stop, Image>;
  readonly OptionalTypeNode: (node: OptionalTypeNode<P>) => SyntaxPlan<OptionalTypeNode<P>, Stop, Image>;
  readonly RestTypeNode: (node: RestTypeNode<P>) => SyntaxPlan<RestTypeNode<P>, Stop, Image>;
  readonly ParenthesizedTypeNode: (node: ParenthesizedTypeNode<P>) => SyntaxPlan<ParenthesizedTypeNode<P>, Stop, Image>;
  readonly FunctionTypeNode: (node: FunctionTypeNode<P>) => SyntaxPlan<FunctionTypeNode<P>, Stop, Image>;
  readonly ConstructorTypeNode: (node: ConstructorTypeNode<P>) => SyntaxPlan<ConstructorTypeNode<P>, Stop, Image>;
  readonly TemplateHead: (node: TemplateHead<P>) => SyntaxPlan<TemplateHead<P>, Stop, Image>;
  readonly TemplateMiddle: (node: TemplateMiddle<P>) => SyntaxPlan<TemplateMiddle<P>, Stop, Image>;
  readonly TemplateTail: (node: TemplateTail<P>) => SyntaxPlan<TemplateTail<P>, Stop, Image>;
  readonly TemplateLiteralTypeNode: (node: TemplateLiteralTypeNode<P>) => SyntaxPlan<TemplateLiteralTypeNode<P>, Stop, Image>;
  readonly TemplateLiteralTypeSpan: (node: TemplateLiteralTypeSpan<P>) => SyntaxPlan<TemplateLiteralTypeSpan<P>, Stop, Image>;
  readonly PartiallyEmittedExpression: (node: PartiallyEmittedExpression<P>) => SyntaxPlan<PartiallyEmittedExpression<P>, Stop, Image>;
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
  readonly TypeParameterDeclaration: (node: TypeParameterDeclaration<P>) => SyntaxPlan<TypeParameterDeclaration<P>, Stop, Image>;
  readonly SyntheticReferenceExpression: (node: SyntheticReferenceExpression<P>) => SyntaxPlan<SyntheticReferenceExpression<P>, Stop, Image>;
  readonly JSDocTypeLiteral: (node: JSDocTypeLiteral<P>) => SyntaxPlan<JSDocTypeLiteral<P>, Stop, Image>;
  readonly JSDocParameterOrPropertyTag: (node: JSDocParameterOrPropertyTag<P>) => SyntaxPlan<JSDocParameterOrPropertyTag<P>, Stop, Image>;
  readonly EntityName: (node: EntityName<P>) => EntityName<P>;
  readonly Expression: (node: Expression<P>) => Expression<P>;
  readonly LeftHandSideExpression: (node: LeftHandSideExpression<P>) => LeftHandSideExpression<P>;
  readonly Statement: (node: Statement<P>) => Statement<P>;
  readonly ForInitializer: (node: ForInitializer<P>) => ForInitializer<P>;
  readonly CaseOrDefaultClause: (node: CaseOrDefaultClause<P>) => CaseOrDefaultClause<P>;
  readonly BindingName: (node: BindingName<P>) => BindingName<P>;
  readonly TypeNode: (node: TypeNode<P>) => TypeNode<P>;
  readonly PropertyName: (node: PropertyName<P>) => PropertyName<P>;
  readonly BlockOrExpression: (node: BlockOrExpression<P>) => BlockOrExpression<P>;
  readonly ClassElement: (node: ClassElement<P>) => ClassElement<P>;
  readonly TypeElement: (node: TypeElement<P>) => TypeElement<P>;
  readonly ModuleExportName: (node: ModuleExportName<P>) => ModuleExportName<P>;
  readonly MemberName: (node: MemberName<P>) => MemberName<P>;
  readonly TemplateMiddleOrTail: (node: TemplateMiddleOrTail<P>) => TemplateMiddleOrTail<P>;
  readonly TemplateLiteral: (node: TemplateLiteral<P>) => TemplateLiteral<P>;
  readonly ObjectLiteralElementLike: (node: ObjectLiteralElementLike<P>) => ObjectLiteralElementLike<P>;
  readonly LiteralTypeChild: (node: LiteralTypeChild<P>) => LiteralTypeChild<P>;
  readonly TypePredicateParameterName: (node: TypePredicateParameterName<P>) => TypePredicateParameterName<P>;
  readonly ImportAttributeName: (node: ImportAttributeName<P>) => ImportAttributeName<P>;
  readonly JsxChild: (node: JsxChild<P>) => JsxChild<P>;
  readonly JsxAttributeLike: (node: JsxAttributeLike<P>) => JsxAttributeLike<P>;
  readonly JsxTagNameExpression: (node: JsxTagNameExpression<P>) => JsxTagNameExpression<P>;
  readonly JsxAttributeName: (node: JsxAttributeName<P>) => JsxAttributeName<P>;
  readonly JsxAttributeValue: (node: JsxAttributeValue<P>) => JsxAttributeValue<P>;
  readonly JSDocComment: (node: JSDocComment<P>) => JSDocComment<P>;
  readonly JSDocTag: (node: JSDocTag<P>) => JSDocTag<P>;
  readonly JSDocFullName: (node: JSDocFullName<P>) => JSDocFullName<P>;
  readonly NodeBody: (node: NodeBody<P>) => NodeBody<P>;
  readonly ModuleName: (node: ModuleName<P>) => ModuleName<P>;
  readonly ModuleReference: (node: ModuleReference<P>) => ModuleReference<P>;
  readonly NamedExportBindings: (node: NamedExportBindings<P>) => NamedExportBindings<P>;
  readonly NamedImportBindings: (node: NamedImportBindings<P>) => NamedImportBindings<P>;
  readonly ModifierLike: (node: ModifierLike<P>) => ModifierLike<P>;
  readonly SyntaxNode: (node: SyntaxNode<P>) => SyntaxNode<P>;
  readonly LiteralKeywordExpression: (node: KeywordExpression<P, "TrueKeyword" | "FalseKeyword" | "NullKeyword">) => SyntaxPlan<KeywordExpression<P, "TrueKeyword" | "FalseKeyword" | "NullKeyword">, Stop, Image>;
}

export function syntaxHeader(node: NodeHeader): NodeHeader {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

export function copyNodeList<Value>(list: NodeList<Value>, copy: (value: Value) => Value): NodeList<Value> {
  return { loc: list.loc, nodes: list.nodes.map(copy) };
}

export function finishFunctionSyntax<P extends Phase, Stop, Image>(shape: FunctionSyntaxReceipt<P>, ports: SyntaxCopyPorts<P, Stop, Image>) {
  return shape.finish(formal => ports.ParameterDeclaration(formal).read(), body => ports.BlockOrExpression(body),
    modifier => ports.ModifierLike(modifier), parameter => ports.TypeParameterDeclaration(parameter).read(),
    type => ports.TypeNode(type), name => ports.Identifier(name).read());
}

export function finishSignatureSyntax<P extends Phase, Stop, Image>(shape: SignatureSyntaxFields<P>, ports: SyntaxCopyPorts<P, Stop, Image>) {
  const type = shape.type();
  const full = shape.full();
  return { typeParameters: shape.typeParameters(parameter => ports.TypeParameterDeclaration(parameter).read()),
    parameters: shape.parameters(formal => ports.ParameterDeclaration(formal).read()),
    type: type === null ? null : ports.TypeNode(type), fullSignature: full === null ? null : ports.TypeNode(full) };
}

const unmaterialized: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "A syntax child must be materialized in the admitted postorder before its parent." };

export function memoSyntaxPlan<Source extends NodeHeader, Value extends NodeHeader, Stop, Image>(
  plans: Map<Source, SyntaxPlan<Value, Stop, Image>>,
  source: Source,
  prepare: () => SyntaxCopyResult<PreparedSyntaxSlot<Value, Image>, Stop>,
): SyntaxPlan<Value, Stop, Image> {
  const previous = plans.get(source);
  if (previous !== undefined) return previous;
  let build: PreparedSyntaxSlot<Value, Image> | undefined;
  let completed: Value | undefined;
  const plan: SyntaxPlan<Value, Stop, Image> = {
    prepare: () => {
      if (build !== undefined) return null;
      const result = prepare();
      if (result.kind === "refused") return result.stop;
      build = result.value;
      plans.set(source, plan);
      return null;
    },
    materialize: image => {
      if (completed === undefined) completed = requirePresent(build, unmaterialized)(image);
    },
    read: () => requirePresent(completed, unmaterialized),
  };
  return plan;
}

export function planSyntaxNode<P extends Phase, Stop, Image>(ports: SyntaxCopyPorts<P, Stop, Image>, node: SyntaxNode<P>,
  kindOf: (kind: SyntaxNode<P>["kind"]) => void): SyntaxPlan<SyntaxNode<P>, Stop, Image> {
  const kind = node.kind;
  kindOf(kind);
  switch (kind) {
    case "Identifier": return ports.Identifier(node);
    case "PrivateIdentifier": return ports.PrivateIdentifier(node);
    case "QualifiedName": return ports.QualifiedName(node);
    case "ComputedPropertyName": return ports.ComputedPropertyName(node);
    case "Decorator": return ports.Decorator(node);
    case "EmptyStatement": return ports.EmptyStatement(node);
    case "IfStatement": return ports.IfStatement(node);
    case "DoStatement": return ports.DoStatement(node);
    case "WhileStatement": return ports.WhileStatement(node);
    case "ForStatement": return ports.ForStatement(node);
    case "ForInStatement": return ports.ForInStatement(node);
    case "ForOfStatement": return ports.ForOfStatement(node);
    case "BreakStatement": return ports.BreakStatement(node);
    case "ContinueStatement": return ports.ContinueStatement(node);
    case "ReturnStatement": return ports.ReturnStatement(node);
    case "WithStatement": return ports.WithStatement(node);
    case "SwitchStatement": return ports.SwitchStatement(node);
    case "CaseBlock": return ports.CaseBlock(node);
    case "CaseClause": return ports.CaseClause(node);
    case "DefaultClause": return ports.DefaultClause(node);
    case "ThrowStatement": return ports.ThrowStatement(node);
    case "TryStatement": return ports.TryStatement(node);
    case "CatchClause": return ports.CatchClause(node);
    case "DebuggerStatement": return ports.DebuggerStatement(node);
    case "LabeledStatement": return ports.LabeledStatement(node);
    case "ExpressionStatement": return ports.ExpressionStatement(node);
    case "Block": return ports.Block(node);
    case "VariableStatement": return ports.VariableStatement(node);
    case "VariableDeclaration": return ports.VariableDeclaration(node);
    case "VariableDeclarationList": return ports.VariableDeclarationList(node);
    case "ObjectBindingPattern": case "ArrayBindingPattern": return ports.BindingPattern(node);
    case "Parameter": return ports.ParameterDeclaration(node);
    case "BindingElement": return ports.BindingElement(node);
    case "MissingDeclaration": return ports.MissingDeclaration(node);
    case "FunctionDeclaration": return ports.FunctionDeclaration(node);
    case "ClassDeclaration": return ports.ClassDeclaration(node);
    case "ClassExpression": return ports.ClassExpression(node);
    case "HeritageClause": return ports.HeritageClause(node);
    case "InterfaceDeclaration": return ports.InterfaceDeclaration(node);
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": return ports.TypeAliasDeclaration(node);
    case "EnumMember": return ports.EnumMember(node);
    case "EnumDeclaration": return ports.EnumDeclaration(node);
    case "ModuleBlock": return ports.ModuleBlock(node);
    case "NotEmittedStatement": return ports.NotEmittedStatement(node);
    case "NotEmittedTypeElement": return ports.NotEmittedTypeElement(node);
    case "ImportDeclaration": case "JSImportDeclaration": return ports.ImportDeclaration(node);
    case "ExternalModuleReference": return ports.ExternalModuleReference(node);
    case "NamespaceImport": return ports.NamespaceImport(node);
    case "NamedImports": return ports.NamedImports(node);
    case "ExportAssignment": return ports.ExportAssignment(node);
    case "NamespaceExportDeclaration": return ports.NamespaceExportDeclaration(node);
    case "NamespaceExport": return ports.NamespaceExport(node);
    case "NamedExports": return ports.NamedExports(node);
    case "ExportSpecifier": return ports.ExportSpecifier(node);
    case "CallSignature": return ports.CallSignatureDeclaration(node);
    case "ConstructSignature": return ports.ConstructSignatureDeclaration(node);
    case "Constructor": return ports.ConstructorDeclaration(node);
    case "GetAccessor": return ports.GetAccessorDeclaration(node);
    case "SetAccessor": return ports.SetAccessorDeclaration(node);
    case "IndexSignature": return ports.IndexSignatureDeclaration(node);
    case "MethodSignature": return ports.MethodSignatureDeclaration(node);
    case "MethodDeclaration": return ports.MethodDeclaration(node);
    case "PropertySignature": return ports.PropertySignatureDeclaration(node);
    case "PropertyDeclaration": return ports.PropertyDeclaration(node);
    case "SemicolonClassElement": return ports.SemicolonClassElement(node);
    case "ClassStaticBlockDeclaration": return ports.ClassStaticBlockDeclaration(node);
    case "OmittedExpression": return ports.OmittedExpression(node);
    case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword": case "SuperKeyword": case "ImportKeyword": return ports.KeywordExpression(node);
    case "StringLiteral": return ports.StringLiteral(node);
    case "NumericLiteral": return ports.NumericLiteral(node);
    case "BigIntLiteral": return ports.BigIntLiteral(node);
    case "RegularExpressionLiteral": return ports.RegularExpressionLiteral(node);
    case "NoSubstitutionTemplateLiteral": return ports.NoSubstitutionTemplateLiteral(node);
    case "BinaryExpression": return ports.BinaryExpression(node);
    case "PrefixUnaryExpression": return ports.PrefixUnaryExpression(node);
    case "PostfixUnaryExpression": return ports.PostfixUnaryExpression(node);
    case "YieldExpression": return ports.YieldExpression(node);
    case "ArrowFunction": return ports.ArrowFunction(node);
    case "FunctionExpression": return ports.FunctionExpression(node);
    case "AsExpression": return ports.AsExpression(node);
    case "SatisfiesExpression": return ports.SatisfiesExpression(node);
    case "ConditionalExpression": return ports.ConditionalExpression(node);
    case "PropertyAccessExpression": return ports.PropertyAccessExpression(node);
    case "ElementAccessExpression": return ports.ElementAccessExpression(node);
    case "CallExpression": return ports.CallExpression(node);
    case "NewExpression": return ports.NewExpression(node);
    case "MetaProperty": return ports.MetaProperty(node);
    case "NonNullExpression": return ports.NonNullExpression(node);
    case "SpreadElement": return ports.SpreadElement(node);
    case "TemplateExpression": return ports.TemplateExpression(node);
    case "TemplateSpan": return ports.TemplateSpan(node);
    case "TaggedTemplateExpression": return ports.TaggedTemplateExpression(node);
    case "ParenthesizedExpression": return ports.ParenthesizedExpression(node);
    case "ArrayLiteralExpression": return ports.ArrayLiteralExpression(node);
    case "ObjectLiteralExpression": return ports.ObjectLiteralExpression(node);
    case "SpreadAssignment": return ports.SpreadAssignment(node);
    case "PropertyAssignment": return ports.PropertyAssignment(node);
    case "ShorthandPropertyAssignment": return ports.ShorthandPropertyAssignment(node);
    case "DeleteExpression": return ports.DeleteExpression(node);
    case "TypeOfExpression": return ports.TypeOfExpression(node);
    case "VoidExpression": return ports.VoidExpression(node);
    case "AwaitExpression": return ports.AwaitExpression(node);
    case "TypeAssertionExpression": return ports.TypeAssertion(node);
    case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword": case "IntrinsicKeyword": case "NeverKeyword": case "NumberKeyword": case "ObjectKeyword": case "StringKeyword": case "SymbolKeyword": case "UndefinedKeyword": case "UnknownKeyword": case "VoidKeyword": return ports.KeywordTypeNode(node);
    case "UnionType": return ports.UnionTypeNode(node);
    case "IntersectionType": return ports.IntersectionTypeNode(node);
    case "ConditionalType": return ports.ConditionalTypeNode(node);
    case "TypeOperator": return ports.TypeOperatorNode(node);
    case "InferType": return ports.InferTypeNode(node);
    case "ArrayType": return ports.ArrayTypeNode(node);
    case "IndexedAccessType": return ports.IndexedAccessTypeNode(node);
    case "TypeReference": return ports.TypeReferenceNode(node);
    case "ExpressionWithTypeArguments": return ports.ExpressionWithTypeArguments(node);
    case "LiteralType": return ports.LiteralTypeNode(node);
    case "ThisType": return ports.ThisTypeNode(node);
    case "TypePredicate": return ports.TypePredicateNode(node);
    case "ImportAttribute": return ports.ImportAttribute(node);
    case "ImportAttributes": return ports.ImportAttributes(node);
    case "TypeQuery": return ports.TypeQueryNode(node);
    case "MappedType": return ports.MappedTypeNode(node);
    case "TypeLiteral": return ports.TypeLiteralNode(node);
    case "TupleType": return ports.TupleTypeNode(node);
    case "NamedTupleMember": return ports.NamedTupleMember(node);
    case "OptionalType": return ports.OptionalTypeNode(node);
    case "RestType": return ports.RestTypeNode(node);
    case "ParenthesizedType": return ports.ParenthesizedTypeNode(node);
    case "FunctionType": return ports.FunctionTypeNode(node);
    case "ConstructorType": return ports.ConstructorTypeNode(node);
    case "TemplateHead": return ports.TemplateHead(node);
    case "TemplateMiddle": return ports.TemplateMiddle(node);
    case "TemplateTail": return ports.TemplateTail(node);
    case "TemplateLiteralType": return ports.TemplateLiteralTypeNode(node);
    case "TemplateLiteralTypeSpan": return ports.TemplateLiteralTypeSpan(node);
    case "PartiallyEmittedExpression": return ports.PartiallyEmittedExpression(node);
    case "JsxElement": return ports.JsxElement(node);
    case "JsxAttributes": return ports.JsxAttributes(node);
    case "JsxNamespacedName": return ports.JsxNamespacedName(node);
    case "JsxOpeningElement": return ports.JsxOpeningElement(node);
    case "JsxSelfClosingElement": return ports.JsxSelfClosingElement(node);
    case "JsxFragment": return ports.JsxFragment(node);
    case "JsxOpeningFragment": return ports.JsxOpeningFragment(node);
    case "JsxClosingFragment": return ports.JsxClosingFragment(node);
    case "JsxAttribute": return ports.JsxAttribute(node);
    case "JsxSpreadAttribute": return ports.JsxSpreadAttribute(node);
    case "JsxClosingElement": return ports.JsxClosingElement(node);
    case "JsxExpression": return ports.JsxExpression(node);
    case "JsxText": return ports.JsxText(node);
    case "SyntaxList": return ports.SyntaxList(node);
    case "JSDoc": return ports.JSDoc(node);
    case "JSDocTypeExpression": return ports.JSDocTypeExpression(node);
    case "JSDocNonNullableType": return ports.JSDocNonNullableType(node);
    case "JSDocNullableType": return ports.JSDocNullableType(node);
    case "JSDocAllType": return ports.JSDocAllType(node);
    case "JSDocVariadicType": return ports.JSDocVariadicType(node);
    case "JSDocOptionalType": return ports.JSDocOptionalType(node);
    case "JSDocTypeTag": return ports.JSDocTypeTag(node);
    case "JSDocUnknownTag": return ports.JSDocUnknownTag(node);
    case "JSDocTemplateTag": return ports.JSDocTemplateTag(node);
    case "JSDocReturnTag": return ports.JSDocReturnTag(node);
    case "JSDocPublicTag": return ports.JSDocPublicTag(node);
    case "JSDocPrivateTag": return ports.JSDocPrivateTag(node);
    case "JSDocProtectedTag": return ports.JSDocProtectedTag(node);
    case "JSDocReadonlyTag": return ports.JSDocReadonlyTag(node);
    case "JSDocOverrideTag": return ports.JSDocOverrideTag(node);
    case "JSDocDeprecatedTag": return ports.JSDocDeprecatedTag(node);
    case "JSDocSeeTag": return ports.JSDocSeeTag(node);
    case "JSDocImplementsTag": return ports.JSDocImplementsTag(node);
    case "JSDocAugmentsTag": return ports.JSDocAugmentsTag(node);
    case "JSDocSatisfiesTag": return ports.JSDocSatisfiesTag(node);
    case "JSDocThrowsTag": return ports.JSDocThrowsTag(node);
    case "JSDocThisTag": return ports.JSDocThisTag(node);
    case "JSDocImportTag": return ports.JSDocImportTag(node);
    case "JSDocCallbackTag": return ports.JSDocCallbackTag(node);
    case "JSDocOverloadTag": return ports.JSDocOverloadTag(node);
    case "JSDocTypedefTag": return ports.JSDocTypedefTag(node);
    case "JSDocSignature": return ports.JSDocSignature(node);
    case "JSDocNameReference": return ports.JSDocNameReference(node);
    case "SourceFile": return ports.SourceFile(node);
    case "ModuleDeclaration": return ports.ModuleDeclaration(node);
    case "ImportEqualsDeclaration": return ports.ImportEqualsDeclaration(node);
    case "ExportDeclaration": return ports.ExportDeclaration(node);
    case "ImportType": return ports.ImportTypeNode(node);
    case "ImportClause": return ports.ImportClause(node);
    case "ImportSpecifier": return ports.ImportSpecifier(node);
    case "JSDocText": return ports.JSDocText(node);
    case "JSDocLink": return ports.JSDocLink(node);
    case "JSDocLinkPlain": return ports.JSDocLinkPlain(node);
    case "JSDocLinkCode": return ports.JSDocLinkCode(node);
    case "TypeParameter": return ports.TypeParameterDeclaration(node);
    case "SyntheticReferenceExpression": return ports.SyntheticReferenceExpression(node);
    case "JSDocTypeLiteral": return ports.JSDocTypeLiteral(node);
    case "JSDocParameterTag": case "JSDocPropertyTag": return ports.JSDocParameterOrPropertyTag(node);
    case "Unknown": case "EndOfFile": case "SingleLineCommentTrivia": case "MultiLineCommentTrivia":
    case "NewLineTrivia": case "WhitespaceTrivia": case "ConflictMarkerTrivia": case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces": case "OpenBraceToken": case "CloseBraceToken": case "OpenParenToken":
    case "CloseParenToken": case "OpenBracketToken": case "CloseBracketToken": case "DotToken":
    case "DotDotDotToken": case "SemicolonToken": case "CommaToken": case "QuestionDotToken":
    case "LessThanToken": case "LessThanSlashToken": case "GreaterThanToken": case "LessThanEqualsToken":
    case "GreaterThanEqualsToken": case "EqualsEqualsToken": case "ExclamationEqualsToken": case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken": case "EqualsGreaterThanToken": case "PlusToken": case "MinusToken":
    case "AsteriskToken": case "AsteriskAsteriskToken": case "SlashToken": case "PercentToken":
    case "PlusPlusToken": case "MinusMinusToken": case "LessThanLessThanToken": case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken": case "AmpersandToken": case "BarToken": case "CaretToken":
    case "ExclamationToken": case "TildeToken": case "AmpersandAmpersandToken": case "BarBarToken":
    case "QuestionToken": case "ColonToken": case "AtToken": case "QuestionQuestionToken":
    case "BacktickToken": case "HashToken": case "EqualsToken": case "PlusEqualsToken":
    case "MinusEqualsToken": case "AsteriskEqualsToken": case "AsteriskAsteriskEqualsToken": case "SlashEqualsToken":
    case "PercentEqualsToken": case "LessThanLessThanEqualsToken": case "GreaterThanGreaterThanEqualsToken": case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken": case "BarEqualsToken": case "BarBarEqualsToken": case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken": case "CaretEqualsToken": case "JSDocCommentTextToken": case "BreakKeyword":
    case "CaseKeyword": case "CatchKeyword": case "ClassKeyword": case "ConstKeyword":
    case "ContinueKeyword": case "DebuggerKeyword": case "DefaultKeyword": case "DeleteKeyword":
    case "DoKeyword": case "ElseKeyword": case "EnumKeyword": case "ExportKeyword":
    case "ExtendsKeyword": case "FinallyKeyword": case "ForKeyword": case "FunctionKeyword":
    case "IfKeyword": case "InKeyword": case "InstanceOfKeyword": case "NewKeyword":
    case "ReturnKeyword": case "SwitchKeyword": case "ThrowKeyword": case "TryKeyword":
    case "TypeOfKeyword": case "VarKeyword": case "WhileKeyword": case "WithKeyword":
    case "ImplementsKeyword": case "InterfaceKeyword": case "LetKeyword": case "PackageKeyword":
    case "PrivateKeyword": case "ProtectedKeyword": case "PublicKeyword": case "StaticKeyword":
    case "YieldKeyword": case "AbstractKeyword": case "AccessorKeyword": case "AsKeyword":
    case "AssertsKeyword": case "AssertKeyword": case "AsyncKeyword": case "AwaitKeyword":
    case "ConstructorKeyword": case "DeclareKeyword": case "GetKeyword": case "ImmediateKeyword":
    case "InferKeyword": case "IsKeyword": case "KeyOfKeyword": case "ModuleKeyword":
    case "NamespaceKeyword": case "OutKeyword": case "ReadonlyKeyword": case "RequireKeyword":
    case "SatisfiesKeyword": case "SetKeyword": case "TypeKeyword": case "UniqueKeyword":
    case "UsingKeyword": case "FromKeyword": case "GlobalKeyword": case "OverrideKeyword":
    case "OfKeyword": case "DeferKeyword":
      return borrowedSyntaxPlan(node);
  }
}
