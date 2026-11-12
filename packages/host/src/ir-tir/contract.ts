import type { BodyId, DefId, LocalId, LocalRef, ModuleId, NodeId, NodeRef, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { Diagnostic, TextParseResult, Violation } from "../diag/contract.js";
import type { ArtifactBindings, BindingScope, BindingVector, BodyInstance, ExactRational, MemberKey, MemberTable, NominalDefinition, PassingMode, TypeComponent, TypeEvidence, TypeParameter, TypeTable } from "../ir-types/contract.js";
import type { BodyRoot, DeclarationTarget, HirAttribute, HirCallableEndpoint, HirLexicalScope, HirModule, HirNode, ImportTarget, Phase, SourceFile, SyntaxNode } from "../ir-hir/contract.js";
import type { ApplicationDecision, ConstructionPartDecision, DeferredDecision, EmbeddingDecision, FlowRole, InferenceDeclaration, MemberDecision, OperationDecision, RefinementDecision, RuleOutcome } from "../ir-infer/contract.js";

export interface TypedOperation {
  readonly decision: OperationDecision;
  readonly permissionScope: NodeId | null;
}

export type TirResolution =
  | { readonly kind: "local"; readonly local: LocalRef }
  | { readonly kind: "definition"; readonly definition: DefId; readonly aliases: readonly DefId[] }
  | { readonly kind: "module"; readonly target: ImportTarget }
  | { readonly kind: "error"; readonly diagnostic: number };

export interface ResolvedCallee {
  readonly decision: ApplicationDecision;
  readonly activation: BodyInstance | null;
  readonly captures: readonly LocalRef[];
}

export interface MemberSelection {
  readonly decision: MemberDecision;
  readonly getter: ResolvedCallee | null;
  readonly setter: ResolvedCallee | null;
}

export type TirArgument =
  | { readonly kind: "provided"; readonly parameter: number; readonly expression: NodeId }
  | { readonly kind: "omitted"; readonly parameter: number;
      readonly value: { readonly kind: "absence" } | { readonly kind: "initializer"; readonly instance: BodyInstance }
        | { readonly kind: "empty-rest" } }
  | { readonly kind: "rest"; readonly parameter: number; readonly parts: readonly TirRestPart[] };

export type TirRestPart =
  | { readonly kind: "value"; readonly expression: NodeId }
  | { readonly kind: "spread"; readonly expression: NodeId; readonly tuple: readonly TyId[] | null };

export interface TirApplication {
  readonly callee: ResolvedCallee;
  readonly receiver: NodeId | null;
  readonly arguments: readonly TirArgument[];
}

export interface TirProtocolStep {
  readonly role: "acquire" | "next" | "done" | "value" | "finish" | "fail" | "await" | "dispose" | "completion";
  readonly operation: TypedOperation;
  readonly callee: ResolvedCallee | null;
}

export interface TirProtocol {
  readonly kind: "iterate" | "spread" | "await" | "yield" | "delegate" | "dispose";
  readonly asynchronous: boolean;
  readonly steps: readonly TirProtocolStep[];
  readonly value: TyId;
  readonly completion: TyId;
  readonly sent: TyId | null;
  readonly thrown: TyId;
}

export type TirSelection =
  | { readonly kind: "conditional"; readonly control: NodeId; readonly whenTrue: NodeId; readonly whenFalse: NodeId;
      readonly disposition: "true" | "false" | "dynamic" }
  | { readonly kind: "and" | "or" | "coalesce"; readonly control: NodeId; readonly right: NodeId;
      readonly disposition: "left" | "right" | "dynamic" };

export type TirDemand =
  | { readonly kind: "always" }
  | { readonly kind: "selected"; readonly control: NodeId; readonly when: "true" | "false" | "present" | "absent" }
  | { readonly kind: "never"; readonly control: NodeId };

export type ConversionDecision =
  | { readonly kind: "identity" }
  | { readonly kind: "convert"; readonly role: FlowRole; readonly embedding: EmbeddingDecision; readonly operation: TypedOperation }
  | { readonly kind: "deferred"; readonly deferred: DeferredDecision };

export interface TypedValue {
  readonly type: TyId;
  readonly convertedType: TyId;
  readonly conversion: ConversionDecision;
  readonly narrowing: RefinementDecision | null;
  readonly evidenceIndex: number | null;
  readonly demand: TirDemand;
}

export type TypedName =
  | (TypedValue & { readonly role: "value"; readonly resolution: TirResolution })
  | (TypedValue & { readonly role: "shorthand-value"; readonly key: MemberKey; readonly resolution: TirResolution })
  | { readonly role: "assignment-target"; readonly resolution: TirResolution; readonly access: TargetAccess }
  | { readonly role: "declaration-name"; readonly declaration: DeclarationTarget; readonly storage: TyId | null }
  | { readonly role: "property-name"; readonly key: MemberKey }
  | { readonly role: "type-name"; readonly type: TyId; readonly declarations: readonly DefId[] }
  | { readonly role: "label"; readonly target: NodeRef }
  | { readonly role: "private-name"; readonly declaration: DefId };

export type TypedPropertyKey =
  | { readonly kind: "constant"; readonly key: MemberKey }
  | { readonly kind: "computed"; readonly type: TyId };

export type TypedString =
  | (TypedValue & { readonly role: "value"; readonly value: string })
  | { readonly role: "property-name"; readonly key: MemberKey }
  | { readonly role: "declaration-name"; readonly declaration: DeclarationTarget }
  | { readonly role: "type-literal"; readonly type: TyId }
  | { readonly role: "module-specifier"; readonly target: ImportTarget }
  | { readonly role: "export-name"; readonly definition: DefId }
  | { readonly role: "attribute-value"; readonly value: string };

export type TypedNumber =
  | (TypedValue & { readonly role: "value"; readonly value: ExactRational })
  | { readonly role: "property-name"; readonly key: MemberKey }
  | { readonly role: "declaration-name"; readonly declaration: DeclarationTarget }
  | { readonly role: "type-literal"; readonly type: TyId };

export type TypedBigInt =
  | (TypedValue & { readonly role: "value"; readonly value: bigint })
  | { readonly role: "property-name"; readonly key: MemberKey }
  | { readonly role: "declaration-name"; readonly declaration: DeclarationTarget }
  | { readonly role: "type-literal"; readonly type: TyId };

export type TypedKeyword =
  | (TypedValue & { readonly role: "value" })
  | (TypedValue & { readonly role: "receiver"; readonly owner: DefId })
  | (TypedValue & { readonly role: "super"; readonly owner: DefId; readonly base: TyId })
  | { readonly role: "type-literal"; readonly type: TyId };

export type TypedBinary =
  | (TypedValue & { readonly role: "arithmetic"; readonly operation: RuleOutcome<TypedOperation> })
  | (TypedValue & { readonly role: "comparison"; readonly operation: RuleOutcome<TypedOperation> })
  | (TypedValue & { readonly role: "short-circuit"; readonly selection: TirSelection })
  | (TypedValue & { readonly role: "assignment"; readonly storage: TyId;
      readonly calculation: RuleOutcome<TypedOperation> | null; readonly selection: TirSelection | null })
  | (TypedValue & { readonly role: "sequence" });

export interface TypedUnary extends TypedValue {
  readonly operation: RuleOutcome<TypedOperation>;
}

export type TypedPrefix =
  | (TypedValue & { readonly role: "value"; readonly operation: RuleOutcome<TypedOperation> })
  | (TypedValue & { readonly role: "update"; readonly storage: TyId; readonly operation: RuleOutcome<TypedOperation> })
  | { readonly role: "type-literal"; readonly type: TyId };

export interface TypedUpdate extends TypedValue {
  readonly storage: TyId;
  readonly operation: RuleOutcome<TypedOperation>;
}

export interface TypedConditional extends TypedValue {
  readonly selection: TirSelection;
}

export type TargetAccess =
  | { readonly kind: "write"; readonly storage: TyId }
  | { readonly kind: "read-write"; readonly storage: TyId; readonly read: TyId;
      readonly narrowing: RefinementDecision | null; readonly evidenceIndex: number | null };

export type TypedMember =
  | (TypedValue & { readonly role: "value"; readonly selection: RuleOutcome<MemberSelection> })
  | { readonly role: "assignment-target"; readonly selection: RuleOutcome<MemberSelection>; readonly access: TargetAccess };

export interface TypedApplication extends TypedValue {
  readonly application: RuleOutcome<TirApplication>;
  readonly operation: RuleOutcome<TypedOperation> | null;
}

export interface TypedProtocolValue extends TypedValue {
  readonly protocol: RuleOutcome<TirProtocol>;
}

export interface TypedSpread extends TypedValue {
  readonly protocol: RuleOutcome<TirProtocol>;
}

export interface TypedObjectSpread {
  readonly construction: RuleOutcome<TypedOperation>;
}

export type TypedConstruction =
  | (TypedValue & { readonly role: "value"; readonly construction: RuleOutcome<TypedOperation> })
  | { readonly role: "assignment-pattern"; readonly storage: TyId; readonly parts: readonly ConstructionPartDecision[] };

export interface TypedTemplate extends TypedValue {
  readonly operation: RuleOutcome<TypedOperation>;
}

export type TypedInstantiation =
  | (TypedValue & { readonly role: "value"; readonly bindings: BindingVector; readonly application: RuleOutcome<ApplicationDecision> | null })
  | { readonly role: "heritage"; readonly type: TyId; readonly bindings: BindingVector; readonly declarations: readonly DefId[] };

export interface TypedProperty {
  readonly key: MemberKey;
  readonly member: RuleOutcome<MemberSelection>;
}

export interface TypedShorthand {
  readonly key: MemberKey;
  readonly member: RuleOutcome<MemberSelection>;
}

export interface TypedOmission {
  readonly storage: TyId;
}

export interface TypedIteration {
  readonly protocol: RuleOutcome<TirProtocol>;
}

export interface TypedControlTransfer {
  readonly target: NodeRef;
}

export interface TypedDecorator {
  readonly application: RuleOutcome<TirApplication>;
}

export interface TypedBinding {
  readonly declaration: DeclarationTarget;
  readonly storage: TyId;
  readonly initializer: BodyId | null;
}

export type TypedBindingElement =
  | (TypedBinding & { readonly role: "binding" })
  | { readonly role: "hole" };

export interface TypedBindingPattern {
  readonly storage: TyId;
}

export interface TypedParameter {
  readonly declaration: DefId;
  readonly local: LocalRef;
  readonly storage: TyId;
  readonly passing: PassingMode;
  readonly initializer: BodyId | null;
}

export type TypedVariableList =
  | { readonly role: "ordinary" }
  | { readonly role: "using"; readonly asynchronous: boolean; readonly protocols: readonly RuleOutcome<TirProtocol>[] };

export interface TypedBodyTemplate {
  readonly body: BodyId;
  readonly lexicalBindings: BindingVector;
  readonly dependence: "parametric" | "binding-dependent";
}

export interface TypedCallable {
  readonly definition: DefId;
  readonly parameters: readonly TypeParameter[];
  readonly signatures: readonly HirCallableEndpoint[];
  readonly template: TypedBodyTemplate | null;
  readonly attributes: readonly HirAttribute[];
}

export interface TypedClosure extends TypedValue {
  readonly callable: TypedCallable;
  readonly captures: readonly LocalRef[];
}

export interface TypedClass {
  readonly definition: DefId;
  readonly parameters: readonly TypeParameter[];
  readonly type: TyId;
  readonly heritage: readonly TyId[];
  readonly members: readonly DefId[];
  readonly attributes: readonly HirAttribute[];
}

export interface TypedClassValue extends TypedValue {
  readonly declaration: TypedClass;
}

export interface TypedHeritage {
  readonly types: readonly TyId[];
}

export interface TypedInterface {
  readonly definition: DefId;
  readonly parameters: readonly TypeParameter[];
  readonly type: TyId;
  readonly members: readonly DefId[];
}

export interface TypedAlias {
  readonly definition: DefId;
  readonly parameters: readonly TypeParameter[];
  readonly type: TyId;
}

export interface TypedEnum {
  readonly definition: DefId;
  readonly type: TyId;
  readonly members: readonly DefId[];
}

export interface TypedStorageDeclaration {
  readonly definition: DefId;
  readonly storage: TyId;
  readonly initializer: BodyId | null;
  readonly attributes: readonly HirAttribute[];
}

export interface TypedStaticBlock {
  readonly template: TypedBodyTemplate;
}

export interface TypedIndexDeclaration {
  readonly definition: DefId;
  readonly key: TyId;
  readonly read: TyId;
  readonly write: TyId | null;
}

export interface TypedType {
  readonly type: TyId;
  readonly declarations: readonly DefId[];
}

export interface TypedPredicate {
  readonly parameter: DefId;
  readonly narrowed: TyId | null;
  readonly asserts: boolean;
}

export interface TypedTypeParameter {
  readonly parameter: TypeParameter;
}

export interface TypedImport {
  readonly definition: DefId;
  readonly target: ImportTarget;
}

export interface TypedImportBinding {
  readonly definition: DefId;
  readonly imported: ModuleBindingTarget;
}

export type ModuleBindingTarget =
  | { readonly kind: "definition"; readonly definition: DefId }
  | { readonly kind: "module"; readonly target: ImportTarget };

export interface TypedModuleReference {
  readonly target: ImportTarget;
}

export interface TypedExport {
  readonly definition: DefId;
  readonly target: ImportTarget | null;
}

export interface TypedExportBinding {
  readonly definition: DefId;
  readonly exported: ModuleBindingTarget;
}

export interface TypedExportAssignment {
  readonly definition: DefId;
  readonly type: TyId;
}

export interface TypedNamespace {
  readonly definition: DefId;
  readonly type: TyId;
  readonly template: TypedBodyTemplate | null;
}

export interface TypedSourceFile {
  readonly module: ModuleId;
  readonly template: TypedBodyTemplate | null;
}

export interface TypedPhase extends Phase {
  readonly Token: null;
  readonly Identifier: TypedName;
  readonly PrivateIdentifier: TypedName;
  readonly QualifiedName: TypedName;
  readonly ComputedPropertyName: TypedPropertyKey;
  readonly Decorator: TypedDecorator;
  readonly EmptyStatement: null;
  readonly IfStatement: null;
  readonly DoStatement: null;
  readonly WhileStatement: null;
  readonly ForStatement: null;
  readonly ForInOrOfStatement: TypedIteration;
  readonly BreakStatement: TypedControlTransfer;
  readonly ContinueStatement: TypedControlTransfer;
  readonly ReturnStatement: null;
  readonly WithStatement: null;
  readonly SwitchStatement: null;
  readonly CaseBlock: null;
  readonly CaseOrDefaultClause: null;
  readonly ThrowStatement: null;
  readonly TryStatement: null;
  readonly CatchClause: null;
  readonly DebuggerStatement: null;
  readonly LabeledStatement: TypedControlTransfer;
  readonly ExpressionStatement: null;
  readonly Block: null;
  readonly VariableStatement: null;
  readonly VariableDeclaration: TypedBinding;
  readonly VariableDeclarationList: TypedVariableList;
  readonly BindingPattern: TypedBindingPattern;
  readonly ParameterDeclaration: TypedParameter;
  readonly BindingElement: TypedBindingElement;
  readonly MissingDeclaration: null;
  readonly FunctionDeclaration: TypedCallable;
  readonly ClassDeclaration: TypedClass;
  readonly ClassExpression: TypedClassValue;
  readonly HeritageClause: TypedHeritage;
  readonly InterfaceDeclaration: TypedInterface;
  readonly TypeAliasDeclaration: TypedAlias;
  readonly EnumMember: TypedStorageDeclaration;
  readonly EnumDeclaration: TypedEnum;
  readonly ModuleBlock: null;
  readonly NotEmittedStatement: null;
  readonly NotEmittedTypeElement: null;
  readonly ImportDeclaration: TypedImport;
  readonly ExternalModuleReference: TypedModuleReference;
  readonly NamespaceImport: TypedImportBinding;
  readonly NamedImports: null;
  readonly ExportAssignment: TypedExportAssignment;
  readonly NamespaceExportDeclaration: TypedExportBinding;
  readonly NamespaceExport: TypedExportBinding;
  readonly NamedExports: null;
  readonly ExportSpecifier: TypedExportBinding;
  readonly CallSignatureDeclaration: TypedCallable;
  readonly ConstructSignatureDeclaration: TypedCallable;
  readonly ConstructorDeclaration: TypedCallable;
  readonly GetAccessorDeclaration: TypedCallable;
  readonly SetAccessorDeclaration: TypedCallable;
  readonly IndexSignatureDeclaration: TypedIndexDeclaration;
  readonly MethodSignatureDeclaration: TypedCallable;
  readonly MethodDeclaration: TypedCallable;
  readonly PropertySignatureDeclaration: TypedStorageDeclaration;
  readonly PropertyDeclaration: TypedStorageDeclaration;
  readonly SemicolonClassElement: null;
  readonly ClassStaticBlockDeclaration: TypedStaticBlock;
  readonly OmittedExpression: TypedOmission;
  readonly KeywordExpression: TypedKeyword;
  readonly StringLiteral: TypedString;
  readonly NumericLiteral: TypedNumber;
  readonly BigIntLiteral: TypedBigInt;
  readonly RegularExpressionLiteral: TypedValue;
  readonly NoSubstitutionTemplateLiteral: TypedString;
  readonly BinaryExpression: TypedBinary;
  readonly PrefixUnaryExpression: TypedPrefix;
  readonly PostfixUnaryExpression: TypedUpdate;
  readonly YieldExpression: TypedProtocolValue;
  readonly ArrowFunction: TypedClosure;
  readonly FunctionExpression: TypedClosure;
  readonly AsExpression: TypedValue;
  readonly SatisfiesExpression: TypedValue;
  readonly ConditionalExpression: TypedConditional;
  readonly PropertyAccessExpression: TypedMember;
  readonly ElementAccessExpression: TypedMember;
  readonly CallExpression: TypedApplication;
  readonly NewExpression: TypedApplication;
  readonly MetaProperty: TypedValue;
  readonly NonNullExpression: TypedValue;
  readonly SpreadElement: TypedSpread;
  readonly TemplateExpression: TypedTemplate;
  readonly TemplateSpan: null;
  readonly TaggedTemplateExpression: TypedApplication;
  readonly ParenthesizedExpression: TypedValue;
  readonly ArrayLiteralExpression: TypedConstruction;
  readonly ObjectLiteralExpression: TypedConstruction;
  readonly SpreadAssignment: TypedObjectSpread;
  readonly PropertyAssignment: TypedProperty;
  readonly ShorthandPropertyAssignment: TypedShorthand;
  readonly DeleteExpression: TypedUnary;
  readonly TypeOfExpression: TypedUnary;
  readonly VoidExpression: TypedUnary;
  readonly AwaitExpression: TypedProtocolValue;
  readonly TypeAssertion: TypedValue;
  readonly KeywordTypeNode: TypedType;
  readonly UnionTypeNode: TypedType;
  readonly IntersectionTypeNode: TypedType;
  readonly ConditionalTypeNode: TypedType;
  readonly TypeOperatorNode: TypedType;
  readonly InferTypeNode: TypedType;
  readonly ArrayTypeNode: TypedType;
  readonly IndexedAccessTypeNode: TypedType;
  readonly TypeReferenceNode: TypedType;
  readonly ExpressionWithTypeArguments: TypedInstantiation;
  readonly LiteralTypeNode: TypedType;
  readonly ThisTypeNode: TypedType;
  readonly TypePredicateNode: TypedPredicate;
  readonly ImportAttribute: null;
  readonly ImportAttributes: null;
  readonly TypeQueryNode: TypedType;
  readonly MappedTypeNode: TypedType;
  readonly TypeLiteralNode: TypedType;
  readonly TupleTypeNode: TypedType;
  readonly NamedTupleMember: TypedType;
  readonly OptionalTypeNode: TypedType;
  readonly RestTypeNode: TypedType;
  readonly ParenthesizedTypeNode: TypedType;
  readonly FunctionTypeNode: TypedType;
  readonly ConstructorTypeNode: TypedType;
  readonly TemplateHead: null;
  readonly TemplateMiddle: null;
  readonly TemplateTail: null;
  readonly TemplateLiteralTypeNode: TypedType;
  readonly TemplateLiteralTypeSpan: TypedType;
  readonly PartiallyEmittedExpression: null;
  readonly JsxElement: null;
  readonly JsxAttributes: null;
  readonly JsxNamespacedName: null;
  readonly JsxOpeningElement: null;
  readonly JsxSelfClosingElement: null;
  readonly JsxFragment: null;
  readonly JsxOpeningFragment: null;
  readonly JsxClosingFragment: null;
  readonly JsxAttribute: null;
  readonly JsxSpreadAttribute: null;
  readonly JsxClosingElement: null;
  readonly JsxExpression: null;
  readonly JsxText: null;
  readonly SyntaxList: null;
  readonly JSDoc: null;
  readonly JSDocTypeExpression: null;
  readonly JSDocNonNullableType: null;
  readonly JSDocNullableType: null;
  readonly JSDocAllType: null;
  readonly JSDocVariadicType: null;
  readonly JSDocOptionalType: null;
  readonly JSDocTypeTag: null;
  readonly JSDocUnknownTag: null;
  readonly JSDocTemplateTag: null;
  readonly JSDocReturnTag: null;
  readonly JSDocPublicTag: null;
  readonly JSDocPrivateTag: null;
  readonly JSDocProtectedTag: null;
  readonly JSDocReadonlyTag: null;
  readonly JSDocOverrideTag: null;
  readonly JSDocDeprecatedTag: null;
  readonly JSDocSeeTag: null;
  readonly JSDocImplementsTag: null;
  readonly JSDocAugmentsTag: null;
  readonly JSDocSatisfiesTag: null;
  readonly JSDocThrowsTag: null;
  readonly JSDocThisTag: null;
  readonly JSDocImportTag: null;
  readonly JSDocCallbackTag: null;
  readonly JSDocOverloadTag: null;
  readonly JSDocTypedefTag: null;
  readonly JSDocSignature: null;
  readonly JSDocNameReference: null;
  readonly SourceFile: TypedSourceFile;
  readonly ModuleDeclaration: TypedNamespace;
  readonly ImportEqualsDeclaration: TypedImportBinding;
  readonly ExportDeclaration: TypedExport;
  readonly ImportTypeNode: TypedType;
  readonly ImportClause: TypedImportBinding;
  readonly ImportSpecifier: TypedImportBinding;
  readonly JSDocText: null;
  readonly JSDocLink: null;
  readonly JSDocLinkPlain: null;
  readonly JSDocLinkCode: null;
  readonly TypeParameterDeclaration: TypedTypeParameter;
  readonly SyntheticReferenceExpression: null;
  readonly JSDocTypeLiteral: null;
  readonly JSDocParameterOrPropertyTag: null;
}

export type TirNode = SyntaxNode<TypedPhase>;

export interface TirLocal {
  readonly id: LocalId;
  readonly declaration: SourceNodeRef;
  readonly name: string;
  readonly role: "parameter" | "binding" | "capture" | "catch";
  readonly capturedFrom: LocalRef | null;
  readonly mutable: boolean;
  readonly storage: TyId;
}

export interface TirParam {
  readonly local: LocalId;
  readonly declaration: DefId;
  readonly role: "required" | "optional" | "default" | "rest" | "this";
  readonly passing: PassingMode;
  readonly initializer: BodyId | null;
  readonly storage: TyId;
}

export interface TirBody {
  readonly body: BodyId;
  readonly owner: DefId;
  readonly bindings: ArtifactBindings;
  readonly lexicalBindings: BindingVector;
  readonly dependence: "parametric" | "binding-dependent";
  readonly signature: SigId;
  readonly completion: TyId;
  readonly yielded: TyId | null;
  readonly sent: TyId | null;
  readonly params: readonly TirParam[];
  readonly locals: readonly TirLocal[];
  readonly root: BodyRoot<TypedPhase>;
  readonly nestedBodies: readonly BodyId[];
  readonly captures: readonly LocalRef[];
  readonly scopes: readonly HirLexicalScope[];
  readonly evidence: readonly TypeEvidence[];
  readonly asynchronous: boolean;
  readonly generator: boolean;
}

export interface TirModule {
  readonly module: ModuleId;
  readonly tree: SourceFile<TypedPhase>;
  readonly bodies: readonly TirBody[];
}

export type TirMemberOccurrence =
  | { readonly kind: "selection"; readonly node: NodeId; readonly ordinal: number }
  | { readonly kind: "construction-part"; readonly node: NodeId; readonly ordinal: number;
      readonly source: NodeRef; readonly destination: TypeComponent; readonly part: number };

export type TirBindingTarget =
  | { readonly kind: "body"; readonly instance: BodyInstance }
  | { readonly kind: "module"; readonly module: ModuleId };

export interface TirVerifierInput {
  readonly source: HirModule;
  readonly module: TirModule;
  readonly types: TypeTable;
  readonly bindingScopesOf: (target: TirBindingTarget) => readonly BindingScope[] | null;
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly memberTableOf: (instance: BodyInstance, occurrence: TirMemberOccurrence) => MemberTable | null;
  readonly bodyOf: (instance: BodyInstance) => TirBody | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nodeOf: (node: SourceNodeRef) => HirNode | null;
  readonly localExists: (local: LocalRef) => boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export type TirRule = "binding-element-role-exact" | "body-owner" | "module-node-identity" | "node-reference" | "kind-children-shape" | "origin-range"
  | "parent-reference" | "local-dense" | "local-storage" | "binding-storage" | "type-closed"
  | "capture-qualified" | "cross-owner-qualified" | "parameter-order"
  | "occurrence-role" | "binary-role-operator" | "name-role-position" | "typed-value-occurrence"
  | "argument-total" | "argument-parameter-order" | "argument-passing" | "omission-valid"
  | "authored-order-preserved" | "empty-spread-preserved" | "call-endpoints" | "completion-endpoint"
  | "binding-vector-complete" | "member-origin" | "accessor-activation" | "operation-type"
  | "conversion-source" | "conversion-destination" | "conversion-deferred" | "refinement-destination"
  | "controlled-demand" | "protocol-total" | "protocol-thrown-unknown"
  | "permission-scope" | "deferred-parameters" | "error-diagnostic" | "evidence-reference" | "evidence-order"
  | "authored-node-ids-preserved" | "no-inserted-nodes" | "no-checker-payload" | "node-in-body-range"
  | "nested-template-identity" | "nested-instance-key" | "nested-boundary"
  | "template-shared-once" | "stable-order";

export interface TirNodeSite {
  readonly kind: "node";
  readonly module: ModuleId;
  readonly node: NodeId;
}

export type TirSite =
  | { readonly kind: "body"; readonly body: BodyId }
  | TirNodeSite;

export type PrintTir = (body: TirBody) => string;
export type ParseTir = (text: string) => TextParseResult<TirBody>;
export type VerifyTir = (input: TirVerifierInput, body: TirBody) => readonly Violation<TirRule, TirSite>[];
export type VerifyTirModule = (
  input: TirVerifierInput,
  module: TirModule,
) => readonly Violation<TirRule, TirNodeSite>[];
