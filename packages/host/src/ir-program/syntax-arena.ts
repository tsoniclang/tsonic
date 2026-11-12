import type {
  SyntaxNode, ArrayLiteralExpression, ArrayTypeNode, ArrowFunction, AsExpression, AwaitExpression,
  BigIntLiteral, BinaryExpression, BindingElement, BindingName, BindingPattern,
  Block, BlockOrExpression, BodyRoot, BreakStatement, CallExpression,
  CallSignatureDeclaration, CaseBlock, CaseClause, CaseOrDefaultClause, CatchClause,
  ClassDeclaration, ClassElement, ClassExpression, ClassStaticBlockDeclaration, ComputedPropertyName,
  ConditionalExpression, ConditionalTypeNode, ConstructSignatureDeclaration, ConstructorDeclaration, ConstructorTypeNode,
  ContinueStatement, DebuggerStatement, Decorator, DefaultClause, DeleteExpression,
  DoStatement, ElementAccessExpression, EmptyStatement, EntityName, EnumDeclaration,
  EnumMember, ExportAssignment, ExportDeclaration, ExportSpecifier, Expression,
  ExpressionStatement, ExpressionWithTypeArguments, ExternalModuleReference, ForInStatement, ForInitializer,
  ForOfStatement, ForStatement, FunctionDeclaration, FunctionExpression, FunctionTypeNode,
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
} from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { ModuleBodies } from "./contract.js";
import type { SyntaxEdge } from "./syntax-edges.js";
import { iterateSyntaxEdges } from "./syntax-edges.js";

export interface SyntaxRoot {
  readonly node: SyntaxNode<TypedPhase>;
  readonly path: string;
}

export interface SyntaxInventory {
  readonly nodes: readonly SyntaxNode<TypedPhase>[];
  readonly postorder: readonly SyntaxNode<TypedPhase>[];
  readonly wire: ReadonlyMap<SyntaxNode<TypedPhase>, number>;
  readonly firstRootSize: number;
}

export function moduleSyntaxRoots(module: ModuleBodies, at: string): readonly SyntaxRoot[] {
  return [
    { node: module.tree, path: at + ".tree" },
    ...module.bodies.map((body, position) => ({ node: body.tir.root, path: at + ".bodies[" + position + "].tir.root" })),
  ];
}

export type SyntaxVisit =
  | { readonly kind: "node"; readonly node: SyntaxNode<TypedPhase> }
  | { readonly kind: "edge"; readonly node: SyntaxNode<TypedPhase> };

export function inventorySyntax(roots: readonly SyntaxRoot[]): SyntaxInventory {
  const traversal = walkSyntax(roots);
  let step = traversal.next();
  while (!step.done) step = traversal.next();
  return step.value;
}

export function* walkSyntax(roots: readonly SyntaxRoot[]): Generator<SyntaxVisit, SyntaxInventory> {
  interface Path { readonly parent: Path | null; readonly segment: string }
  type Work = { readonly kind: "enter"; readonly node: SyntaxNode<TypedPhase>; readonly path: Path }
    | { readonly kind: "leave"; readonly node: SyntaxNode<TypedPhase> }
    | { readonly kind: "children"; readonly iterator: Iterator<SyntaxEdge>; readonly path: Path }
    | { readonly kind: "first-root-end" };
  const wire = new Map<SyntaxNode<TypedPhase>, number>();
  const active = new Set<SyntaxNode<TypedPhase>>();
  const nodes: SyntaxNode<TypedPhase>[] = [];
  const postorder: SyntaxNode<TypedPhase>[] = [];
  const pending: Work[] = [];
  let firstRootSize = 0;
  for (const [position, root] of roots.entries()) {
    pending.push({ kind: "enter", node: root.node, path: { parent: null, segment: root.path } });
    if (position === 0) pending.push({ kind: "first-root-end" });
  }
  pending.reverse();
  let task = pending.pop();
  while (task !== undefined) {
    switch (task.kind) {
      case "first-root-end": firstRootSize = nodes.length; break;
      case "leave": active.delete(task.node); postorder.push(task.node); break;
      case "children": {
        const child = task.iterator.next();
        if (!child.done) {
          yield { kind: "edge", node: child.value.node };
          pending.push(task);
          pending.push({
            kind: "enter", node: child.value.node, path: { parent: task.path, segment: child.value.segment },
          });
        }
        break;
      }
      case "enter": {
        if (active.has(task.node)) {
          const segments: string[] = [];
          let path: Path | null = task.path;
          while (path !== null) { segments.push(path.segment); path = path.parent; }
          throw new TypeError("Syntax object cycle at " + segments.reverse().join(""));
        }
        if (!wire.has(task.node)) {
          yield { kind: "node", node: task.node };
          active.add(task.node);
          wire.set(task.node, nodes.length);
          nodes.push(task.node);
          pending.push({ kind: "leave", node: task.node });
          pending.push({ kind: "children", iterator: iterateSyntaxEdges(task.node), path: task.path });
        }
        break;
      }
    }
    task = pending.pop();
  }
  return { nodes, postorder, wire, firstRootSize };
}

export type SyntaxPlan<Value extends SyntaxNode<TypedPhase>> = () => Value;

export interface SyntaxCopyPorts {
  readonly Identifier: (node: Identifier<TypedPhase>) => SyntaxPlan<Identifier<TypedPhase>>;
  readonly PrivateIdentifier: (node: PrivateIdentifier<TypedPhase>) => SyntaxPlan<PrivateIdentifier<TypedPhase>>;
  readonly QualifiedName: (node: QualifiedName<TypedPhase>) => SyntaxPlan<QualifiedName<TypedPhase>>;
  readonly ComputedPropertyName: (node: ComputedPropertyName<TypedPhase>) => SyntaxPlan<ComputedPropertyName<TypedPhase>>;
  readonly Decorator: (node: Decorator<TypedPhase>) => SyntaxPlan<Decorator<TypedPhase>>;
  readonly EmptyStatement: (node: EmptyStatement<TypedPhase>) => SyntaxPlan<EmptyStatement<TypedPhase>>;
  readonly IfStatement: (node: IfStatement<TypedPhase>) => SyntaxPlan<IfStatement<TypedPhase>>;
  readonly DoStatement: (node: DoStatement<TypedPhase>) => SyntaxPlan<DoStatement<TypedPhase>>;
  readonly WhileStatement: (node: WhileStatement<TypedPhase>) => SyntaxPlan<WhileStatement<TypedPhase>>;
  readonly ForStatement: (node: ForStatement<TypedPhase>) => SyntaxPlan<ForStatement<TypedPhase>>;
  readonly ForInStatement: (node: ForInStatement<TypedPhase>) => SyntaxPlan<ForInStatement<TypedPhase>>;
  readonly ForOfStatement: (node: ForOfStatement<TypedPhase>) => SyntaxPlan<ForOfStatement<TypedPhase>>;
  readonly BreakStatement: (node: BreakStatement<TypedPhase>) => SyntaxPlan<BreakStatement<TypedPhase>>;
  readonly ContinueStatement: (node: ContinueStatement<TypedPhase>) => SyntaxPlan<ContinueStatement<TypedPhase>>;
  readonly ReturnStatement: (node: ReturnStatement<TypedPhase>) => SyntaxPlan<ReturnStatement<TypedPhase>>;
  readonly WithStatement: (node: WithStatement<TypedPhase>) => SyntaxPlan<WithStatement<TypedPhase>>;
  readonly SwitchStatement: (node: SwitchStatement<TypedPhase>) => SyntaxPlan<SwitchStatement<TypedPhase>>;
  readonly CaseBlock: (node: CaseBlock<TypedPhase>) => SyntaxPlan<CaseBlock<TypedPhase>>;
  readonly CaseClause: (node: CaseClause<TypedPhase>) => SyntaxPlan<CaseClause<TypedPhase>>;
  readonly DefaultClause: (node: DefaultClause<TypedPhase>) => SyntaxPlan<DefaultClause<TypedPhase>>;
  readonly ThrowStatement: (node: ThrowStatement<TypedPhase>) => SyntaxPlan<ThrowStatement<TypedPhase>>;
  readonly TryStatement: (node: TryStatement<TypedPhase>) => SyntaxPlan<TryStatement<TypedPhase>>;
  readonly CatchClause: (node: CatchClause<TypedPhase>) => SyntaxPlan<CatchClause<TypedPhase>>;
  readonly DebuggerStatement: (node: DebuggerStatement<TypedPhase>) => SyntaxPlan<DebuggerStatement<TypedPhase>>;
  readonly LabeledStatement: (node: LabeledStatement<TypedPhase>) => SyntaxPlan<LabeledStatement<TypedPhase>>;
  readonly ExpressionStatement: (node: ExpressionStatement<TypedPhase>) => SyntaxPlan<ExpressionStatement<TypedPhase>>;
  readonly Block: (node: Block<TypedPhase>) => SyntaxPlan<Block<TypedPhase>>;
  readonly VariableStatement: (node: VariableStatement<TypedPhase>) => SyntaxPlan<VariableStatement<TypedPhase>>;
  readonly VariableDeclaration: (node: VariableDeclaration<TypedPhase>) => SyntaxPlan<VariableDeclaration<TypedPhase>>;
  readonly VariableDeclarationList: (node: VariableDeclarationList<TypedPhase>) => SyntaxPlan<VariableDeclarationList<TypedPhase>>;
  readonly BindingPattern: (node: BindingPattern<TypedPhase>) => SyntaxPlan<BindingPattern<TypedPhase>>;
  readonly ParameterDeclaration: (node: ParameterDeclaration<TypedPhase>) => SyntaxPlan<ParameterDeclaration<TypedPhase>>;
  readonly BindingElement: (node: BindingElement<TypedPhase>) => SyntaxPlan<BindingElement<TypedPhase>>;
  readonly MissingDeclaration: (node: MissingDeclaration<TypedPhase>) => SyntaxPlan<MissingDeclaration<TypedPhase>>;
  readonly FunctionDeclaration: (node: FunctionDeclaration<TypedPhase>) => SyntaxPlan<FunctionDeclaration<TypedPhase>>;
  readonly ClassDeclaration: (node: ClassDeclaration<TypedPhase>) => SyntaxPlan<ClassDeclaration<TypedPhase>>;
  readonly ClassExpression: (node: ClassExpression<TypedPhase>) => SyntaxPlan<ClassExpression<TypedPhase>>;
  readonly HeritageClause: (node: HeritageClause<TypedPhase>) => SyntaxPlan<HeritageClause<TypedPhase>>;
  readonly InterfaceDeclaration: (node: InterfaceDeclaration<TypedPhase>) => SyntaxPlan<InterfaceDeclaration<TypedPhase>>;
  readonly TypeAliasDeclaration: (node: TypeAliasDeclaration<TypedPhase>) => SyntaxPlan<TypeAliasDeclaration<TypedPhase>>;
  readonly EnumMember: (node: EnumMember<TypedPhase>) => SyntaxPlan<EnumMember<TypedPhase>>;
  readonly EnumDeclaration: (node: EnumDeclaration<TypedPhase>) => SyntaxPlan<EnumDeclaration<TypedPhase>>;
  readonly ModuleBlock: (node: ModuleBlock<TypedPhase>) => SyntaxPlan<ModuleBlock<TypedPhase>>;
  readonly NotEmittedStatement: (node: NotEmittedStatement<TypedPhase>) => SyntaxPlan<NotEmittedStatement<TypedPhase>>;
  readonly NotEmittedTypeElement: (node: NotEmittedTypeElement<TypedPhase>) => SyntaxPlan<NotEmittedTypeElement<TypedPhase>>;
  readonly ImportDeclaration: (node: ImportDeclaration<TypedPhase>) => SyntaxPlan<ImportDeclaration<TypedPhase>>;
  readonly ExternalModuleReference: (node: ExternalModuleReference<TypedPhase>) => SyntaxPlan<ExternalModuleReference<TypedPhase>>;
  readonly NamespaceImport: (node: NamespaceImport<TypedPhase>) => SyntaxPlan<NamespaceImport<TypedPhase>>;
  readonly NamedImports: (node: NamedImports<TypedPhase>) => SyntaxPlan<NamedImports<TypedPhase>>;
  readonly ExportAssignment: (node: ExportAssignment<TypedPhase>) => SyntaxPlan<ExportAssignment<TypedPhase>>;
  readonly NamespaceExportDeclaration: (node: NamespaceExportDeclaration<TypedPhase>) => SyntaxPlan<NamespaceExportDeclaration<TypedPhase>>;
  readonly NamespaceExport: (node: NamespaceExport<TypedPhase>) => SyntaxPlan<NamespaceExport<TypedPhase>>;
  readonly NamedExports: (node: NamedExports<TypedPhase>) => SyntaxPlan<NamedExports<TypedPhase>>;
  readonly ExportSpecifier: (node: ExportSpecifier<TypedPhase>) => SyntaxPlan<ExportSpecifier<TypedPhase>>;
  readonly CallSignatureDeclaration: (node: CallSignatureDeclaration<TypedPhase>) => SyntaxPlan<CallSignatureDeclaration<TypedPhase>>;
  readonly ConstructSignatureDeclaration: (node: ConstructSignatureDeclaration<TypedPhase>) => SyntaxPlan<ConstructSignatureDeclaration<TypedPhase>>;
  readonly ConstructorDeclaration: (node: ConstructorDeclaration<TypedPhase>) => SyntaxPlan<ConstructorDeclaration<TypedPhase>>;
  readonly GetAccessorDeclaration: (node: GetAccessorDeclaration<TypedPhase>) => SyntaxPlan<GetAccessorDeclaration<TypedPhase>>;
  readonly SetAccessorDeclaration: (node: SetAccessorDeclaration<TypedPhase>) => SyntaxPlan<SetAccessorDeclaration<TypedPhase>>;
  readonly IndexSignatureDeclaration: (node: IndexSignatureDeclaration<TypedPhase>) => SyntaxPlan<IndexSignatureDeclaration<TypedPhase>>;
  readonly MethodSignatureDeclaration: (node: MethodSignatureDeclaration<TypedPhase>) => SyntaxPlan<MethodSignatureDeclaration<TypedPhase>>;
  readonly MethodDeclaration: (node: MethodDeclaration<TypedPhase>) => SyntaxPlan<MethodDeclaration<TypedPhase>>;
  readonly PropertySignatureDeclaration: (node: PropertySignatureDeclaration<TypedPhase>) => SyntaxPlan<PropertySignatureDeclaration<TypedPhase>>;
  readonly PropertyDeclaration: (node: PropertyDeclaration<TypedPhase>) => SyntaxPlan<PropertyDeclaration<TypedPhase>>;
  readonly SemicolonClassElement: (node: SemicolonClassElement<TypedPhase>) => SyntaxPlan<SemicolonClassElement<TypedPhase>>;
  readonly ClassStaticBlockDeclaration: (node: ClassStaticBlockDeclaration<TypedPhase>) => SyntaxPlan<ClassStaticBlockDeclaration<TypedPhase>>;
  readonly OmittedExpression: (node: OmittedExpression<TypedPhase>) => SyntaxPlan<OmittedExpression<TypedPhase>>;
  readonly KeywordExpression: (node: KeywordExpression<TypedPhase>) => SyntaxPlan<KeywordExpression<TypedPhase>>;
  readonly StringLiteral: (node: StringLiteral<TypedPhase>) => SyntaxPlan<StringLiteral<TypedPhase>>;
  readonly NumericLiteral: (node: NumericLiteral<TypedPhase>) => SyntaxPlan<NumericLiteral<TypedPhase>>;
  readonly BigIntLiteral: (node: BigIntLiteral<TypedPhase>) => SyntaxPlan<BigIntLiteral<TypedPhase>>;
  readonly RegularExpressionLiteral: (node: RegularExpressionLiteral<TypedPhase>) => SyntaxPlan<RegularExpressionLiteral<TypedPhase>>;
  readonly NoSubstitutionTemplateLiteral: (node: NoSubstitutionTemplateLiteral<TypedPhase>) => SyntaxPlan<NoSubstitutionTemplateLiteral<TypedPhase>>;
  readonly BinaryExpression: (node: BinaryExpression<TypedPhase>) => SyntaxPlan<BinaryExpression<TypedPhase>>;
  readonly PrefixUnaryExpression: (node: PrefixUnaryExpression<TypedPhase>) => SyntaxPlan<PrefixUnaryExpression<TypedPhase>>;
  readonly PostfixUnaryExpression: (node: PostfixUnaryExpression<TypedPhase>) => SyntaxPlan<PostfixUnaryExpression<TypedPhase>>;
  readonly YieldExpression: (node: YieldExpression<TypedPhase>) => SyntaxPlan<YieldExpression<TypedPhase>>;
  readonly ArrowFunction: (node: ArrowFunction<TypedPhase>) => SyntaxPlan<ArrowFunction<TypedPhase>>;
  readonly FunctionExpression: (node: FunctionExpression<TypedPhase>) => SyntaxPlan<FunctionExpression<TypedPhase>>;
  readonly AsExpression: (node: AsExpression<TypedPhase>) => SyntaxPlan<AsExpression<TypedPhase>>;
  readonly SatisfiesExpression: (node: SatisfiesExpression<TypedPhase>) => SyntaxPlan<SatisfiesExpression<TypedPhase>>;
  readonly ConditionalExpression: (node: ConditionalExpression<TypedPhase>) => SyntaxPlan<ConditionalExpression<TypedPhase>>;
  readonly PropertyAccessExpression: (node: PropertyAccessExpression<TypedPhase>) => SyntaxPlan<PropertyAccessExpression<TypedPhase>>;
  readonly ElementAccessExpression: (node: ElementAccessExpression<TypedPhase>) => SyntaxPlan<ElementAccessExpression<TypedPhase>>;
  readonly CallExpression: (node: CallExpression<TypedPhase>) => SyntaxPlan<CallExpression<TypedPhase>>;
  readonly NewExpression: (node: NewExpression<TypedPhase>) => SyntaxPlan<NewExpression<TypedPhase>>;
  readonly MetaProperty: (node: MetaProperty<TypedPhase>) => SyntaxPlan<MetaProperty<TypedPhase>>;
  readonly NonNullExpression: (node: NonNullExpression<TypedPhase>) => SyntaxPlan<NonNullExpression<TypedPhase>>;
  readonly SpreadElement: (node: SpreadElement<TypedPhase>) => SyntaxPlan<SpreadElement<TypedPhase>>;
  readonly TemplateExpression: (node: TemplateExpression<TypedPhase>) => SyntaxPlan<TemplateExpression<TypedPhase>>;
  readonly TemplateSpan: (node: TemplateSpan<TypedPhase>) => SyntaxPlan<TemplateSpan<TypedPhase>>;
  readonly TaggedTemplateExpression: (node: TaggedTemplateExpression<TypedPhase>) => SyntaxPlan<TaggedTemplateExpression<TypedPhase>>;
  readonly ParenthesizedExpression: (node: ParenthesizedExpression<TypedPhase>) => SyntaxPlan<ParenthesizedExpression<TypedPhase>>;
  readonly ArrayLiteralExpression: (node: ArrayLiteralExpression<TypedPhase>) => SyntaxPlan<ArrayLiteralExpression<TypedPhase>>;
  readonly ObjectLiteralExpression: (node: ObjectLiteralExpression<TypedPhase>) => SyntaxPlan<ObjectLiteralExpression<TypedPhase>>;
  readonly SpreadAssignment: (node: SpreadAssignment<TypedPhase>) => SyntaxPlan<SpreadAssignment<TypedPhase>>;
  readonly PropertyAssignment: (node: PropertyAssignment<TypedPhase>) => SyntaxPlan<PropertyAssignment<TypedPhase>>;
  readonly ShorthandPropertyAssignment: (node: ShorthandPropertyAssignment<TypedPhase>) => SyntaxPlan<ShorthandPropertyAssignment<TypedPhase>>;
  readonly DeleteExpression: (node: DeleteExpression<TypedPhase>) => SyntaxPlan<DeleteExpression<TypedPhase>>;
  readonly TypeOfExpression: (node: TypeOfExpression<TypedPhase>) => SyntaxPlan<TypeOfExpression<TypedPhase>>;
  readonly VoidExpression: (node: VoidExpression<TypedPhase>) => SyntaxPlan<VoidExpression<TypedPhase>>;
  readonly AwaitExpression: (node: AwaitExpression<TypedPhase>) => SyntaxPlan<AwaitExpression<TypedPhase>>;
  readonly TypeAssertion: (node: TypeAssertion<TypedPhase>) => SyntaxPlan<TypeAssertion<TypedPhase>>;
  readonly KeywordTypeNode: (node: KeywordTypeNode<TypedPhase>) => SyntaxPlan<KeywordTypeNode<TypedPhase>>;
  readonly UnionTypeNode: (node: UnionTypeNode<TypedPhase>) => SyntaxPlan<UnionTypeNode<TypedPhase>>;
  readonly IntersectionTypeNode: (node: IntersectionTypeNode<TypedPhase>) => SyntaxPlan<IntersectionTypeNode<TypedPhase>>;
  readonly ConditionalTypeNode: (node: ConditionalTypeNode<TypedPhase>) => SyntaxPlan<ConditionalTypeNode<TypedPhase>>;
  readonly TypeOperatorNode: (node: TypeOperatorNode<TypedPhase>) => SyntaxPlan<TypeOperatorNode<TypedPhase>>;
  readonly InferTypeNode: (node: InferTypeNode<TypedPhase>) => SyntaxPlan<InferTypeNode<TypedPhase>>;
  readonly ArrayTypeNode: (node: ArrayTypeNode<TypedPhase>) => SyntaxPlan<ArrayTypeNode<TypedPhase>>;
  readonly IndexedAccessTypeNode: (node: IndexedAccessTypeNode<TypedPhase>) => SyntaxPlan<IndexedAccessTypeNode<TypedPhase>>;
  readonly TypeReferenceNode: (node: TypeReferenceNode<TypedPhase>) => SyntaxPlan<TypeReferenceNode<TypedPhase>>;
  readonly ExpressionWithTypeArguments: (node: ExpressionWithTypeArguments<TypedPhase>) => SyntaxPlan<ExpressionWithTypeArguments<TypedPhase>>;
  readonly LiteralTypeNode: (node: LiteralTypeNode<TypedPhase>) => SyntaxPlan<LiteralTypeNode<TypedPhase>>;
  readonly ThisTypeNode: (node: ThisTypeNode<TypedPhase>) => SyntaxPlan<ThisTypeNode<TypedPhase>>;
  readonly TypePredicateNode: (node: TypePredicateNode<TypedPhase>) => SyntaxPlan<TypePredicateNode<TypedPhase>>;
  readonly ImportAttribute: (node: ImportAttribute<TypedPhase>) => SyntaxPlan<ImportAttribute<TypedPhase>>;
  readonly ImportAttributes: (node: ImportAttributes<TypedPhase>) => SyntaxPlan<ImportAttributes<TypedPhase>>;
  readonly TypeQueryNode: (node: TypeQueryNode<TypedPhase>) => SyntaxPlan<TypeQueryNode<TypedPhase>>;
  readonly MappedTypeNode: (node: MappedTypeNode<TypedPhase>) => SyntaxPlan<MappedTypeNode<TypedPhase>>;
  readonly TypeLiteralNode: (node: TypeLiteralNode<TypedPhase>) => SyntaxPlan<TypeLiteralNode<TypedPhase>>;
  readonly TupleTypeNode: (node: TupleTypeNode<TypedPhase>) => SyntaxPlan<TupleTypeNode<TypedPhase>>;
  readonly NamedTupleMember: (node: NamedTupleMember<TypedPhase>) => SyntaxPlan<NamedTupleMember<TypedPhase>>;
  readonly OptionalTypeNode: (node: OptionalTypeNode<TypedPhase>) => SyntaxPlan<OptionalTypeNode<TypedPhase>>;
  readonly RestTypeNode: (node: RestTypeNode<TypedPhase>) => SyntaxPlan<RestTypeNode<TypedPhase>>;
  readonly ParenthesizedTypeNode: (node: ParenthesizedTypeNode<TypedPhase>) => SyntaxPlan<ParenthesizedTypeNode<TypedPhase>>;
  readonly FunctionTypeNode: (node: FunctionTypeNode<TypedPhase>) => SyntaxPlan<FunctionTypeNode<TypedPhase>>;
  readonly ConstructorTypeNode: (node: ConstructorTypeNode<TypedPhase>) => SyntaxPlan<ConstructorTypeNode<TypedPhase>>;
  readonly TemplateHead: (node: TemplateHead<TypedPhase>) => SyntaxPlan<TemplateHead<TypedPhase>>;
  readonly TemplateMiddle: (node: TemplateMiddle<TypedPhase>) => SyntaxPlan<TemplateMiddle<TypedPhase>>;
  readonly TemplateTail: (node: TemplateTail<TypedPhase>) => SyntaxPlan<TemplateTail<TypedPhase>>;
  readonly TemplateLiteralTypeNode: (node: TemplateLiteralTypeNode<TypedPhase>) => SyntaxPlan<TemplateLiteralTypeNode<TypedPhase>>;
  readonly TemplateLiteralTypeSpan: (node: TemplateLiteralTypeSpan<TypedPhase>) => SyntaxPlan<TemplateLiteralTypeSpan<TypedPhase>>;
  readonly PartiallyEmittedExpression: (node: PartiallyEmittedExpression<TypedPhase>) => SyntaxPlan<PartiallyEmittedExpression<TypedPhase>>;
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
  readonly TypeParameterDeclaration: (node: TypeParameterDeclaration<TypedPhase>) => SyntaxPlan<TypeParameterDeclaration<TypedPhase>>;
  readonly SyntheticReferenceExpression: (node: SyntheticReferenceExpression<TypedPhase>) => SyntaxPlan<SyntheticReferenceExpression<TypedPhase>>;
  readonly JSDocTypeLiteral: (node: JSDocTypeLiteral<TypedPhase>) => SyntaxPlan<JSDocTypeLiteral<TypedPhase>>;
  readonly JSDocParameterOrPropertyTag: (node: JSDocParameterOrPropertyTag<TypedPhase>) => SyntaxPlan<JSDocParameterOrPropertyTag<TypedPhase>>;
  readonly EntityName: (node: EntityName<TypedPhase>) => SyntaxPlan<EntityName<TypedPhase>>;
  readonly Expression: (node: Expression<TypedPhase>) => SyntaxPlan<Expression<TypedPhase>>;
  readonly LeftHandSideExpression: (node: LeftHandSideExpression<TypedPhase>) => SyntaxPlan<LeftHandSideExpression<TypedPhase>>;
  readonly Statement: (node: Statement<TypedPhase>) => SyntaxPlan<Statement<TypedPhase>>;
  readonly ForInitializer: (node: ForInitializer<TypedPhase>) => SyntaxPlan<ForInitializer<TypedPhase>>;
  readonly CaseOrDefaultClause: (node: CaseOrDefaultClause<TypedPhase>) => SyntaxPlan<CaseOrDefaultClause<TypedPhase>>;
  readonly BindingName: (node: BindingName<TypedPhase>) => SyntaxPlan<BindingName<TypedPhase>>;
  readonly TypeNode: (node: TypeNode<TypedPhase>) => SyntaxPlan<TypeNode<TypedPhase>>;
  readonly PropertyName: (node: PropertyName<TypedPhase>) => SyntaxPlan<PropertyName<TypedPhase>>;
  readonly BlockOrExpression: (node: BlockOrExpression<TypedPhase>) => SyntaxPlan<BlockOrExpression<TypedPhase>>;
  readonly ClassElement: (node: ClassElement<TypedPhase>) => SyntaxPlan<ClassElement<TypedPhase>>;
  readonly TypeElement: (node: TypeElement<TypedPhase>) => SyntaxPlan<TypeElement<TypedPhase>>;
  readonly ModuleExportName: (node: ModuleExportName<TypedPhase>) => SyntaxPlan<ModuleExportName<TypedPhase>>;
  readonly MemberName: (node: MemberName<TypedPhase>) => SyntaxPlan<MemberName<TypedPhase>>;
  readonly TemplateMiddleOrTail: (node: TemplateMiddleOrTail<TypedPhase>) => SyntaxPlan<TemplateMiddleOrTail<TypedPhase>>;
  readonly TemplateLiteral: (node: TemplateLiteral<TypedPhase>) => SyntaxPlan<TemplateLiteral<TypedPhase>>;
  readonly ObjectLiteralElementLike: (node: ObjectLiteralElementLike<TypedPhase>) => SyntaxPlan<ObjectLiteralElementLike<TypedPhase>>;
  readonly LiteralTypeChild: (node: LiteralTypeChild<TypedPhase>) => SyntaxPlan<LiteralTypeChild<TypedPhase>>;
  readonly TypePredicateParameterName: (node: TypePredicateParameterName<TypedPhase>) => SyntaxPlan<TypePredicateParameterName<TypedPhase>>;
  readonly ImportAttributeName: (node: ImportAttributeName<TypedPhase>) => SyntaxPlan<ImportAttributeName<TypedPhase>>;
  readonly JsxChild: (node: JsxChild<TypedPhase>) => SyntaxPlan<JsxChild<TypedPhase>>;
  readonly JsxAttributeLike: (node: JsxAttributeLike<TypedPhase>) => SyntaxPlan<JsxAttributeLike<TypedPhase>>;
  readonly JsxTagNameExpression: (node: JsxTagNameExpression<TypedPhase>) => SyntaxPlan<JsxTagNameExpression<TypedPhase>>;
  readonly JsxAttributeName: (node: JsxAttributeName<TypedPhase>) => SyntaxPlan<JsxAttributeName<TypedPhase>>;
  readonly JsxAttributeValue: (node: JsxAttributeValue<TypedPhase>) => SyntaxPlan<JsxAttributeValue<TypedPhase>>;
  readonly JSDocComment: (node: JSDocComment<TypedPhase>) => SyntaxPlan<JSDocComment<TypedPhase>>;
  readonly JSDocTag: (node: JSDocTag<TypedPhase>) => SyntaxPlan<JSDocTag<TypedPhase>>;
  readonly JSDocFullName: (node: JSDocFullName<TypedPhase>) => SyntaxPlan<JSDocFullName<TypedPhase>>;
  readonly NodeBody: (node: NodeBody<TypedPhase>) => SyntaxPlan<NodeBody<TypedPhase>>;
  readonly ModuleName: (node: ModuleName<TypedPhase>) => SyntaxPlan<ModuleName<TypedPhase>>;
  readonly ModuleReference: (node: ModuleReference<TypedPhase>) => SyntaxPlan<ModuleReference<TypedPhase>>;
  readonly NamedExportBindings: (node: NamedExportBindings<TypedPhase>) => SyntaxPlan<NamedExportBindings<TypedPhase>>;
  readonly NamedImportBindings: (node: NamedImportBindings<TypedPhase>) => SyntaxPlan<NamedImportBindings<TypedPhase>>;
  readonly ModifierLike: (node: ModifierLike<TypedPhase>) => SyntaxPlan<ModifierLike<TypedPhase>>;
  readonly BodyRoot: (node: BodyRoot<TypedPhase>) => SyntaxPlan<BodyRoot<TypedPhase>>;
  readonly SyntaxNode: (node: SyntaxNode<TypedPhase>) => SyntaxPlan<SyntaxNode<TypedPhase>>;
  readonly LiteralKeywordExpression: (node: KeywordExpression<TypedPhase, "TrueKeyword" | "FalseKeyword" | "NullKeyword">) => SyntaxPlan<KeywordExpression<TypedPhase, "TrueKeyword" | "FalseKeyword" | "NullKeyword">>;
}

export function syntaxHeader(node: NodeHeader): NodeHeader {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

export function copyNodeList<Value>(list: NodeList<Value>, copy: (value: Value) => Value): NodeList<Value> {
  return { loc: list.loc, nodes: list.nodes.map(copy) };
}

export function memoSyntaxPlan<Source extends SyntaxNode<TypedPhase>, Value extends SyntaxNode<TypedPhase>>(
  plans: Map<Source, SyntaxPlan<Value>>,
  source: Source,
  build: () => Value,
): SyntaxPlan<Value> {
  const previous = plans.get(source);
  if (previous !== undefined) return previous;
  let state: { readonly kind: "pending" } | { readonly kind: "complete"; readonly value: Value } = { kind: "pending" };
  const plan: SyntaxPlan<Value> = () => {
    if (state.kind === "complete") return state.value;
    const value = build();
    state = { kind: "complete", value };
    return value;
  };
  plans.set(source, plan);
  return plan;
}

export function planSyntaxNode(ports: SyntaxCopyPorts, node: SyntaxNode<TypedPhase>): SyntaxPlan<SyntaxNode<TypedPhase>> {
  switch (node.kind) {
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
      return () => node;
  }
}
