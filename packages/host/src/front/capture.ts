import type { ArgumentPassingFact, Diagnostic as CheckerDiagnostic, FieldFact, Node, ResolvedAliasTarget, ResolvedCallSelectionEvidence, ResolvedSourceCallInfo, ResolvedSourceTypeInfo, Signature, SourceFile, Symbol as CheckerSymbol, Type, TypeCheckerQueries, TypeIndexInfo, TypeReferenceArgumentInfo, TypeShapeQueries } from "@tsonic/tsts";
import type { NativeCheckerAdmission, ResolvedCallInferenceContribution, ResolvedCheckedComponentEvidence, ResolvedCheckerBackingConstraint, ResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo, RetainedTypeAliasApplication, SourceMarkerFact, SourceTypeRequest, TypePropertyHeader, TypePropertyInfo, TypePropertyInventory } from "@tsonic/tsts";
import { argumentPassingFactKey, defaultValueFactKey, fieldFactKey, hasDeclaredIndexReadEvidence, providerVirtualDeclarationFactKey,
  sourceMarkerFactKey, sourcePrimitiveFactKey, structFactKey, TypeFlagsConditional, TypeFlagsEnumLike, TypeFlagsIndexedAccess, TypeFlagsUniqueESSymbol } from "@tsonic/tsts";
import type { Cause, CheckerDiagnosticRef, Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { hostDiagnosticCode, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { ModuleId, NodeId } from "../ids/contract.js";
import { nodeId, rawCandidateListId, rawComponentId, rawDataLayoutId, rawMemberTableId, rawSignatureId, rawSymbolId, rawTypeId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import type { RawComponentId, RawSignatureId, RawSymbolId, RawTypeId } from "../ids/contract.js";
import type {
  CaptureDeps, CheckedProgram, RawArgumentBinding, RawAuthoredArgument, RawBinding, RawBindingTarget, RawCallSelection, RawCallableAssociation, RawCandidateList, RawCoreCapture, RawCheckedType, RawCheckerViews, RawComponent, RawComponentStep, RawDiagnosticCoverage, RawFact, RawIndexSignature, RawInferenceContribution, RawLiteral, RawMember, RawMemberOrigin, RawMemberKey, RawMemberTable, RawMemberUse, RawModule, RawModuleExport, RawModuleLink, RawNodeRef, RawParameter, RawPropertyName, RawProviderDeclaration, RawReference, RawSignature, RawStorageCapture, RawSymbol, RawTypeArgument, RawTypeForm,
} from "./contract.js";
import type { RawApplication, RawComputedMemberKey, RawConditionalBranch, RawConstraint, RawDataLayout, RawEnum, RawEnumConstant, RawEnumMember,
  RawFieldMarker, RawInterfaceDescription, RawInterfaceGroup, RawInterfaceGroupEvidence, RawLayoutConstruction, RawLayoutOperand, RawLayoutQuery, RawLayoutSelector,
  RawMarkers, RawMemberHeader, RawNumericLiteral } from "./contract.js";
import { ExtensionTable, OpenedProgram } from "./handles.js";
import { projectProviderModel } from "./provider-model.js";
import type { FileNumbering, FileSyntaxEntry } from "./handles.js";
import { captureNode, expressionKinds, typeNodeKinds } from "./syntax-capture.js";
import type { SyntaxCaptureContext } from "./syntax-support.js";
import { authoredNumericType, capturePragmas, originOf, writtenCompoundAssignmentKinds } from "./syntax-support.js";
import { isModuleBindingKind, readLayoutDescriptor, readLayoutSelector } from "../ir-hir/index.js";
import { captureFileDiagnostics } from "./diagnostics.js";
import { sameSource } from "./bindings.js";

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });
const available = <Value>(value: Value): RawFact<Value> => ({ kind: "available", value });
const notProvided = <Value>(): RawFact<Value> => ({ kind: "unavailable", reason: "not-provided", causes: [] });

/** The declaration kinds whose node is the declaration of a callable with a signature and possibly a body. */
const callableKinds: readonly string[] = ["KindFunctionDeclaration", "KindCallSignature", "KindConstructSignature", "KindMethodSignature", "KindGetAccessor", "KindSetAccessor"];
function wellKnownSymbol(kind: NonNullable<ReturnType<TypeCheckerQueries["getResolvedWellKnownSymbolInfo"]>>["kind"]):
  NonNullable<Extract<RawMemberKey, { readonly kind: "symbol" }>["wellKnown"]> {
  switch (kind) {
    case "has-instance": return "hasInstance";
    case "is-concat-spreadable": return "isConcatSpreadable";
    case "iterator": return "iterator";
    case "async-iterator": return "asyncIterator";
    case "match": return "match";
    case "match-all": return "matchAll";
    case "replace": return "replace";
    case "search": return "search";
    case "species": return "species";
    case "split": return "split";
    case "to-primitive": return "toPrimitive";
    case "to-string-tag": return "toStringTag";
    case "unscopables": return "unscopables";
    case "dispose": return "dispose";
    case "async-dispose": return "asyncDispose";
  }
}

interface InterfaceCaptureSession {
  descriptions: Set<Type> | null;
  declarations: Map<Type, readonly [Node, ...Node[]]> | null;
  applications: Map<Type, TypeInterfaceApplication> | null;
  groups: Map<Type, RawInterfaceGroupEvidence> | null;
}

/**
 * The tables of one capture, built while the module's nodes are read. Each table's identities are positions in it,
 * assigned in the order the module's nodes are visited, so that a capture of equal inputs gives equal tables.
 */
interface CaptureTables {
  globalEnvironment: Extract<RawTypeForm, { readonly kind: "source-environment" }> | null;
  readonly types: RawCheckedType[];
  readonly components: RawComponent[];
  readonly signatures: RawSignature[];
  readonly members: RawMemberTable[];
  readonly candidates: RawCandidateList[];
  readonly memoryDescriptors: RawLayoutConstruction[];
  readonly symbols: RawSymbol[];
  readonly completedSourceReferences: Map<Node, RawNodeRef>;
  authoredSourceTypes: Map<Node, ResolvedSourceTypeInfo> | null;
  tupleCalls: Map<Node, TupleCallUse> | null;
  tupleArgumentContexts: Map<Node, TupleAnnotation> | null;
  tupleLiteralContexts: Map<Node, ContextualTupleUse> | null;
  tupleLiteralReads: Map<Node, LiteralTupleUse> | null;
  readonly interfaceGroups: { readonly byTarget: Map<Type, RawInterfaceGroup>; readonly rows: RawInterfaceGroup[] };
  readonly interfaceCapture: InterfaceCaptureSession;
  readonly interfaceDescriptions: Map<Type, RawInterfaceDescription>;
  readonly symbolIds: Map<CheckerSymbol, RawSymbolId>;
  readonly signatureIds: Map<Signature, RawSignatureId>;
  readonly qualifiedSignatures: Map<Signature, Map<Node, Map<Type, Map<Node, Map<string, RawSignatureId>>>>>;
  readonly activeTypes: Map<Type, RawTypeId>;
  readonly activeQualifiedTypes: Map<BindingUse, Map<Type, RawTypeId>>;
  readonly activeIndexedAliases: Set<Node>;
  readonly activeMergedInventories: Map<CheckerSymbol, Type>;
  readonly activeMergedArguments: Set<RawTypeId>;
  mergedParameterOwners: Map<CheckerSymbol, ReadonlyMap<Node, Node>> | undefined;
  nextType: number;
  nextSignature: number;
  nextMember: number;
  readonly pending: CaptureTask[];
}

type OriginalTypeUse = RawNodeRef | Node;

interface ReceiverUse {
  readonly kind: "receiver";
  readonly type: Type;
  readonly target: CheckerSymbol;
  readonly nativeTarget: Type;
  readonly application: Node;
  readonly forwardedAlias: CheckerSymbol | null;
  readonly slots: ReadonlyMap<Type, ReceiverSlotUse>;
}

interface ReceiverSlotUse {
  readonly parameter: Type;
  readonly argument: Type;
  readonly source: Node;
  readonly declaration: Node | null;
  readonly composition?: ComposedUnionUse;
}

interface MemberBindingUse {
  readonly kind: "member";
  readonly receiver: ReceiverUse;
  readonly declarations: ReadonlySet<Node>;
}

interface CallbackBindingUse {
  readonly kind: "callback";
  readonly receiver: ReceiverUse;
  readonly syntax: Node;
  readonly type: Type;
  readonly original: Signature;
  readonly selected: Signature;
}

interface CallbackInputUse {
  readonly kind: "callback-input";
  readonly receiver: ReceiverUse;
  readonly syntax: Node;
  readonly optional: boolean;
  readonly original: Type;
  readonly selected: Type;
}

type CallableUse = MemberBindingUse | CallbackBindingUse;
interface InterfaceDescriptionUse {
  readonly kind: "interface-description";
  readonly target: Type;
}
type BindingUse = ReceiverUse | CallableUse | UnionArmUse | AuthoredFormalArms | DeclaredArgumentsUse | TupleProjectionUse
  | ContextualTupleUse | LiteralTupleUse | DirectResultUse | ComposedUnionUse | DeclaredRestUse | InterfaceDescriptionUse;
type FormalUse = Node | CallbackInputUse | ReceiverProjectionUse | RestInput | ComposedUnionUse;

interface ReceiverProjectionUse {
  readonly kind: "receiver-projection";
  readonly receiver: ReceiverUse;
  readonly syntax: Node;
  readonly source: { readonly kind: "result"; readonly signature: Signature }
    | { readonly kind: "tuple-array-result"; readonly signature: Signature; readonly element: Node }
    | { readonly kind: "formal"; readonly type: Type };
}

interface UndefinedUnionSyntax {
  readonly node: Node;
  readonly parameter: Node;
  readonly name: Node;
  readonly absent: Node;
}

interface UnionResultUse {
  readonly kind: "union-result";
  readonly syntax: UndefinedUnionSyntax;
  readonly original: Signature;
  readonly receiver: ReceiverUse;
}

interface UnionArmUse {
  readonly kind: "union-arm";
  readonly type: Type;
  readonly source: Node;
}

interface AuthoredFormalArms {
  readonly kind: "authored-formal-arms";
  readonly sources: ReadonlyMap<Type, Node>;
}

interface RestArraySyntax {
  readonly array: Node;
  readonly owner: Node;
  readonly named: { readonly name: Node; readonly argument: Node; readonly binderName: Node };
  readonly reference: Node;
}

interface ComposedRestSyntax extends RestArraySyntax {
  readonly kind: "composed";
  readonly union: Node;
  readonly bare: Node;
  readonly bareName: Node;
}

interface DeclaredRestSyntax extends RestArraySyntax {
  readonly kind: "declared";
}

interface RestInput {
  readonly kind: "rest-input";
  readonly syntax: ComposedRestSyntax | DeclaredRestSyntax;
  readonly original: Type;
  readonly selected: Type;
  readonly receiver: ReceiverUse;
}

interface DeclaredRestUse {
  readonly kind: "declared-rest";
  readonly type: Type;
  readonly nativeTarget: Type;
  readonly slot: TypeReferenceArgumentInfo;
  readonly element: Node;
  readonly argument: DeclaredArgumentsUse;
}

interface ComposedUnionUse {
  readonly kind: "composed-union";
  readonly syntax: Node;
  readonly type: Type;
  readonly bare: Type;
  readonly source: Node;
  readonly declaration: Node;
  readonly reference: Type;
  readonly argument: DeclaredArgumentsUse;
}

interface DirectResultUse {
  readonly kind: "direct-result";
  readonly receiver: ReceiverUse;
  readonly original: Signature;
  readonly syntax: Node;
  readonly name: Node;
  readonly source?: Node;
}

interface DeclaredArgumentUse {
  readonly authored: Node;
  readonly selected: Node | TupleProjectionUse;
  readonly argument: Type;
}

interface DeclaredArgumentsUse {
  readonly kind: "declared-arguments";
  readonly slots: ReadonlyMap<Type, DeclaredArgumentUse>;
}

interface TupleProjectionUse {
  readonly kind: "tuple-projection";
  readonly syntax: Node;
  readonly original: Type;
  readonly receiver: ReceiverUse;
}

interface ContextualTupleUse {
  readonly kind: "contextual-tuple";
  readonly expression: Node;
  readonly syntax: Node;
  readonly original: Type;
  nextElement: number;
}

interface LiteralTupleUse {
  readonly kind: "literal-tuple";
  readonly expression: Node;
  readonly original: Type;
}

type ProjectedOperandUse = {
  readonly kind: "projected-operand";
  readonly type: Type;
} & (
  | { readonly role: "indexed-result" | "indexed-tuple-object" | "declared-tuple-argument" | "receiver-tuple-result" }
  | { readonly role: "tuple-element"; readonly parent: RawComponent; readonly ordinal: number }
);

type ResultBindingUse = ReceiverProjectionUse | UnionResultUse | DirectResultUse;
interface MergedSlotUse {
  readonly kind: "merged-slot";
  readonly type: Type;
  readonly declarations: readonly [RawNodeRef, ...RawNodeRef[]];
}

type TypeBindingUse = BindingUse | ResultBindingUse | CallbackInputUse | RestInput | ProjectedOperandUse | MergedSlotUse;

interface SignatureBindingUse {
  readonly formals: ReadonlyMap<number, FormalUse> | null;
  readonly result: ResultBindingUse | null;
}

type CaptureTask =
  | { readonly kind: "type"; readonly id: RawTypeId; readonly answer: ResolvedSourceTypeInfo; readonly position: RawComponentId;
      readonly originalUse: OriginalTypeUse | null; readonly bindingUse: TypeBindingUse | null; readonly literalNode: Node | null }
  | { readonly kind: "leave-type"; readonly id: RawTypeId; readonly type: Type; readonly key: BindingUse | null }
  | { readonly kind: "indexed-alias-scope"; readonly declaration: Node; readonly enter: boolean }
  | { readonly kind: "merged-inventory-scope"; readonly symbol: CheckerSymbol; readonly type: Type; readonly enter: boolean }
  | { readonly kind: "signature"; readonly id: RawSignatureId; readonly signature: Signature; readonly owner: RawNodeRef; readonly signatureKind: "call" | "construct"; readonly use: SignatureBindingUse | null }
  | { readonly kind: "signature-parameter"; readonly draft: SignatureDraft; readonly index: number };

interface SignatureDraft {
  readonly id: RawSignatureId;
  readonly signature: Signature;
  readonly target: RawSignatureId | null;
  readonly owner: RawNodeRef;
  readonly kind: "call" | "construct";
  readonly declaration: RawNodeRef | null;
  readonly parameterInfos: ReturnType<TypeShapeQueries["getSignatureParameterInfos"]>;
  readonly parameters: RawParameter[];
  readonly use: SignatureBindingUse | null;
}

/** The facts and edges a capture has admitted, and the first limit it met. */
interface CaptureMeter {
  facts: number;
  edges: number;
  refusal: Diagnostic | null;
}

interface CaptureAdmission {
  readonly deps: CaptureDeps;
  readonly path: string;
  readonly meter: CaptureMeter;
  readonly module: ModuleId;
}

interface CaptureScope extends CaptureAdmission {
  readonly program: CheckedProgram;
  readonly file: SourceFile;
  readonly numericLiterals: Map<Node, RawNumericLiteral>;
  readonly syntaxOf: ReturnType<typeof captureNode>["syntaxOf"];
  readonly checked: OpenedProgramView;
  readonly checker: Omit<TypeCheckerQueries, "getTypeAtLocation" | "getTypeFromTypeNode" | "getContextualType" |
    "getReturnTypeOfSignature" | "getResolvedCallInfo" | "getResolvedStorageInfo">;
  readonly shape: Omit<TypeShapeQueries, "getTypeFromTypeNode" | "getReturnTypeOfSignature" | "getSignatureParameterInfos">;
  readonly ownNodes: ReadonlyMap<Node, NodeId>;
  readonly emptyCoreInventory: boolean;
  readonly emptyObservationInventory: boolean;
  readonly closedOrdinaryPassing: boolean;
  readonly closedOrdinaryExtent: boolean;
  readonly closedOrdinaryApplication: boolean;
  readonly sourcePrimitiveFacts: boolean;
  readonly diagnosticRoots: Map<CheckerDiagnostic, CheckerDiagnosticRef>;
  readonly callCore: Map<NodeId, CallCore>;
  readonly tables: CaptureTables;
  rootAssignmentAnnotations: Map<Node, Node> | null;
  fieldSelectors: Map<NodeId, RawLayoutSelector> | null;
  invalidLayout: Diagnostic | null;
}

interface TupleCallUse {
  readonly call: ResolvedSourceCallInfo;
  readonly annotation: Node | null;
}

interface TupleAnnotation {
  readonly type: Type;
  readonly annotation: Node;
}

type CallCore = NonNullable<Extract<RawMarkers["application"], { readonly kind: "available" }>["value"]>
  | { readonly role: "provider"; readonly receipt: RawProviderDeclaration }
  | { readonly role: "layout-construction"; readonly capture: RawLayoutConstruction; readonly provider: RawProviderDeclaration | undefined }
  | { readonly role: "layout-query"; readonly capture: RawLayoutQuery; readonly provider: RawProviderDeclaration | undefined }
  | "ordinary";

type LayoutRole =
  | { readonly kind: "construction"; readonly construction: "value" | "array" | "field" }
  | { readonly kind: "query"; readonly operation: RawLayoutQuery["operation"] };

function layoutRole(marker: SourceMarkerFact | undefined): LayoutRole | null {
  if (marker?.kind !== "call-marker") return null;
  switch (marker.marker) {
    case "memory-value-layout": return { kind: "construction", construction: "value" };
    case "memory-array-layout": return { kind: "construction", construction: "array" };
    case "memory-field-layout": return { kind: "construction", construction: "field" };
    case "memory-size": return { kind: "query", operation: "size" };
    case "memory-alignment": return { kind: "query", operation: "alignment" };
    case "memory-stride": return { kind: "query", operation: "stride" };
    case "memory-field-offset": return { kind: "query", operation: "field-offset" };
    default: return null;
  }
}

type OpenedProgramView = ReturnType<typeof OpenedProgram.checked>;

const limitRefusal = (module: ModuleId, path: string, limit: string, maximum: number): Diagnostic =>
  resourceLimitDiagnostic({ owner: "front", limit, maximum, site: { kind: "file", path }, unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } });

function excludedExpressionOf(ast: OpenedProgramView["ast"], node: Node): Hir.ExcludedExpressionForm | null {
  switch (ast.kindName(node)) {
    case "KindJsxElement": return "JsxElement";
    case "KindJsxSelfClosingElement": return "JsxSelfClosingElement";
    case "KindJsxFragment": return "JsxFragment";
    case "KindCallExpression": return ast.kindName(ast.as.AsCallExpression(node)?.Expression) === "KindImportKeyword" ? "DynamicImport" : null;
    default: return null;
  }
}

/**
 * The one numbering of a file's nodes (V-1): their preorder, made by one iterative walk. A module's own capture and every
 * reference into another file use it; the syntax capture consumes it and checks, node by node, that it visits the nodes
 * in this order, so the two cannot disagree silently. It is made once per file and kept on the opened program (V-2),
 * whatever module asks, and never captures another file's syntax. The walk enforces the syntax-depth and node limits
 * before each node is numbered; a file over either is refused, with that refusal kept, and nothing of it is numbered.
 */
function fileNumberingOf(deps: CaptureDeps, program: CheckedProgram, path: string, module: ModuleId): FileSyntaxEntry["outcome"] {
  const cache = OpenedProgram.syntax(program);
  const limits = { maximumSyntaxDepth: deps.navigationCapture.maximumSyntaxDepth, maximumCapturedNodesPerModule: deps.navigationCapture.maximumCapturedNodesPerModule };
  const known = cache.get(path);
  if (known !== undefined) {
    if (known.limits.maximumSyntaxDepth !== limits.maximumSyntaxDepth || known.limits.maximumCapturedNodesPerModule !== limits.maximumCapturedNodesPerModule)
      throw new TypeError("front: one opened program is captured under one set of navigation capture limits");
    return known.outcome;
  }
  const keep = (outcome: FileSyntaxEntry["outcome"]): FileSyntaxEntry["outcome"] => { cache.set(path, { limits, outcome }); return outcome; };
  const checked = OpenedProgram.checked(program);
  const ast = checked.ast;
  const entry = OpenedProgram.file(program, module);
  if (entry === undefined || ast.getFileName(entry.file) !== path)
    return throwInvariant(invariant("A file of the opened program has no source file."));
  const file = entry.file;
  const nodes: Node[] = [];
  const ids = new Map<Node, NodeId>();
  const parents = new Map<Node, NodeId | null>();
  let excluded: Map<Node, Hir.ExcludedExpressionForm> | null = null;
  type Pending = { readonly node: Node; readonly depth: number; readonly parent: NodeId | null; next: Pending | null };
  let admitted = 0;
  let refusal: Diagnostic | null = null;
  const admitNode = (depth: number): boolean => {
    if (depth > limits.maximumSyntaxDepth) refusal = limitRefusal(module, path, "front.maximumSyntaxDepth", limits.maximumSyntaxDepth);
    else if (admitted >= limits.maximumCapturedNodesPerModule)
      refusal = limitRefusal(module, path, "front.maximumCapturedNodesPerModule", limits.maximumCapturedNodesPerModule);
    if (refusal !== null) return false;
    admitted += 1;
    return true;
  };
  if (!admitNode(1)) return keep({ kind: "refused", diagnostic: refusal ?? throwInvariant(invariant("A failed syntax admission has no original refusal.")) });
  let pending: Pending | null = { node: file, depth: 1, parent: null, next: null };
  while (pending !== null) {
    const next: Pending = pending;
    pending = next.next;
    const id = nodeId(nodes.length);
    ids.set(next.node, id);
    parents.set(next.node, next.parent);
    nodes.push(next.node);
    const form = excludedExpressionOf(ast, next.node);
    if (form !== null) {
      (excluded ??= new Map()).set(next.node, form);
      continue;
    }
    const depth = next.depth + 1;
    const children: { first: Pending | null; last: Pending | null } = { first: null, last: null };
    ast.forEachChildUntil(next.node, child => {
      if (child === undefined) return false;
      if (!admitNode(depth)) return true;
      const frame: Pending = { node: child, depth, parent: id, next: null };
      if (children.last === null) children.first = frame;
      else children.last.next = frame;
      children.last = frame;
      return false;
    });
    if (refusal !== null) return keep({ kind: "refused", diagnostic: refusal });
    if (children.last !== null) {
      children.last.next = pending;
      pending = children.first;
    }
  }
  const numbering: FileNumbering = { nodes, ids, parents, excluded };
  return keep({ kind: "numbered", numbering });
}

/** Admits facts or edges before they are added; the first one over its limit stops the capture with a refusal. */
function admit(scope: CaptureAdmission, dimension: "facts" | "edges", units = 1): boolean {
  if (scope.meter.refusal !== null) return false;
  const maximum = dimension === "facts" ? scope.deps.navigationCapture.maximumCapturedFactsPerModule : scope.deps.navigationCapture.maximumCapturedEdgesPerModule;
  if (units > maximum - scope.meter[dimension]) {
    scope.meter.refusal = limitRefusal(scope.module, scope.path, dimension === "facts" ? "front.maximumCapturedFactsPerModule" : "front.maximumCapturedEdgesPerModule", maximum);
    return false;
  }
  scope.meter[dimension] += units;
  return true;
}

function nativeCaptureAdmission(scope: CaptureAdmission): NativeCheckerAdmission<Diagnostic> {
  return (cost, units) => admit(scope, cost === "work" ? "edges" : "facts", units) ? null :
    scope.meter.refusal ?? throwInvariant(invariant("Native acquisition retains its actual first capture refusal."));
}

function nativeAliasApplication(scope: CaptureScope, type: Type, acquire: TypeShapeQueries["acquireTypeAliasApplication"]):
  RetainedTypeAliasApplication | undefined {
  if (scope.meter.refusal !== null) return undefined;
  const result = acquire(type, nativeCaptureAdmission(scope));
  if (result.kind === "refused" && result.stop !== scope.meter.refusal)
    return throwInvariant(invariant("Native alias acquisition must retain its actual first capture refusal."));
  return result.kind === "complete" ? result.value : undefined;
}

function sourceType(scope: CaptureScope, request: SourceTypeRequest): ResolvedSourceTypeInfo | undefined {
  if (scope.meter.refusal !== null) return undefined;
  const annotation = request.kind === "annotation" ? request.node : undefined;
  if (annotation !== undefined) {
    if (!admit(scope, "edges")) return undefined;
    const known = scope.tables.authoredSourceTypes?.get(annotation);
    if (known !== undefined) return known;
  }
  const result = scope.checker.acquireSourceType(request, nativeCaptureAdmission(scope));
  if (result.kind === "refused" && result.stop !== scope.meter.refusal)
    return throwInvariant(invariant("A source-type acquisition must retain its actual first capture refusal."));
  if (result.kind !== "complete") return undefined;
  if (annotation !== undefined) {
    if (!admit(scope, "facts", scope.tables.authoredSourceTypes === null ? 2 : 1)) return undefined;
    (scope.tables.authoredSourceTypes ??= new Map()).set(annotation, result.value);
  }
  return result.value;
}

function signatureParameters(scope: CaptureScope, signature: Signature): SignatureDraft["parameterInfos"] | null {
  if (scope.meter.refusal !== null) return null;
  const result = scope.shape.acquireSignatureParameters(signature, nativeCaptureAdmission(scope));
  if (result.kind === "complete") return result.value;
  if (result.kind === "refused" && result.stop === scope.meter.refusal) return null;
  return throwInvariant(invariant("A signature parameter acquisition needs its actual checked owner or original refusal."));
}

function moduleOfFile(program: CheckedProgram, file: SourceFile, ast: OpenedProgramView["ast"]): ModuleId | undefined {
  return OpenedProgram.moduleAt(program, ast.getFileName(file));
}

function moduleSpecifier(ast: OpenedProgramView["ast"], node: Node, parent: Node | undefined): boolean {
  if (parent === undefined) return false;
  switch (ast.kindName(parent)) {
    case "KindImportDeclaration": case "KindJSImportDeclaration": return ast.as.AsImportDeclaration(parent)?.ModuleSpecifier === node;
    case "KindExportDeclaration": return ast.as.AsExportDeclaration(parent)?.ModuleSpecifier === node;
    default: return false;
  }
}

function annotationName(ast: OpenedProgramView["ast"], node: Node, parent: Node | undefined): boolean {
  const kind = ast.kindName(node);
  if (kind !== "KindIdentifier" && kind !== "KindQualifiedName") return false;
  switch (ast.kindName(parent)) {
    case "KindTypeReference": return ast.as.AsTypeReferenceNode(parent)?.TypeName === node;
    case "KindTypeQuery": return ast.as.AsTypeQueryNode(parent)?.ExprName === node;
    case "KindImportType": return ast.as.AsImportTypeNode(parent)?.Qualifier === node;
    case "KindQualifiedName": {
      const qualified = ast.as.AsQualifiedName(parent);
      return qualified?.Left === node || qualified?.Right === node;
    }
    default: return false;
  }
}

function interfaceHeritage(ast: OpenedProgramView["ast"], node: Node | undefined): boolean {
  if (ast.kindName(node) !== "KindExpressionWithTypeArguments") return false;
  const clause = ast.parent(node);
  return ast.kindName(clause) === "KindHeritageClause" && ast.kindName(ast.parent(clause)) === "KindInterfaceDeclaration";
}

function referenceTo(scope: CaptureScope, program: CheckedProgram, declaration: Node): RawNodeRef | null {
  if (scope.meter.refusal !== null) return null;
  const known = scope.tables.completedSourceReferences.get(declaration);
  if (known !== undefined) return known;
  const ast = scope.checked.ast;
  const file = ast.getSourceFile(declaration);
  if (file === undefined) return null;
  const module = moduleOfFile(program, file, ast);
  if (module === undefined) return null;
  let node: NodeId | undefined;
  if (file === scope.file) node = scope.ownNodes.get(declaration);
  else {
    const other = fileNumberingOf(scope.deps, program, ast.getFileName(file), module);
    if (other.kind === "refused") {
      scope.meter.refusal = other.diagnostic;
      return null;
    }
    node = other.numbering.ids.get(declaration);
  }
  if (node === undefined) return null;
  const reference = { module, node };
  scope.tables.completedSourceReferences.set(declaration, reference);
  return reference;
}

/**
 * Every growth below is admitted before anything is read for it, and returns null once the capture has met a limit:
 * the first refusal stops all further checker reads and rows (K-3341); the callers stop at the null.
 */
function component(scope: CaptureScope, root: RawNodeRef, step: RawComponentStep | null, prefix: RawComponentId | null = null): RawComponentId | null {
  if (!admit(scope, "facts")) return null;
  const id = rawComponentId(scope.tables.components.length);
  scope.tables.components.push({ id, root, path: step === null ? null : { prefix, step } });
  return id;
}

function appendComponent(scope: CaptureScope, parent: RawComponent, step: RawComponentStep): RawComponentId | null {
  const prefix = parent.path === null ? null : parent.id;
  return prefix !== null && !admit(scope, "edges") ? null : component(scope, parent.root, step, prefix);
}

/**
 * The captured form of a checker type. Scalars and memberless callable inventories retain the SDK's actual forms; any other form is a defect of
 * this capture's development frontier (a compiler defect, never a user diagnostic), named with the checker's own
 * text of the type.
 */
function capturedPropertyKey(scope: CaptureScope, node: Node | undefined, mappedKey?: Type): RawComputedMemberKey | null {
  if (node === undefined) return null;
  const selected = scope.checker.getEffectivePropertyName(node);
  if (selected?.kind === "string") return mappedKey === undefined || scope.shape.getStringLiteralTypeValue(mappedKey) === selected.name
    ? { kind: "text", value: selected.name } : null;
  if (selected?.kind === "numeric") {
    if (mappedKey !== undefined && mappedKey !== selected.type) return null;
    if (!admit(scope, "edges")) return null;
    const value = scope.shape.getNumericLiteralTypeValue(selected.type);
    if (typeof value !== "number") return throwInvariant(invariant("A selected numeric property key requires its actual checker number evidence."));
    const ast = scope.checked.ast;
    const source = ast.as.AsComputedPropertyName(node)?.Expression ?? node;
    const file = ast.getSourceFile(source);
    const module = file === undefined ? undefined : moduleOfFile(scope.program, file, ast);
    const input = module === undefined ? undefined : OpenedProgram.file(scope.program, module);
    if (module === undefined || input === undefined || input.file !== file)
      return throwInvariant(invariant("A numeric property key requires its actual admitted source file."));
    return { kind: "numeric", value, origin: originOf({ ast, module, displacement: input.displacement }, source) };
  }
  if (selected?.kind !== "unique-symbol") return null;
  if (mappedKey !== undefined && mappedKey !== selected.type) return null;
  const symbol = scope.checker.getTypeSymbol(selected.type);
  const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
  if (!admit(scope, "edges")) return null;
  const declaration = declarations[0];
  if (declarations.length !== 1 || declaration === undefined)
    return throwInvariant(invariant("A selected unique-symbol property key requires its actual unique declaration."));
  const source = referenceTo(scope, scope.program, declaration);
  if (scope.meter.refusal !== null) return null;
  if (source === null) return throwInvariant(invariant("A selected unique-symbol key requires its admitted original source declaration."));
  const wellKnown = scope.checker.getResolvedWellKnownSymbolInfo(node);
  return { kind: "symbol", declaration: source, wellKnown: wellKnown === undefined ? null : wellKnownSymbol(wellKnown.kind) };
}

function capturedInventoryKey(scope: CaptureScope, declaration: Node): RawMemberKey | null {
  const ast = scope.checked.ast;
  const name = ast.name(declaration);
  if (ast.kindName(name) !== "KindPrivateIdentifier") return capturedPropertyKey(scope, name);
  if (!admit(scope, "edges")) return null;
  const identifier = ast.as.AsPrivateIdentifier(name);
  const owner = ast.parent(declaration);
  const kind = ast.kindName(owner);
  if (identifier === undefined || ast.parent(name) !== declaration ||
    owner === undefined || kind !== "KindClassDeclaration" && kind !== "KindClassExpression")
    return throwInvariant(invariant("A private member key requires its actual declaring class and authored private identifier."));
  const reference = referenceTo(scope, scope.program, owner);
  if (scope.meter.refusal !== null) return null;
  if (reference === null) return throwInvariant(invariant("A private member key requires its admitted declaring class."));
  return { kind: "private", owner: reference, name: identifier.Text };
}

function capturedMemberOrigin(kind: string, reference: RawNodeRef, access: "read" | "write"): RawMemberOrigin {
  return kind === "KindPropertyAssignment" ? { kind: "source-member", occurrence: reference, access }
    : { kind: "declaration", declaration: reference, access };
}

interface MappedOwner {
  readonly node: Node;
  readonly declaration: RawNodeRef;
}

function missingMappedOrigin(): never {
  throw new TypeError("front: mapped property origin transport requires its actual selected mapped component");
}

function mappedOwner(scope: CaptureScope, type: Type, node: Node | undefined): MappedOwner | null {
  if (!admit(scope, "edges")) return null;
  const ast = scope.checked.ast;
  if (node === undefined || ast.kindName(node) !== "KindMappedType") return missingMappedOrigin();
  const mapped = ast.as.AsMappedTypeNode(node);
  const parameter = mapped?.TypeParameter;
  if (mapped === undefined || mapped.NameType !== undefined || parameter === undefined ||
    ast.kindName(parameter) !== "KindTypeParameter" || ast.parent(parameter) !== node) return missingMappedOrigin();
  const symbol = scope.checker.getTypeSymbol(type);
  const declarations = scope.checker.getSymbolDeclarations(symbol);
  if (declarations.length !== 1 || declarations[0] !== node) return missingMappedOrigin();
  const authored = sourceType(scope, { kind: "annotation", node });
  if (scope.meter.refusal !== null) return null;
  if (authored === undefined || authored.causes.length !== 0 ||
    (type !== authored.type && scope.shape.getTypeReferenceTarget(type) !== authored.type)) return missingMappedOrigin();
  if (!admit(scope, "edges")) return null;
  const binder = scope.checker.getSymbolAtLocation(ast.name(parameter));
  const binders = scope.checker.getSymbolDeclarations(binder);
  if (binder === undefined || binders.length !== 1 || binders[0] !== parameter ||
    scope.checker.getTypeSymbol(scope.checker.getDeclaredTypeOfSymbol(binder)) !== binder) return missingMappedOrigin();
  const declaration = referenceTo(scope, scope.program, node);
  if (scope.meter.refusal !== null) return null;
  if (declaration === null) return missingMappedOrigin();
  return { node, declaration };
}

function capturedMappedMember(scope: CaptureScope, property: TypePropertyInfo,
  owner: MappedOwner, position: RawComponentId, readType: (type: Type, step: RawComponentStep) => RawTypeId | null): RawMember | null {
  if (!admit(scope, "edges")) return null;
  const mapped = property.mapped;
  if (mapped === undefined || mapped.declaration !== owner.node || mapped.keyType === undefined || mapped.syntheticOrigin === undefined)
    return missingMappedOrigin();
  const primary = scope.checker.getSymbolValueDeclaration(mapped.syntheticOrigin);
  if (primary === undefined) return missingMappedOrigin();
  const declarations: RawNodeRef[] = [];
  const found = new Set<Node>();
  for (let index = 0; index < property.rootSymbols.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const symbol = property.rootSymbols[index];
    if (symbol === undefined) return missingMappedOrigin();
    const sources = scope.checker.getSymbolDeclarations(symbol);
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      if (!admit(scope, "edges")) return null;
      const source = sources[sourceIndex];
      if (source === undefined) return missingMappedOrigin();
      if (found.has(source)) continue;
      if (!admit(scope, "facts")) return null;
      const reference = referenceTo(scope, scope.program, source);
      if (scope.meter.refusal !== null) return null;
      if (reference === null) return missingMappedOrigin();
      found.add(source);
      declarations.push(reference);
    }
  }
  if (!found.has(primary)) return missingMappedOrigin();
  const key = capturedPropertyKey(scope, scope.checked.ast.name(primary), mapped.keyType);
  if (scope.meter.refusal !== null) return null;
  if (key === null) return missingMappedOrigin();
  const origins: RawMemberOrigin[] = [];
  const accessType = (access: "read" | "write"): RawTypeId | null => {
    if (!admit(scope, "facts")) return null;
    const evidence = { declaration: owner.declaration, source: position, key, access };
    const type = readType(property.type, { kind: "mapped-member", ...evidence });
    if (type !== null) origins.push({ kind: "mapped", ...evidence });
    return type;
  };
  const read = accessType("read");
  if (read === null) return null;
  const write = property.readonly ? null : accessType("write");
  if (!property.readonly && write === null) return null;
  return { key, name: property.name, origins, declarations, getters: [], setters: [], readKind: "mapped",
    optional: property.optional, readonly: property.readonly, read: available(read), write: available(write) };
}

function capturedDeclaredMember(scope: CaptureScope, property: TypePropertyHeader, primary: Node):
  { readonly header: RawMemberHeader; readonly origin: RawNodeRef; readonly declarations: ReadonlySet<Node>; readonly setter: Node | undefined } | null {
  const key = capturedInventoryKey(scope, primary);
  if (scope.meter.refusal !== null) return null;
  if (key === null) throw new TypeError("front: a member requires its actual selected source property-key evidence");
  const origin = referenceTo(scope, scope.program, primary);
  if (scope.meter.refusal !== null) return null;
  if (origin === null) return throwInvariant(invariant("A property value declaration must retain its actual admitted source identity."));
  const declarations: RawNodeRef[] = [];
  const getters: RawNodeRef[] = [];
  const setters: RawNodeRef[] = [];
  let setter: Node | undefined;
  const origins: RawMemberOrigin[] = [];
  const seen = new Set<Node>();
  let method = false;
  for (let rootIndex = 0; rootIndex < property.rootSymbols.length; rootIndex += 1) {
    if (!admit(scope, "edges")) return null;
    const root = property.rootSymbols[rootIndex];
    if (root === undefined) return throwInvariant(invariant("A selected property retains each actual checker root symbol."));
    const sources = scope.checker.getSymbolDeclarations(root);
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
      const source = sources[sourceIndex];
      if (source === undefined) return throwInvariant(invariant("A property root declaration inventory must be dense."));
      if (seen.has(source)) continue;
      seen.add(source);
      const kind = scope.checked.ast.kindName(source);
      if (kind === "KindInterfaceDeclaration" || kind === "KindTypeAliasDeclaration") continue;
      if (kind !== "KindVariableDeclaration" && kind !== "KindFunctionDeclaration" && kind !== "KindModuleDeclaration"
        && kind !== "KindPropertyDeclaration" && kind !== "KindPropertyAssignment"
        && kind !== "KindPropertySignature" && kind !== "KindMethodDeclaration" && kind !== "KindMethodSignature"
        && kind !== "KindGetAccessor" && kind !== "KindSetAccessor")
        throw new TypeError(`front: property origin transport for the actual ${kind} declaration is not implemented`);
      const reference = referenceTo(scope, scope.program, source);
      if (scope.meter.refusal !== null) return null;
      if (reference === null) return throwInvariant(invariant("A property origin requires its actual admitted source declaration."));
      declarations.push(reference);
      if (kind === "KindGetAccessor") getters.push(reference);
      if (kind === "KindSetAccessor") { setters.push(reference); setter ??= source; }
      method ||= kind === "KindMethodDeclaration" || kind === "KindMethodSignature";
      if (kind !== "KindSetAccessor") {
        if (!admit(scope, "facts")) return null;
        origins.push(capturedMemberOrigin(kind, reference, "read"));
      }
      if (!property.readonly && kind !== "KindGetAccessor") {
        if (!admit(scope, "facts")) return null;
        origins.push(capturedMemberOrigin(kind, reference, "write"));
      }
    }
  }
  if (declarations.length === 0 || !seen.has(primary))
    throw new TypeError("front: a member requires its actual declared or synthetic origin association");
  return { origin, setter, declarations: seen, header: { key, name: property.name, origins, declarations, getters, setters,
    optional: property.optional, readonly: property.readonly,
    readKind: getters.length !== 0 || setters.length !== 0 ? "accessor" : method ? "method" : "property" } };
}

interface PrimitiveFieldSource {
  readonly annotation: Node;
  readonly present: Type;
  readonly optional: Type | null;
}

function primitiveFieldSource(scope: CaptureScope, property: TypePropertyHeader, declaration: Node, selected: Type | undefined): PrimitiveFieldSource | null {
  if (!scope.sourcePrimitiveFacts || selected === undefined || property.rootSymbols.length !== 1
    || !admit(scope, "edges")) return null;
  const checker = scope.checker;
  const root = property.rootSymbols[0];
  if (root !== property.symbol || checker.getSymbolValueDeclaration(root) !== declaration) return null;
  const declarations = checker.getSymbolDeclarations(root);
  if (declarations.length !== 1 || declarations[0] !== declaration) return null;
  const ast = scope.checked.ast;
  if (ast.kindName(declaration) !== "KindPropertySignature") return null;
  const annotation = ast.typeNode(declaration);
  if (annotation === undefined || !admit(scope, "edges") || scope.checked.sourceFacts.getFact(annotation, sourcePrimitiveFactKey) === undefined)
    return null;
  const authored = sourceType(scope, { kind: "annotation", node: annotation });
  if (authored === undefined || authored.causes.length !== 0) return null;
  if (authored.type === selected) return { annotation, present: authored.type, optional: null };
  if (!property.optional) return null;
  const union = undefinedUnionArms(scope, selected);
  return union?.value === authored.type ? { annotation, present: authored.type, optional: selected } : null;
}

function captureFieldSource(field: PrimitiveFieldSource | null, selected: Type | undefined):
  { readonly annotation: Node | null; readonly arm: UnionArmUse | null } | null {
  if (field !== null && selected === field.present) return { annotation: field.annotation, arm: null };
  if (field !== null && selected === field.optional)
    return { annotation: null, arm: { kind: "union-arm", type: field.present, source: field.annotation } };
  return null;
}

function tupleBindingAnnotation(scope: CaptureScope, leaf: Node, enclosing: Node, destination: Type): Node | null {
  const ast = scope.checked.ast;
  if (!admit(scope, "facts")) return null;
  const path: number[] = [];
  let element = leaf;
  let pattern = enclosing;
  for (;;) {
    if (!admit(scope, "edges")) return null;
    const binding = ast.as.AsBindingElement(element);
    if (ast.kindName(pattern) !== "KindArrayBindingPattern" || binding === undefined
      || binding.Initializer !== undefined || binding.PropertyName !== undefined || binding.DotDotDotToken !== undefined) return null;
    const elements = ast.as.AsBindingPattern(pattern)?.Elements?.Nodes;
    if (elements === undefined) return null;
    let ordinal = 0;
    for (; ordinal < elements.length; ordinal += 1) {
      if (!admit(scope, "edges")) return null;
      if (elements[ordinal] === element) break;
    }
    if (ordinal === elements.length || !admit(scope, "facts")) return null;
    path.push(ordinal);
    const owner = ast.parent(pattern);
    if (ast.kindName(owner) === "KindVariableDeclaration") {
      const variable = ast.as.AsVariableDeclaration(owner);
      if (variable?.name !== pattern || variable.Initializer === undefined) return null;
      const written = variable.Type;
      const receiver = written === undefined
        ? sourceType(scope, { kind: "expression", node: variable.Initializer })
        : sourceType(scope, { kind: "annotation", node: written });
      if (receiver === undefined || receiver.causes.length !== 0) return null;
      let type = receiver.type;
      let annotation = written ?? valueTupleAnnotation(scope, variable.Initializer, receiver) ?? undefined;
      for (let depth = path.length - 1; depth >= 0; depth -= 1) {
        const source = tupleAnnotationOf(scope, type, annotation);
        if (source === undefined || !admit(scope, "edges")) return null;
        const syntax = tupleSyntax(scope, source);
        const tuple = scope.shape.getTupleInfo(type);
        if (syntax === undefined || tuple === undefined
          || syntax.readonly !== tuple.readonly || syntax.elements.length !== tuple.elements.length) return null;
        const selected = path[depth];
        if (selected === undefined) return null;
        const slot = tuple.elements[selected];
        annotation = syntax.elements[selected];
        if (slot?.elementKind !== "required" || slot.declaration !== undefined || annotation === undefined) return null;
        type = slot.type;
      }
      return type === destination ? annotation ?? null : null;
    }
    if (owner === undefined || ast.kindName(owner) !== "KindBindingElement" || ast.name(owner) !== pattern) return null;
    const parent = ast.parent(owner);
    if (parent === undefined) return null;
    element = owner;
    pattern = parent;
  }
}

function primitiveBindingSource(scope: CaptureScope, element: Node, pattern: Node, name: Node, checked: ResolvedSourceTypeInfo | undefined) {
  const ast = scope.checked.ast;
  if (!scope.sourcePrimitiveFacts || checked === undefined || checked.causes.length !== 0 || !admit(scope, "edges")) return null;
  const kind = ast.kindName(pattern);
  if (kind === "KindArrayBindingPattern") {
    const annotation = tupleBindingAnnotation(scope, element, pattern, checked.type);
    return annotation === null ? null : { annotation, arm: null };
  }
  if (kind !== "KindObjectBindingPattern") return null;
  const owner = ast.parent(pattern);
  const variable = ast.kindName(owner) === "KindVariableDeclaration" ? ast.as.AsVariableDeclaration(owner) : undefined;
  const binding = ast.as.AsBindingElement(element);
  if (variable?.name !== pattern || variable.Initializer === undefined || binding === undefined || binding.DotDotDotToken !== undefined)
    return null;
  const key = scope.checker.getEffectivePropertyName(binding.PropertyName ?? name);
  if (key?.kind !== "string") return null;
  const receiver = sourceType(scope, { kind: "expression", node: variable.Initializer });
  if (receiver === undefined || receiver.causes.length !== 0) return null;
  const inventory = scope.shape.getStructuredInventory(receiver.type, nativeCaptureAdmission(scope));
  if (inventory.kind !== "complete") return null;
  const properties = inventory.value.properties;
  for (;;) {
    const reached = properties.next();
    if (reached.kind !== "complete" || reached.value === null) return null;
    const property = reached.value;
    if (!admit(scope, "edges", key.name.length + property.name.length)) return null;
    if (key.name !== property.name) continue;
    const primary = scope.checker.getSymbolValueDeclaration(property.symbol);
    const field = primary === undefined ? null : primitiveFieldSource(scope, property, primary, property.type);
    if (field === null || binding.Initializer !== undefined && checked.type !== field.present) return null;
    return captureFieldSource(field, checked.type);
  }
}

function capturedMembers(scope: CaptureScope, type: Type, properties: TypePropertyInventory<Diagnostic>,
  position: RawComponentId, receiver: ReceiverUse | null): readonly RawMember[] | null {
  const parent = scope.tables.components[position];
  if (parent === undefined) return throwInvariant(invariant("A member inventory requires its actual captured source component."));
  const members: RawMember[] = [];
  let mapped: MappedOwner | null = null;
  while (true) {
    const selected = properties.next();
    if (selected.kind === "refused") {
      if (selected.stop !== scope.meter.refusal)
        return throwInvariant(invariant("An admitted property scan retains its actual first capture refusal."));
      return null;
    }
    if (selected.kind === "unavailable") return throwInvariant(invariant("An admitted property retains its actual owning checker."));
    const property = selected.value;
    if (property === null) break;
    if (!admit(scope, "facts")) return null;
    const readType = (type: Type, step: RawComponentStep, use: BindingUse | null = null, typeSource?: Node): RawTypeId | null =>
      rawType(scope, () => withoutTypeCause(type, typeSource), appendComponent(scope, parent, step), null, use);
    if (property.mapped !== undefined) {
      mapped ??= mappedOwner(scope, type, property.mapped.declaration);
      if (mapped === null) return null;
      const member = capturedMappedMember(scope, property, mapped, position, readType);
      if (member === null) return null;
      members.push(member);
      continue;
    }
    const primary = scope.checker.getSymbolValueDeclaration(property.symbol);
    if (primary === undefined) {
      if (property.classPrototype !== undefined) {
        if (!admit(scope, "edges")) return null;
        const declaration = referenceTo(scope, scope.program, property.classPrototype);
        if (scope.meter.refusal !== null) return null;
        if (declaration === null) return throwInvariant(invariant("A class prototype requires its actual admitted class."));
        const read = readType(property.type, { kind: "class-prototype", declaration });
        if (read === null) return null;
        members.push({ name: property.name, key: { kind: "text", value: property.name },
          origins: [{ kind: "class-prototype", declaration, facet: "value" }],
          declarations: [], getters: [], setters: [], optional: property.optional, readonly: property.readonly,
          read: available(read), write: notProvided(), readKind: "class-prototype" });
        continue;
      }
      const pattern = property.bindingPattern;
      if (pattern !== undefined) {
        if (!admit(scope, "edges")) return null;
        const ast = scope.checked.ast;
        if (ast.kindName(pattern.element) !== "KindBindingElement"
          || ast.kindName(ast.parent(pattern.element)) !== "KindObjectBindingPattern"
          || property.rootSymbols.length !== 1 || property.rootSymbols[0] !== property.symbol)
          return throwInvariant(invariant("A contextual member requires its original synthetic binding element."));
        const name = scope.shape.getStringLiteralTypeValue(pattern.keyType);
        if (name === undefined) throw new TypeError("front: a contextual binding member requires its actual selected text key");
        const occurrence = referenceTo(scope, scope.program, pattern.element);
        if (scope.meter.refusal !== null) return null;
        if (occurrence === null) return throwInvariant(invariant("A contextual member requires its admitted binding occurrence."));
        const origins: Extract<RawMemberOrigin, { readonly kind: "source-member" }>[] = [];
        const accessType = (access: "read" | "write"): RawTypeId | null => {
          if (!admit(scope, "facts")) return null;
          const origin: Extract<RawMemberOrigin, { readonly kind: "source-member" }> = { kind: "source-member", occurrence, access };
          const selected = readType(property.type, origin);
          if (selected !== null) origins.push(origin);
          return selected;
        };
        const read = accessType("read");
        if (read === null) return null;
        const write = property.readonly ? null : accessType("write");
        if (!property.readonly && write === null) return null;
        members.push({ key: { kind: "text", value: name }, name, origins,
          declarations: [], getters: [], setters: [], optional: property.optional, readonly: property.readonly,
          read: available(read), write: available(write), readKind: "property" });
        continue;
      }
      const symbol = property.intrinsicOrigin;
      if (symbol === undefined)
        throw new TypeError("front: a property without an actual source value declaration requires its original synthetic member association");
      if (!admit(scope, "facts")) return null;
      const read = readType(property.type, { kind: "intrinsic-member", symbol, access: "read" });
      if (read === null) return null;
      const origins: RawMemberOrigin[] = [{ kind: "intrinsic", symbol, access: "read" }];
      let write: RawTypeId | null = null;
      if (!property.readonly) {
        if (!admit(scope, "facts")) return null;
        write = readType(property.type, { kind: "intrinsic-member", symbol, access: "write" });
        if (write === null) return null;
        origins.push({ kind: "intrinsic", symbol, access: "write" });
      }
      members.push({ key: { kind: "text", value: property.name }, name: property.name, origins,
        declarations: [], getters: [], setters: [], optional: property.optional, readonly: property.readonly,
        read: available(read), write: available(write), readKind: "property" });
      continue;
    }
    const captured = capturedDeclaredMember(scope, property, primary);
    if (captured === null) return null;
    const { header, origin, setter } = captured;
    const use: BindingUse | null = receiver === null ? null
      : header.readKind === "method" ? { kind: "member", receiver, declarations: captured.declarations }
      : header.readKind === "property" && header.declarations.length === 1 &&
        directReceiverRecurrence(scope, receiver, property.type, primary) ? receiver : null;
    if (scope.meter.refusal !== null) return null;
    const step = (declaration: RawNodeRef, access: "read" | "write"): RawComponentStep =>
      scope.checked.ast.kindName(primary) === "KindPropertyAssignment"
        ? { kind: "source-member", occurrence: declaration, access } : { kind: "member", declaration, access };
    const primitive = use === null && header.readKind === "property" ? primitiveFieldSource(scope, property, primary, property.type) : null;
    if (scope.meter.refusal !== null) return null;
    const field = captureFieldSource(primitive, property.type);
    const read = readType(property.type, step(origin, "read"), use ?? field?.arm ?? null, field?.annotation ?? property.typeSource);
    if (read === null) return null;
    let write: RawTypeId | null = null;
    if (!property.readonly) {
      let type = property.type;
      let declaration = origin;
      if (setter !== undefined) {
        if (!admit(scope, "edges")) return null;
        const signature = scope.shape.getDeclarationSignatureInfo(setter);
        const parameter = signature?.parameters[0];
        if (signature === undefined || signature.parameters.length !== 1 || parameter === undefined)
          throw new TypeError("front: an accessor write requires its actual selected setter parameter type");
        type = parameter.type;
        declaration = header.setters[0] ?? throwInvariant(invariant("A selected setter retains its actual captured source declaration."));
      } else if (header.getters.length !== 0) throw new TypeError("front: a writable accessor requires its actual setter association");
      const sameType = setter === undefined && type === property.type;
      write = readType(type, step(declaration, "write"), sameType ? use ?? field?.arm ?? null : null,
        sameType ? field?.annotation ?? property.typeSource : undefined);
      if (write === null) return null;
    }
    members.push({ ...header, read: available(read), write: available(write) });
  }
  return members;
}

function admittedTypeUse(scope: CaptureScope, use: OriginalTypeUse): Node | undefined {
  if ("Kind" in use) return use;
  const ast = scope.checked.ast;
  const file = OpenedProgram.file(scope.program, use.module)?.file;
  const numbered = file === undefined ? undefined : OpenedProgram.syntax(scope.program).get(ast.getFileName(file))?.outcome;
  return numbered?.kind === "numbered" ? numbered.numbering.nodes[use.node] : undefined;
}

function forwardsReceiverArgument(scope: CaptureScope, receiver: Type, alias: CheckerSymbol, target: CheckerSymbol, argument: Type): boolean {
  if (!admit(scope, "edges") || receiver.alias?.symbol !== alias ||
    receiver.alias.typeArguments.length !== 1 || receiver.alias.typeArguments[0] !== argument) return false;
  const ast = scope.checked.ast;
  const declarations = scope.checker.getSymbolDeclarations(alias);
  const declaration = declarations[0];
  if (declarations.length !== 1 || declaration === undefined || ast.kindName(declaration) !== "KindTypeAliasDeclaration") return false;
  const parameters = ast.typeParameters(declaration);
  const parameter = parameters[0];
  const body = ast.typeNode(declaration);
  if (parameters.length !== 1 || parameter === undefined || body === undefined || ast.kindName(body) !== "KindTypeReference") return false;
  const reference = ast.as.AsTypeReferenceNode(body);
  const forwarded = reference?.TypeArguments?.Nodes[0];
  if (reference === undefined || reference.TypeArguments?.Nodes.length !== 1 || forwarded === undefined ||
    scope.checker.getSymbolAtLocation(reference.TypeName) !== target || ast.kindName(forwarded) !== "KindTypeReference") return false;
  const forwardedReference = ast.as.AsTypeReferenceNode(forwarded);
  const name = ast.name(parameter);
  if (name === undefined || forwardedReference === undefined || forwardedReference.TypeArguments !== undefined) return false;
  const binder = scope.checker.getSymbolAtLocation(name);
  return binder !== undefined && scope.checker.getSymbolAtLocation(forwardedReference.TypeName) === binder;
}

function unaryTypeReference(scope: CaptureScope, source: Node): { readonly name: Node; readonly argument: Node } | undefined {
  const ast = scope.checked.ast;
  if (ast.kindName(source) !== "KindTypeReference") return undefined;
  const reference = ast.as.AsTypeReferenceNode(source);
  const arguments_ = reference?.TypeArguments?.Nodes;
  const argument = arguments_?.length === 1 ? arguments_[0] : undefined;
  return argument === undefined || reference?.TypeName === undefined ? undefined : { name: reference.TypeName, argument };
}

function writtenApplication(scope: CaptureScope, source: Node | undefined):
  { readonly name: Node | null; readonly arguments: readonly (Node | undefined)[] } | null {
  const ast = scope.checked.ast;
  switch (ast.kindName(source)) {
    case "KindTypeReference": {
      const node = ast.as.AsTypeReferenceNode(source);
      return node?.TypeName === undefined ? null : { name: node.TypeName, arguments: node.TypeArguments?.Nodes ?? [] };
    }
    case "KindExpressionWithTypeArguments": {
      const node = ast.as.AsExpressionWithTypeArguments(source);
      return node?.Expression === undefined ? null : { name: node.Expression, arguments: node.TypeArguments?.Nodes ?? [] };
    }
    case "KindArrayType": {
      const element = ast.as.AsArrayTypeNode(source)?.ElementType;
      return element === undefined ? null : { name: null, arguments: [element] };
    }
    default: return null;
  }
}

function parameterReferenceName(scope: CaptureScope, source: Node): Node | undefined {
  const ast = scope.checked.ast;
  const reference = ast.kindName(source) === "KindTypeReference" ? ast.as.AsTypeReferenceNode(source) : undefined;
  return reference?.TypeArguments === undefined ? reference?.TypeName : undefined;
}

function receiverInput(scope: CaptureScope, source: Node): { readonly argument: Node; readonly binderName: Node; readonly name: Node | undefined } | undefined {
  const ast = scope.checked.ast;
  const reference = unaryTypeReference(scope, source);
  const argument = reference?.argument ?? (ast.kindName(source) === "KindArrayType" ? ast.as.AsArrayTypeNode(source)?.ElementType : undefined);
  const binderName = argument === undefined ? undefined : parameterReferenceName(scope, argument);
  return argument === undefined || binderName === undefined ? undefined : { argument, binderName, name: reference?.name };
}

function receiverSyntax(scope: CaptureScope, node: Node): { readonly args: readonly (Node | undefined)[]; readonly name: Node | undefined } | undefined {
  const unary = receiverInput(scope, node);
  if (unary !== undefined) return { args: [unary.argument], name: unary.name };
  const ast = scope.checked.ast;
  const reference = ast.kindName(node) === "KindTypeReference" ? ast.as.AsTypeReferenceNode(node) : undefined;
  const args = reference?.TypeArguments?.Nodes;
  return reference !== undefined && args !== undefined && args.length > 1 ? { args, name: reference.TypeName } : undefined;
}

function onlyReceiverSlot(receiver: ReceiverUse): ReceiverSlotUse | undefined {
  return receiver.slots.size === 1 ? receiver.slots.values().next().value : undefined;
}

function receiverSignatureSelector(receiver: ReceiverUse, sole: ReceiverSlotUse | undefined): { readonly binder: Node; readonly source: Node } {
  const binder = sole?.declaration ?? sole?.source ?? receiver.application;
  const source = sole?.composition?.syntax ?? (sole?.declaration === null ? receiver.application : binder);
  return { binder, source };
}

function unparenthesizedType(scope: CaptureScope, node: Node | undefined): Node | undefined {
  const ast = scope.checked.ast;
  while (node !== undefined && ast.kindName(node) === "KindParenthesizedType") {
    if (!admit(scope, "edges")) return undefined;
    node = ast.as.AsParenthesizedTypeNode(node)?.Type;
  }
  return node;
}

function writtenBracketedElement(scope: CaptureScope, source: Node): Node | undefined {
  const ast = scope.checked.ast;
  let array = unparenthesizedType(scope, source);
  if (array !== undefined && ast.kindName(array) === "KindTypeOperator" && ast.operatorKindName(array) === "KindReadonlyKeyword") {
    if (!admit(scope, "edges")) return undefined;
    array = ast.as.AsTypeOperatorNode(array)?.Type;
  }
  return array !== undefined && ast.kindName(array) === "KindArrayType"
    ? unparenthesizedType(scope, ast.as.AsArrayTypeNode(array)?.ElementType) : undefined;
}

function authoredTupleReceiver(scope: CaptureScope, type: Type, source: Node): ReceiverUse | null {
  const written = unparenthesizedType(scope, source);
  if (written === undefined) return null;
  const named = unaryTypeReference(scope, written);
  const element = named?.argument ?? writtenBracketedElement(scope, written);
  if (element === undefined || tupleSyntax(scope, element) === undefined || !admit(scope, "edges")) return null;
  const checked = sourceType(scope, { kind: "annotation", node: source });
  if (checked?.type !== type || checked.causes.length !== 0 || !admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(type);
  const symbol = target === undefined ? undefined : scope.checker.getTypeSymbol(target);
  if (target === undefined || symbol === undefined || named !== undefined && !bindsWrittenTypeTarget(scope, named.name, symbol)) return null;
  const slot = localTypeArgument(scope, type);
  if (slot === undefined || !scope.shape.isTuple(slot.argument) || !admit(scope, "edges")) return null;
  const selected = sourceType(scope, { kind: "annotation", node: element });
  if (selected?.type !== slot.argument || selected.causes.length !== 0 || !admit(scope, "facts")) return null;
  return { kind: "receiver", type, target: symbol, nativeTarget: target, application: source, forwardedAlias: null,
    slots: new Map([[slot.parameter, { parameter: slot.parameter, argument: slot.argument, source: element, declaration: null }]]) };
}

function restArraySyntax(scope: CaptureScope, array: Node): ComposedRestSyntax | DeclaredRestSyntax | undefined {
  const ast = scope.checked.ast;
  if (ast.kindName(array) !== "KindArrayType") return undefined;
  const formal = ast.parent(array);
  if (formal === undefined || ast.kindName(formal) !== "KindParameter") return undefined;
  const parameter = ast.as.AsParameterDeclaration(formal);
  const method = ast.parent(formal);
  const owner = method === undefined ? undefined : ast.parent(method);
  if (parameter?.Type !== array || parameter.DotDotDotToken === undefined || method === undefined ||
    ast.kindName(method) !== "KindMethodSignature" || owner === undefined || ast.kindName(owner) !== "KindInterfaceDeclaration") return undefined;
  const bracketed = ast.as.AsArrayTypeNode(array)?.ElementType;
  if (bracketed === undefined) return undefined;
  if (ast.kindName(bracketed) === "KindTypeReference") {
    const named = receiverInput(scope, bracketed);
    return named?.name === undefined ? undefined
      : { kind: "declared", array, owner, reference: bracketed, named: { ...named, name: named.name } };
  }
  if (ast.kindName(bracketed) !== "KindParenthesizedType") return undefined;
  const union = ast.as.AsParenthesizedTypeNode(bracketed)?.Type;
  if (union === undefined || ast.kindName(union) !== "KindUnionType") return undefined;
  const arms = ast.as.AsUnionTypeNode(union)?.Types?.Nodes;
  const first = arms?.[0];
  const second = arms?.[1];
  if (arms?.length !== 2 || first === undefined || second === undefined) return undefined;
  const [bare, reference] = parameterReferenceName(scope, first) === undefined ? [second, first] : [first, second];
  const bareName = parameterReferenceName(scope, bare);
  const named = receiverInput(scope, reference);
  return bareName === undefined || named?.name === undefined ? undefined
    : { kind: "composed", array, owner, union, bare, bareName, reference, named: { ...named, name: named.name } };
}

function otherUnionArm(scope: CaptureScope, union: Type, bare: Type): Type | undefined {
  if (!scope.shape.isUnion(union) || !admit(scope, "edges")) return undefined;
  const arms = scope.shape.getUnionOrIntersectionTypes(union);
  if (arms.length !== 2) return undefined;
  let matched = false;
  let other: Type | undefined;
  for (let index = 0; index < arms.length; index += 1) {
    if (!admit(scope, "edges")) return undefined;
    const arm = arms[index];
    if (arm === undefined) return undefined;
    if (arm === bare) {
      if (matched) return undefined;
      matched = true;
    } else {
      if (other !== undefined) return undefined;
      other = arm;
    }
  }
  return matched ? other : undefined;
}

function localTypeArgument(scope: CaptureScope, type: Type): TypeReferenceArgumentInfo | undefined {
  if (!scope.shape.isTypeReference(type) || !admit(scope, "edges")) return undefined;
  const inputs = scope.shape.getTypeReferenceArgumentInfos(type);
  const input = inputs?.[0];
  return inputs?.length === 1 && input?.scope === "local" ? input : undefined;
}

function composedUnionUse(scope: CaptureScope, syntax: ComposedRestSyntax, original: Type, selected: Type,
  receiver: ReceiverUse | null): ComposedUnionUse | null {
  if (!admit(scope, "edges")) return null;
  const authored = sourceType(scope, { kind: "annotation", node: syntax.union });
  if (authored?.type !== original || authored.causes.length !== 0 || !admit(scope, "edges")) return null;
  const ast = scope.checked.ast;
  const parameters = ast.typeParameters(syntax.owner);
  const declaration = parameters.length === 1 ? parameters[0] : undefined;
  const binder = declaration === undefined ? undefined : scope.checker.getSymbolAtLocation(ast.name(declaration));
  if (declaration === undefined || binder === undefined || scope.checker.getSymbolAtLocation(syntax.bareName) !== binder ||
    scope.checker.getSymbolAtLocation(syntax.named.binderName) !== binder || !admit(scope, "edges")) return null;
  const bare = sourceType(scope, { kind: "annotation", node: syntax.bare });
  const slot = receiver === null ? undefined : onlyReceiverSlot(receiver);
  if (bare === undefined || bare.causes.length !== 0 || scope.checker.getTypeSymbol(bare.type) !== binder ||
    receiver !== null && bare.type !== slot?.parameter || !admit(scope, "edges")) return null;
  const argument = sourceType(scope, { kind: "annotation", node: syntax.named.argument });
  if (argument?.type !== bare.type || argument.causes.length !== 0 || !admit(scope, "edges")) return null;
  const reference = sourceType(scope, { kind: "annotation", node: syntax.reference });
  if (reference === undefined || reference.causes.length !== 0 || !scope.shape.isTypeReference(reference.type) || !admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(reference.type);
  const symbol = target === undefined ? undefined : scope.checker.getTypeSymbol(target);
  const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
  const declared = declarations.length === 1 ? declarations[0] : undefined;
  if (symbol === undefined || scope.checker.getSymbolAtLocation(syntax.named.name) !== symbol ||
    declared === undefined || ast.kindName(declared) !== "KindInterfaceDeclaration") return null;
  const input = localTypeArgument(scope, reference.type);
  if (input?.argument !== bare.type || otherUnionArm(scope, original, bare.type) !== reference.type) return null;
  const selectedBare = slot?.argument ?? bare.type;
  const selectedReference = selected === original && selectedBare === bare.type ? reference.type : otherUnionArm(scope, selected, selectedBare);
  if (selectedReference === undefined || !scope.shape.isTypeReference(selectedReference) ||
    scope.shape.getTypeReferenceTarget(selectedReference) !== target) return null;
  const applied = selectedReference === reference.type ? input : localTypeArgument(scope, selectedReference);
  if (applied?.parameter !== input.parameter || applied.argument !== selectedBare || !admit(scope, "facts")) return null;
  const source = slot?.source ?? syntax.bare;
  return { kind: "composed-union", syntax: syntax.union, type: selected, bare: selectedBare, source, declaration: slot?.declaration ?? declaration,
    reference: selectedReference, argument: { kind: "declared-arguments", slots: new Map([[applied.parameter,
      { authored: syntax.named.argument, selected: receiver === null ? syntax.named.argument : source, argument: selectedBare }]]) } };
}

function declaredRestArgument(scope: CaptureScope, syntax: DeclaredRestSyntax, original: Type, selected: Type,
  receiver: ReceiverUse | null): DeclaredArgumentsUse | null {
  const bound = receiver === null ? undefined : onlyReceiverSlot(receiver);
  if (bound?.declaration !== null || original.alias !== undefined || selected.alias !== undefined ||
    !scope.shape.isTuple(bound.argument) || !admit(scope, "edges")) return null;
  const written = sourceType(scope, { kind: "annotation", node: syntax.reference });
  if (written?.type !== original || written.causes.length !== 0 || !admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(original);
  if (target === undefined || !admit(scope, "edges") || scope.shape.getTypeReferenceTarget(selected) !== target) return null;
  if (!admit(scope, "edges")) return null;
  const symbol = scope.checker.getTypeSymbol(target);
  if (symbol === undefined || scope.checker.getSymbolAtLocation(syntax.named.name) !== symbol) return null;
  const declarations = scope.checker.getSymbolDeclarations(symbol);
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  if (declaration === undefined || scope.checked.ast.kindName(declaration) !== "KindInterfaceDeclaration") return null;
  const input = localTypeArgument(scope, original);
  if (input?.argument !== bound.parameter) return null;
  const output = localTypeArgument(scope, selected);
  if (output?.parameter !== input.parameter || output.argument !== bound.argument || !admit(scope, "edges")) return null;
  const source = directBinderSource(scope, bound, syntax.named.argument, scope.checker.getSymbolAtLocation(syntax.named.binderName));
  return source === undefined || !admit(scope, "facts") ? null : { kind: "declared-arguments", slots: new Map([[output.parameter,
    { authored: syntax.named.argument, selected: source, argument: output.argument }]]) };
}

function restBindingUse(scope: CaptureScope, syntax: ComposedRestSyntax | DeclaredRestSyntax, original: Type, selected: Type,
  receiver: ReceiverUse | null): ReceiverUse | DeclaredRestUse | null {
  if (syntax.kind === "declared" && (original.alias !== undefined || selected.alias !== undefined)) return null;
  const input = localTypeArgument(scope, original);
  if (input === undefined || !scope.shape.isTypeReference(selected) || !admit(scope, "edges")) return null;
  const authored = sourceType(scope, { kind: "annotation", node: syntax.array });
  if (authored?.type !== original || authored.causes.length !== 0) return null;
  const target = scope.shape.getTypeReferenceTarget(original);
  if (target === undefined || syntax.kind === "declared" && !admit(scope, "edges") || scope.shape.getTypeReferenceTarget(selected) !== target) return null;
  const output = original === selected ? input : localTypeArgument(scope, selected);
  if (output?.parameter !== input.parameter) return null;
  if (syntax.kind === "declared") {
    const argument = declaredRestArgument(scope, syntax, input.argument, output.argument, receiver);
    return argument === null || !admit(scope, "facts") ? null
      : { kind: "declared-rest", type: selected, nativeTarget: target, slot: output, element: syntax.reference, argument };
  }
  const symbol = scope.checker.getTypeSymbol(target);
  if (symbol === undefined) return null;
  const composition = composedUnionUse(scope, syntax, input.argument, output.argument, receiver);
  if (composition === null || !admit(scope, "facts")) return null;
  return { kind: "receiver", type: selected, target: symbol, nativeTarget: target, application: syntax.array, forwardedAlias: null,
    slots: new Map([[output.parameter, { source: composition.source, declaration: composition.declaration,
      parameter: output.parameter, argument: output.argument, composition }]]) };
}

function authoredComposedUnion(scope: CaptureScope, type: Type, use: OriginalTypeUse): ComposedUnionUse | null {
  const ast = scope.checked.ast;
  const source = admittedTypeUse(scope, use);
  if (source === undefined) return null;
  const parent = ast.kindName(source) === "KindUnionType" ? ast.parent(source) : source;
  const array = parent === undefined ? undefined : ast.parent(parent);
  const syntax = array === undefined ? undefined : restArraySyntax(scope, array);
  return syntax?.kind === "composed" && ast.as.AsArrayTypeNode(syntax.array)?.ElementType === parent
    && (syntax.union === source || parent === source) ? composedUnionUse(scope, syntax, type, type, null) : null;
}
function tupleSyntax(scope: CaptureScope, source: Node): { readonly elements: readonly (Node | undefined)[]; readonly readonly: boolean } | undefined {
  const ast = scope.checked.ast;
  const written = unparenthesizedType(scope, source);
  const readonlyOperator = (node: Node | undefined): boolean =>
    node !== undefined && ast.kindName(node) === "KindTypeOperator" && ast.operatorKindName(node) === "KindReadonlyKeyword";
  const tuple = readonlyOperator(written) ? ast.as.AsTypeOperatorNode(written)?.Type : written;
  if (tuple === undefined || ast.kindName(tuple) !== "KindTupleType") return undefined;
  const elements = ast.as.AsTupleTypeNode(tuple)?.Elements?.Nodes;
  return elements === undefined ? undefined : { elements, readonly: readonlyOperator(ast.parent(tuple)) };
}

function tupleReference(scope: CaptureScope, source: Node): { readonly name: Node; readonly argument: Node } | undefined {
  const syntax = unaryTypeReference(scope, source);
  return syntax === undefined || tupleSyntax(scope, syntax.argument) === undefined ? undefined : syntax;
}

function receiverBindingUse(scope: CaptureScope, type: Type, use: OriginalTypeUse | null): ReceiverUse | null {
  if (use === null) return null;
  const source = admittedTypeUse(scope, use);
  if (source === undefined) return throwInvariant(invariant("An authored type occurrence must retain its actual numbered checker node."));
  const syntax = receiverSyntax(scope, source);
  if (syntax === undefined) {
    const rest = restArraySyntax(scope, source);
    const composed = rest?.kind === "composed" ? restBindingUse(scope, rest, type, type, null) : null;
    return rest?.kind !== "composed" ? authoredTupleReceiver(scope, type, source) : composed?.kind === "receiver" ? composed : null;
  }
  if (!admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(type);
  if (target === undefined) return null;
  const targetSymbol = scope.checker.getTypeSymbol(target);
  if (targetSymbol === undefined) return null;
  const infos = scope.shape.getTypeReferenceArgumentInfos(type);
  const input = infos?.[0];
  if (infos === undefined || infos.length !== syntax.args.length) return null;
  if ("Kind" in use) {
    const answer = sourceType(scope, { kind: "annotation", node: source });
    if (answer?.type !== type || answer.causes.length !== 0) return null;
  }
  let forwardedAlias: CheckerSymbol | null = null;
  if (syntax.name !== undefined) {
    const selected = scope.checker.getSymbolAtLocation(syntax.name);
    if (selected === undefined) return null;
    if (selected !== targetSymbol) {
      if (infos.length !== 1 || input?.scope !== "local" ||
        !forwardsReceiverArgument(scope, type, selected, targetSymbol, input.argument)) return null;
      forwardedAlias = selected;
    }
  }
  const slots = new Map<Type, ReceiverSlotUse>();
  for (let index = 0; index < infos.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const selected = infos[index];
    const written = syntax.args[index];
    if (selected?.scope !== "local" || written === undefined || parameterReferenceName(scope, written) === undefined) return null;
    const answer = sourceType(scope, { kind: "annotation", node: written });
    if (answer?.type !== selected.argument || answer.causes.length !== 0) return null;
    const symbol = scope.checker.getTypeSymbol(selected.argument);
    const declarations = scope.checker.getSymbolDeclarations(symbol);
    if (symbol === undefined || declarations.length <= 1) return null;
    const declaration = selectMergedParameter(scope, symbol, declarations, written);
    if (declaration === undefined || slots.has(selected.parameter)) return null;
    slots.set(selected.parameter, { parameter: selected.parameter, argument: selected.argument, source: written, declaration });
  }
  return { kind: "receiver", type, target: targetSymbol, nativeTarget: target, application: source, forwardedAlias, slots };
}

function directReceiverSource(scope: CaptureScope, receiver: ReceiverUse, typeNode: Node): Type | undefined {
  const syntax = receiverSyntax(scope, typeNode);
  if (syntax === undefined || !admit(scope, "edges") ||
    (syntax.name !== undefined && scope.checker.getSymbolAtLocation(syntax.name) !== receiver.target)) return undefined;
  const original = sourceType(scope, { kind: "annotation", node: typeNode });
  if (original === undefined || original.causes.length !== 0 || scope.shape.getTypeReferenceTarget(original.type) !== receiver.nativeTarget) return undefined;
  const inputs = scope.shape.getTypeReferenceArgumentInfos(original.type);
  if (inputs === undefined || inputs.length !== receiver.slots.size || syntax.args.length !== inputs.length) return undefined;
  for (let index = 0; index < inputs.length; index += 1) {
    if (!admit(scope, "edges")) return undefined;
    const input = inputs[index];
    const node = syntax.args[index];
    if (input?.scope !== "local" || node === undefined || !receiver.slots.has(input.parameter)
      || input.argument !== input.parameter) return undefined;
    const name = parameterReferenceName(scope, node);
    const symbol = scope.checker.getTypeSymbol(input.parameter);
    if (name === undefined || symbol === undefined || scope.checker.getSymbolAtLocation(name) !== symbol) return undefined;
    const argument = sourceType(scope, { kind: "annotation", node });
    if (argument?.type !== input.parameter || argument.causes.length !== 0) return undefined;
  }
  return original.type;
}

function directReceiverRecurrence(scope: CaptureScope, receiver: ReceiverUse, selected: Type, declaration: Node): boolean {
  if (selected !== receiver.type || !admit(scope, "edges")) return false;
  const ast = scope.checked.ast;
  if (ast.kindName(declaration) !== "KindPropertySignature") return false;
  const owner = ast.parent(declaration);
  if (owner === undefined || ast.kindName(owner) !== "KindInterfaceDeclaration" ||
    scope.checker.getSymbolAtLocation(ast.name(owner)) !== receiver.target) return false;
  const typeNode = ast.typeNode(declaration);
  return typeNode !== undefined && directReceiverSource(scope, receiver, typeNode) !== undefined;
}

function writtenForwardedOperand(scope: CaptureScope, type: Type, syntax: Node | undefined, role: "binder" | "union"): Node | undefined {
  const ast = scope.checked.ast;
  let current = syntax;
  while (current !== undefined) {
    const kind = ast.kindName(current);
    if (kind === "KindThisType" && role === "binder" || kind === "KindUnionType" && role === "union") return current;
    if (kind !== "KindTypeReference") return undefined;
    const reference = ast.as.AsTypeReferenceNode(current);
    if (reference?.TypeName === undefined) return undefined;
    const arguments_ = reference.TypeArguments?.Nodes;
    if (arguments_ === undefined) return role === "binder" ? current : undefined;
    if (scope.shape.isTypeReference(type) || role === "binder" && scope.checker.getTypeSymbol(type) === undefined || arguments_.length === 0 ||
      !admit(scope, "edges")) return undefined;
    const written = scope.checker.getSymbolAtLocation(reference.TypeName);
    if (written === undefined) return undefined;
    const alias = scope.checker.getAliasStep(written)?.kind === "symbol" ? scope.checker.getAliasedSymbol(written) : written;
    if (alias === undefined || !admit(scope, "edges")) return undefined;
    const declarations = scope.checker.getSymbolDeclarations(alias);
    const declaration = declarations[0];
    if (declarations.length !== 1 || ast.kindName(declaration) !== "KindTypeAliasDeclaration") return undefined;
    const result = ast.typeNode(declaration);
    const parameterName = result === undefined ? undefined : parameterReferenceName(scope, result);
    if (parameterName === undefined || !admit(scope, "edges")) return undefined;
    const selected = scope.checker.getSymbolAtLocation(parameterName);
    if (selected === undefined) return undefined;
    const parameters = ast.typeParameters(declaration);
    let argument: Node | undefined;
    for (let index = 0; index < parameters.length; ++index) {
      if (!admit(scope, "edges")) return undefined;
      const parameter = parameters[index];
      if (parameter === undefined) return throwInvariant(invariant("A written alias must retain its actual parameter inventory."));
      if (scope.checker.getSymbolAtLocation(ast.name(parameter)) === selected) {
        if (!admit(scope, "edges")) return undefined;
        argument = arguments_[index];
        break;
      }
    }
    if (argument === undefined) return undefined;
    const checked = sourceType(scope, { kind: "annotation", node: current });
    if (checked?.type !== type || checked.causes.length !== 0) return undefined;
    current = argument;
  }
  return undefined;
}

function authoredSelfOwner(scope: CaptureScope, type: Type, syntax: Node): Node | undefined {
  const ast = scope.checked.ast;
  let annotation = syntax;
  let parent = ast.parent(annotation);
  while (parent !== undefined && ast.kindName(parent) !== "KindMethodSignature") {
    if (!admit(scope, "edges")) return undefined;
    const kind = ast.kindName(parent);
    if (kind === "KindParameter" ? ast.typeNode(parent) !== annotation : !typeNodeKinds.includes(kind.replace(/^Kind/u, "")))
      return undefined;
    annotation = parent;
    parent = ast.parent(annotation);
  }
  if (parent === undefined || ast.typeNode(parent) !== annotation && ast.kindName(annotation) !== "KindParameter") return undefined;
  const owner = ast.parent(parent);
  if (owner === undefined || ast.kindName(owner) !== "KindInterfaceDeclaration") return undefined;
  const symbol = scope.checker.getSymbolAtLocation(ast.name(owner));
  return symbol !== undefined && scope.checker.getTypeSymbol(type) === symbol ? owner : undefined;
}

function projectedReceiver(scope: CaptureScope, use: ReceiverProjectionUse, type: Type): ReceiverUse | DeclaredArgumentsUse | null {
  if (use.source.kind === "tuple-array-result")
    return projectedTupleReceiver(scope, use.receiver, use.syntax, use.source.signature, use.source.element, type);
  if (type !== use.receiver.type) return use.source.kind === "result"
    ? projectedDeclaredArgument(scope, use, type, use.source.signature) : null;
  if (scope.checked.ast.kindName(use.syntax) === "KindThisType") {
    if (use.source.kind !== "result" || !admit(scope, "edges")) return null;
    const original = sourceType(scope, { kind: "signature-return", signature: use.source.signature })?.type;
    if (original === undefined || original === type || !admit(scope, "edges")) return null;
    const authored = sourceType(scope, { kind: "annotation", node: use.syntax });
    return authored?.type === original && authored.causes.length === 0 && authoredSelfOwner(scope, original, use.syntax) !== undefined
      && scope.checker.getTypeSymbol(original) === use.receiver.target ? use.receiver : null;
  }
  const original = directReceiverSource(scope, use.receiver, use.syntax);
  if (original === undefined) return null;
  const source = use.source.kind === "formal" ? use.source.type
    : admit(scope, "edges") ? sourceType(scope, { kind: "signature-return", signature: use.source.signature })?.type : undefined;
  return source === original ? use.receiver : null;
}

function projectedTupleReceiver(scope: CaptureScope, receiver: ReceiverUse, syntax: Node, signature: Signature, element: Node,
  type: Type): ReceiverUse | null {
  const slot = onlyReceiverSlot(receiver);
  if (slot?.declaration !== null || !admit(scope, "edges")) return null;
  const original = sourceType(scope, { kind: "signature-return", signature });
  if (original === undefined || original.causes.length !== 0 || !admit(scope, "edges")) return null;
  const written = sourceType(scope, { kind: "annotation", node: syntax });
  if (written?.type !== original.type || written.causes.length !== 0 || !admit(scope, "edges")) return null;
  const input = localTypeArgument(scope, original.type);
  if (input?.argument !== slot.parameter || !admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(original.type);
  if (target === undefined || scope.shape.getTypeReferenceTarget(type) !== target) return null;
  const output = localTypeArgument(scope, type);
  if (output?.parameter !== input.parameter || output.argument !== slot.argument || !admit(scope, "edges")) return null;
  const name = parameterReferenceName(scope, element);
  const binder = name === undefined ? undefined : scope.checker.getTypeSymbol(slot.parameter);
  if (binder === undefined || scope.checker.getSymbolAtLocation(name) !== binder) return null;
  const selected = sourceType(scope, { kind: "annotation", node: element });
  if (scope.meter.refusal !== null) return null;
  const symbol = scope.checker.getTypeSymbol(target);
  if (selected?.type !== slot.parameter || selected.causes.length !== 0 || symbol === undefined || !admit(scope, "facts")) return null;
  return { kind: "receiver", type, target: symbol, nativeTarget: target, application: syntax, forwardedAlias: null,
    slots: new Map([[output.parameter, { ...slot, parameter: output.parameter }]]) };
}

function projectedDeclaredArgument(scope: CaptureScope, use: ReceiverProjectionUse, type: Type, signature: Signature): DeclaredArgumentsUse | null {
  const syntax = unaryTypeReference(scope, use.syntax);
  if (syntax === undefined || !admit(scope, "edges")) return null;
  const receiver = use.receiver;
  const slot = onlyReceiverSlot(receiver);
  if (slot === undefined) return null;
  const target = scope.shape.getTypeReferenceTarget(type);
  if (target === undefined) return null;
  const symbol = scope.checker.getTypeSymbol(target);
  if (symbol === undefined || symbol === receiver.target || scope.checker.getSymbolAtLocation(syntax.name) !== symbol) return null;
  const binderName = parameterReferenceName(scope, syntax.argument);
  if (binderName !== undefined) {
    const binder = scope.checker.getTypeSymbol(slot.parameter);
    if (binder === undefined || scope.checker.getSymbolAtLocation(binderName) !== binder) return null;
  } else if (tupleSyntax(scope, syntax.argument) === undefined) return null;
  const selected = scope.shape.getTypeReferenceArgumentInfos(type);
  const applied = selected?.[0];
  if (selected?.length !== 1 || applied?.scope !== "local" ||
    (binderName === undefined ? !scope.shape.isTuple(applied.argument) : applied.argument !== slot.argument) || !admit(scope, "edges")) return null;
  const answer = sourceType(scope, { kind: "signature-return", signature });
  if (answer === undefined || answer.causes.length !== 0 || scope.shape.getTypeReferenceTarget(answer.type) !== target || !admit(scope, "edges")) return null;
  const original = answer.type;
  const annotation = sourceType(scope, { kind: "annotation", node: use.syntax });
  if (annotation?.type !== original || annotation.causes.length !== 0) return null;
  const inputs = scope.shape.getTypeReferenceArgumentInfos(original);
  const input = inputs?.[0];
  if (inputs?.length !== 1 || input?.scope !== "local" || input.parameter !== applied.parameter ||
    (binderName === undefined ? !scope.shape.isTuple(input.argument) : input.argument !== slot.parameter) || !admit(scope, "edges")) return null;
  const authored = sourceType(scope, { kind: "annotation", node: syntax.argument });
  if (authored?.type !== input.argument || authored.causes.length !== 0) return null;
  const selectedUse: Node | TupleProjectionUse = binderName === undefined
    ? { kind: "tuple-projection", syntax: syntax.argument, original: input.argument, receiver } : slot.source;
  return { kind: "declared-arguments",
    slots: new Map([[applied.parameter, { authored: syntax.argument, selected: selectedUse, argument: applied.argument }]]) };
}

function authoredTupleArgument(scope: CaptureScope, type: Type, originalUse: OriginalTypeUse,
  argument: Type, ordinal: number): { readonly authored: Node; readonly selected: Node } | null {
  const source = admittedTypeUse(scope, originalUse);
  const ast = scope.checked.ast;
  const reference = ast.kindName(source) === "KindTypeReference" ? ast.as.AsTypeReferenceNode(source) : undefined;
  const written = reference?.TypeArguments?.Nodes;
  if (source === undefined || reference?.TypeName === undefined || written === undefined || ordinal >= written.length
    || !admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(type);
  const symbol = target === undefined ? undefined : scope.checker.getTypeSymbol(target);
  if (symbol === undefined || scope.checker.getSymbolAtLocation(reference.TypeName) !== symbol) return null;
  if ("Kind" in originalUse) {
    if (!admit(scope, "edges")) return null;
    const annotation = sourceType(scope, { kind: "annotation", node: source });
    if (annotation?.type !== type || annotation.causes.length !== 0) return null;
  }
  if (!admit(scope, "edges")) return null;
  const node = written[ordinal];
  if (node === undefined || tupleSyntax(scope, node) === undefined) return null;
  const authored = sourceType(scope, { kind: "annotation", node });
  return authored?.type === argument && authored.causes.length === 0 ? { authored: node, selected: node } : null;
}

function tupleAnnotationOf(scope: CaptureScope, type: Type, annotation: Node | undefined): Node | undefined {
  const ast = scope.checked.ast;
  if (annotation === undefined || !admit(scope, "edges")) return undefined;
  const checked = sourceType(scope, { kind: "annotation", node: annotation });
  if (checked?.type !== type || checked.causes.length !== 0) return undefined;
  if (tupleSyntax(scope, annotation) !== undefined) return annotation;
  const name = parameterReferenceName(scope, annotation);
  const alias = type.alias?.symbol;
  if (name === undefined || alias === undefined || !admit(scope, "edges")) return undefined;
  const selected = scope.checker.getSymbolAtLocation(name);
  if (selected === undefined) return undefined;
  if (selected !== alias) {
    if (!admit(scope, "edges")) return undefined;
    const target = scope.checker.getAliasStep(selected);
    if (target?.kind !== "symbol" || target.symbol !== alias) return undefined;
  }
  let declaration: Node | undefined;
  for (const candidate of scope.checker.getSymbolDeclarations(alias)) {
    if (!admit(scope, "edges")) return undefined;
    if (candidate === undefined || ast.kindName(candidate) !== "KindTypeAliasDeclaration") continue;
    if (declaration !== undefined) return undefined;
    declaration = candidate;
  }
  if (declaration === undefined || ast.typeParameters(declaration).length !== 0) return undefined;
  const result = ast.typeNode(declaration);
  if (result === undefined || tupleSyntax(scope, result) === undefined || !admit(scope, "edges")) return undefined;
  const definition = sourceType(scope, { kind: "annotation", node: result });
  return definition?.type === type && definition.causes.length === 0 ? result : undefined;
}

function captureTuple(scope: CaptureScope, type: Type, position: RawComponentId,
  originalUse: OriginalTypeUse | null, binding: TupleProjectionUse | ContextualTupleUse | LiteralTupleUse | null,
  projection: ProjectedOperandUse | null): RawTypeForm | null {
  const parent = scope.tables.components[position];
  if (parent === undefined) return throwInvariant(invariant("A tuple type requires its actual captured component."));
  const nativeProjection = projection?.role === "indexed-tuple-object" || projection?.role === "declared-tuple-argument"
    || projection?.role === "receiver-tuple-result" || projection?.role === "tuple-element";
  const prefix = parent.path?.prefix;
  if (nativeProjection && (projection.type !== type || originalUse !== null || binding !== null
    || (projection.role === "receiver-tuple-result" ? parent.path?.step.kind !== "result" || prefix !== null
      : projection.role === "indexed-tuple-object" ? parent.path?.step.kind !== "projection-source"
      : projection.role === "tuple-element" ? parent.root !== projection.parent.root
        || prefix !== (projection.parent.path === null ? null : projection.parent.id)
        || parent.path?.step.kind !== "tuple-element" || parent.path.step.index !== projection.ordinal
      : parent.path?.step.kind !== "argument-place" || prefix === null || prefix === undefined ||
        scope.tables.components[prefix]?.path?.step.kind !== "result")))
    return throwInvariant(invariant("A projected source must retain its exact native tuple and component."));
  const ast = scope.checked.ast;
  let literalSlots: readonly (Node | undefined)[] | undefined;
  if (binding?.kind === "literal-tuple") {
    if (!admit(scope, "edges")) return null;
    literalSlots = ast.as.AsArrayLiteralExpression(binding.expression)?.Elements?.Nodes;
    if (literalSlots === undefined || binding.original !== type || originalUse !== null)
      return throwInvariant(invariant("An executing tuple literal requires its actual checked expression and native result."));
  }
  let source = binding?.kind === "literal-tuple" ? undefined
    : binding?.syntax ?? (originalUse === null ? undefined : admittedTypeUse(scope, originalUse));
  let syntax = source === undefined ? undefined : tupleSyntax(scope, source);
  if (scope.meter.refusal !== null) return null;
  if (!nativeProjection && syntax === undefined && binding === null) {
    if (source === undefined && parent.path === null) {
      const occurrence = admittedTypeUse(scope, parent.root);
      if (occurrence !== undefined && scope.checked.ast.kindName(occurrence) === "KindVariableDeclaration")
        source = scope.checked.ast.typeNode(occurrence);
    }
    source = tupleAnnotationOf(scope, type, source);
    if (scope.meter.refusal !== null) return null;
    syntax = source === undefined ? undefined : tupleSyntax(scope, source);
    if (scope.meter.refusal !== null) return null;
  }
  const inferredPattern = !nativeProjection && syntax === undefined && literalSlots === undefined;
  if (inferredPattern) {
    const occurrence = originalUse === null && binding === null && parent.path === null
      ? admittedTypeUse(scope, parent.root) : undefined;
    if (scope.meter.refusal !== null) return null;
    const declaration = ast.kindName(occurrence) === "KindVariableDeclaration" ? occurrence : ast.parent(occurrence);
    const variable = ast.kindName(declaration) === "KindVariableDeclaration" ? ast.as.AsVariableDeclaration(declaration) : undefined;
    if (variable === undefined || variable.Type !== undefined || ast.kindName(variable.name) !== "KindArrayBindingPattern"
      || variable.Initializer === undefined
      || declaration !== occurrence && variable.Initializer !== occurrence)
      throw new TypeError("front: a tuple requires its actual authored, projected or inferred destructuring association");
  }
  const original = binding?.original ?? type;
  if (!admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(original);
  if (target === undefined || scope.shape.getTypeReferenceTarget(type) !== target)
    throw new TypeError("front: a tuple requires its actual unchanged native slot inventory");
  const originalTuple = scope.shape.getTupleInfo(original);
  if (original !== type && !admit(scope, "edges")) return null;
  const selectedTuple = original === type ? originalTuple : scope.shape.getTupleInfo(type);
  if (originalTuple === undefined || selectedTuple === undefined || selectedTuple.readonly !== originalTuple.readonly)
    throw new TypeError("front: a tuple requires its actual native target and ordered slot information");
  const { elements: originalSlots } = originalTuple;
  const { elements: selected } = selectedTuple;
  if (originalSlots.length !== selected.length || literalSlots !== undefined && literalSlots.length !== selected.length || syntax !== undefined &&
    (originalSlots.length !== syntax.elements.length || syntax.readonly !== originalTuple.readonly))
    throw new TypeError("front: a tuple requires its actual unflattened authored slots");
  const projectedTuple = binding?.kind === "tuple-projection" && onlyReceiverSlot(binding.receiver)?.declaration === null;
  const elements: RawParameter[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const before = originalSlots[index];
    const slot = selected[index];
    const annotation = syntax?.elements[index];
    const role = ast.kindName(annotation);
    if (before === undefined || slot === undefined ||
      before.elementKind === "rest" || slot.elementKind !== before.elementKind ||
      before.declaration !== undefined || slot.declaration !== undefined ||
      (slot.elementKind === "variadic" ? role !== "KindRestType"
        : syntax !== undefined && (annotation === undefined || role === "KindRestType" ||
          (role === "KindOptionalType") !== (slot.elementKind === "optional"))))
      throw new TypeError("front: a tuple slot requires its actual ordered unlabelled association");
    const operand = slot.elementKind === "variadic" ? ast.as.AsRestTypeNode(annotation)?.Type : annotation;
    if (slot.elementKind === "variadic" && operand === undefined)
      throw new TypeError("front: a generic tuple spread requires its actual authored sequence operand");
    if (operand !== undefined) {
      const authored = sourceType(scope, { kind: "annotation", node: operand });
      if (scope.meter.refusal !== null) return null;
      if (authored?.type !== before.type || authored.causes.length !== 0)
        throw new TypeError("front: a tuple slot requires its actual authored checker type");
    }
    let sourceUse: Node | null = operand ?? null;
    let nestedLiteral: LiteralTupleUse | null = null;
    if (literalSlots !== undefined) {
      const element = literalSlots[index];
      const elementKind = ast.kindName(element);
      if (element === undefined || slot.elementKind !== "required" ||
        elementKind === "KindSpreadElement" || elementKind === "KindOmittedExpression")
        throw new TypeError("front: a finite tuple literal requires the actual written value at each required slot");
      const checked = sourceType(scope, { kind: "expression", node: element });
      if (scope.meter.refusal !== null) return null;
      if (checked === undefined || checked.causes.length !== 0)
        throw new TypeError("front: a tuple literal slot must retain its actual checked value type");
      if (checked.type !== slot.type) {
        if (!admit(scope, "edges")) return null;
        if (scope.shape.getBaseTypeOfLiteralType(checked.type) !== slot.type)
          throw new TypeError("front: a tuple literal slot must retain its actual checked value type or exact native literal base");
      }
      const nested = scope.shape.isTuple(slot.type) ? tupleLiteralExpression(scope, element) : undefined;
      if (scope.meter.refusal !== null) return null;
      if (nested === undefined) sourceUse = element;
      else {
        nestedLiteral = retainTupleLiteral(scope, element, nested, slot.type);
        if (nestedLiteral === null) return null;
      }
    }
    if (binding?.kind === "contextual-tuple" && slot.type !== before.type)
      throw new TypeError("front: a contextual tuple requires its actual unchanged annotation slot types");
    if (binding?.kind === "tuple-projection") {
      const receiver = binding.receiver;
      const bound = receiver.slots.get(before.type);
      if (bound !== undefined && (!projectedTuple || slot.type !== before.type)) {
        if (!admit(scope, "edges")) return null;
        const name = annotation === undefined ? undefined : parameterReferenceName(scope, annotation);
        const symbol = scope.checker.getTypeSymbol(bound.parameter);
        if (name === undefined || symbol === undefined || scope.checker.getSymbolAtLocation(name) !== symbol || slot.type !== bound.argument)
          throw new TypeError("front: a projected tuple slot requires its actual authored binder");
        sourceUse = bound.source;
      } else if (slot.type !== before.type || !projectedTuple && scope.shape.couldContainTypeVariables(before.type))
        throw new TypeError("front: a projected tuple slot requires its actual selected type association");
    }
    const qualified = slot.elementKind !== "variadic" || sourceUse === null ? sourceUse : referenceTo(scope, scope.program, sourceUse);
    if (scope.meter.refusal !== null) return null;
    if (slot.elementKind === "variadic" && qualified === null)
      return throwInvariant(invariant("A variadic slot must retain its actual numbered operand."));
    const componentId = appendComponent(scope, parent, { kind: "tuple-element", index });
    if (componentId === null) return null;
    let nestedUse: LiteralTupleUse | ProjectedOperandUse | null = nestedLiteral;
    if (nestedUse === null && qualified === null && (nativeProjection || inferredPattern) && scope.shape.isTuple(slot.type)) {
      if (!admit(scope, "facts")) return null;
      nestedUse = { kind: "projected-operand", role: "tuple-element", type: slot.type, parent, ordinal: index };
    }
    const captured = rawType(scope, () => withoutTypeCause(slot.type), componentId, qualified, nestedUse);
    if (captured === null) return null;
    elements.push({ declaration: null, symbol: null, kind: slot.elementKind, component: componentId, type: captured,
      acceptsOmission: slot.elementKind === "optional", initializer: null, passing: notProvided() });
  }
  return { kind: "tuple", readonly: selectedTuple.readonly, elements };
}

function undefinedUnionArms(scope: CaptureScope, type: Type, reference?: Type):
  { readonly value: Type; readonly valueIndex: number; readonly absent: Type } | undefined {
  if (!scope.shape.isUnion(type)) return undefined;
  const arms = scope.shape.getUnionOrIntersectionTypes(type);
  if (arms.length !== (reference === undefined ? 2 : 3)) return undefined;
  let value: Type | undefined;
  let valueIndex = -1;
  let absent: Type | undefined;
  let matchedReference = reference === undefined;
  for (let index = 0; index < arms.length; index += 1) {
    if (!admit(scope, "edges")) return undefined;
    const arm = arms[index];
    if (arm === undefined) return undefined;
    if (scope.shape.isNullish(arm)) {
      const flags = scope.shape.intrinsicNullishFlags(arm);
      if (!flags.undefined || flags.null || absent !== undefined) return undefined;
      absent = arm;
    } else if (arm === reference) {
      if (matchedReference) return undefined;
      matchedReference = true;
    } else {
      if (value !== undefined) return undefined;
      value = arm;
      valueIndex = index;
    }
  }
  return value === undefined || absent === undefined || !matchedReference ? undefined : { value, valueIndex, absent };
}

function authoredCompoundArms(scope: CaptureScope, type: Type, syntax: Node, role: "direct" | "optional" | "rest",
  readNative: () => readonly (Type | undefined)[]): AuthoredFormalArms | null {
  const ast = scope.checked.ast;
  const kind = ast.kindName(syntax);
  if (kind !== "KindUnionType" && kind !== "KindIntersectionType" ||
    kind === "KindUnionType" && !scope.shape.isUnion(type) ||
    kind === "KindIntersectionType" && (role !== "direct" || !scope.shape.isIntersection(type)) ||
    !admit(scope, "edges")) return null;
  const written = (kind === "KindUnionType" ? ast.as.AsUnionTypeNode(syntax) : ast.as.AsIntersectionTypeNode(syntax))?.Types?.Nodes;
  const native = readNative();
  if (written === undefined || written.length < 2 || native.length < written.length
    || native.length > written.length + Number(role === "optional")) return null;
  const unassigned = new Set<Type>();
  for (let index = 0; index < native.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const arm = native[index];
    if (arm === undefined || unassigned.has(arm) || scope.shape.isError(arm)) return null;
    unassigned.add(arm);
  }
  const sources = new Map<Type, Node>();
  for (let index = 0; index < written.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const arm = written[index];
    if (arm === undefined || role === "rest" && tupleSyntax(scope, arm) === undefined) return null;
    const answer = sourceType(scope, { kind: "annotation", node: arm });
    if (answer === undefined || answer.causes.length !== 0 || !unassigned.delete(answer.type)) return null;
    sources.set(answer.type, arm);
  }
  const remainder = unassigned.values().next().value;
  if (remainder !== undefined) {
    if (!admit(scope, "edges")) return null;
    const flags = scope.shape.intrinsicNullishFlags(remainder);
    if (!flags.undefined || flags.null) return null;
  }
  return admit(scope, "facts") ? { kind: "authored-formal-arms", sources } : null;
}

function authoredFormalAnnotation(scope: CaptureScope, task: Extract<CaptureTask, { readonly kind: "type" }>, type: Type): AuthoredFormalArms | null {
  const use = task.originalUse;
  const position = scope.tables.components[task.position];
  if (use === null || !("module" in use) || position?.path !== null || !sameSource(use, position.root)) return null;
  const ast = scope.checked.ast;
  const syntax = admittedTypeUse(scope, use);
  if (syntax === undefined || ast.kindName(syntax) !== "KindUnionType") return null;
  const declaration = ast.parent(syntax);
  if (declaration === undefined || ast.kindName(declaration) !== "KindParameter") return null;
  const parameter = ast.as.AsParameterDeclaration(declaration);
  const owner = ast.parent(declaration);
  if (owner === undefined || parameter?.Type !== syntax || parameter.Initializer !== undefined) return null;
  const role = parameter.QuestionToken !== undefined && parameter.DotDotDotToken === undefined ? "optional"
    : parameter.QuestionToken === undefined && parameter.DotDotDotToken !== undefined ? "rest" : null;
  if (role === null || !admit(scope, "edges")) return null;
  const signature = scope.checker.getSignatureFromDeclaration(owner);
  if (signature === undefined || signature.target !== undefined || signature.mapper !== undefined || signature.composite !== undefined ||
    scope.checker.getSignatureDeclaration(signature) !== owner || !admit(scope, "edges")) return null;
  const answer = sourceType(scope, { kind: "annotation", node: syntax });
  return answer?.type === type && answer.causes.length === 0
    ? authoredCompoundArms(scope, type, syntax, role, () => scope.shape.getUnionOrIntersectionTypes(type)) : null;
}

function undefinedUnionSyntax(scope: CaptureScope, node: Node): UndefinedUnionSyntax | undefined {
  const ast = scope.checked.ast;
  if (ast.kindName(node) !== "KindUnionType") return undefined;
  const arms = ast.as.AsUnionTypeNode(node)?.Types?.Nodes;
  if (arms?.length !== 2) return undefined;
  const first = arms[0];
  const second = arms[1];
  if (first === undefined || second === undefined) return undefined;
  const [absent, parameter] = ast.kindName(first) === "KindUndefinedKeyword" ? [first, second] : [second, first];
  if (ast.kindName(absent) !== "KindUndefinedKeyword" || ast.kindName(parameter) !== "KindTypeReference") return undefined;
  const reference = ast.as.AsTypeReferenceNode(parameter);
  return reference?.TypeName === undefined || reference.TypeArguments !== undefined ? undefined
    : { node, parameter, name: reference.TypeName, absent };
}

function unionArmUse(scope: CaptureScope, type: Type, use: OriginalTypeUse | null, projection: UnionResultUse | null): UnionArmUse | ComposedUnionUse | null {
  const node = projection?.syntax.node ?? (use === null ? undefined : admittedTypeUse(scope, use));
  if (node === undefined) return null;
  let syntax = projection?.syntax ?? undefinedUnionSyntax(scope, node);
  let forwarded: ReturnType<typeof undefinedUnionArms>;
  if (syntax === undefined && scope.checked.ast.kindName(node) === "KindTypeReference") {
    if (!admit(scope, "edges")) return null;
    forwarded = undefinedUnionArms(scope, type);
    if (forwarded === undefined) return null;
    const operand = writtenForwardedOperand(scope, type, node, "union");
    if (operand === undefined) return null;
    syntax = undefinedUnionSyntax(scope, operand);
  }
  if (syntax === undefined || !admit(scope, "edges")) return null;
  const original = projection === null ? type : sourceType(scope, { kind: "signature-return", signature: projection.original })?.type;
  if (original === undefined) return null;
  if (forwarded !== undefined || use === null || "Kind" in use) {
    if (!admit(scope, "edges")) return null;
    const answer = sourceType(scope, { kind: "annotation", node: syntax.node });
    if (answer?.type !== original || answer.causes.length !== 0) return null;
  }
  const arms = forwarded ?? undefinedUnionArms(scope, original);
  if (arms === undefined || !admit(scope, "edges")) return null;
  const symbol = scope.checker.getTypeSymbol(arms.value);
  if (symbol === undefined || scope.checker.getSymbolAtLocation(syntax.name) !== symbol) return null;
  if (scope.tables.mergedParameterOwners?.has(symbol) !== true) {
    const declarations = scope.checker.getSymbolDeclarations(symbol);
    if (declarations.length === 0) return null;
    for (let index = 0; index < declarations.length; index += 1) {
      if (!admit(scope, "edges")) return null;
      const declaration = declarations[index];
      if (declaration === undefined || scope.checked.ast.kindName(declaration) !== "KindTypeParameter") return null;
    }
  }
  const parameter = sourceType(scope, { kind: "annotation", node: syntax.parameter });
  if (parameter?.type !== arms.value || parameter.causes.length !== 0 || !admit(scope, "edges")) return null;
  const absent = sourceType(scope, { kind: "annotation", node: syntax.absent });
  if (absent?.type !== arms.absent || absent.causes.length !== 0) return null;
  if (projection === null) return { kind: "union-arm", type: arms.value, source: syntax.parameter };
  const receiver = projection.receiver;
  const bound = receiver.slots.get(arms.value);
  if (bound === undefined) return null;
  const composition = bound.composition;
  if (composition !== undefined && composition.type !== bound.argument) return null;
  const selected = undefinedUnionArms(scope, type, composition?.reference);
  if (selected?.value !== (composition?.bare ?? bound.argument) || selected.absent !== arms.absent) return null;
  return composition === undefined ? { kind: "union-arm", type: selected.value, source: bound.source }
    : admit(scope, "facts") ? { ...composition, type } : null;
}

function callbackPayload(scope: CaptureScope, type: Type, optional: boolean): { readonly value: Type; readonly absent: Type | undefined } | undefined {
  return optional ? undefinedUnionArms(scope, type)
    : scope.shape.isUnion(type) || scope.shape.isIntersection(type) ? undefined : { value: type, absent: undefined };
}

function callbackBindingUse(scope: CaptureScope, use: CallbackInputUse, type: Type): CallbackBindingUse | null {
  if (type !== use.selected || !admit(scope, "edges")) return null;
  const source = sourceType(scope, { kind: "annotation", node: use.syntax });
  if (source === undefined || source.causes.length !== 0) return null;
  const old = callbackPayload(scope, use.original, use.optional);
  if (old === undefined || old.value !== source.type || !admit(scope, "edges")) return null;
  const authored = scope.checker.getSignatureFromDeclaration(use.syntax);
  const originals = scope.shape.getCallSignatures(old.value);
  if (originals.length !== 1 || authored === undefined || authored !== originals[0] || authored.target !== undefined ||
    authored.mapper !== undefined || authored.composite !== undefined || authored.typeParameters.length !== 0) return null;
  const applied = callbackPayload(scope, type, use.optional);
  if (applied === undefined || applied.absent !== old.absent || applied.value === old.value || !admit(scope, "edges")) return null;
  const signatures = scope.shape.getCallSignatures(applied.value);
  const selected = signatures[0];
  const origin = selected?.derivation;
  if (signatures.length !== 1 || selected === undefined || selected.target !== authored || selected.mapper === undefined ||
    selected.composite !== undefined || selected.typeParameters.length !== 0 || origin?.kind !== "member" ||
    origin.owner !== applied.value || origin.signatureKind !== "call" || origin.index !== 0 ||
    scope.checker.getSignatureDeclaration(selected) !== use.syntax ||
    scope.shape.getTypeReferenceTarget(applied.value) !== old.value) return null;
  return { kind: "callback", receiver: use.receiver, syntax: use.syntax, type: applied.value, original: authored, selected };
}

function directBinderSource(scope: CaptureScope, bound: ReceiverSlotUse, syntax: Node, parameter: CheckerSymbol | undefined): Node | undefined {
  if (parameter === undefined || scope.checker.getTypeSymbol(bound.parameter) !== parameter || !admit(scope, "edges")) return undefined;
  const authored = sourceType(scope, { kind: "annotation", node: syntax });
  return authored?.type === bound.parameter && authored.causes.length === 0 ? bound.source : undefined;
}

function directResultUse(scope: CaptureScope, use: DirectResultUse, type: Type): DirectResultUse | null {
  if (!admit(scope, "edges")) return null;
  const parameter = scope.checker.getSymbolAtLocation(use.name);
  if (parameter === undefined || !admit(scope, "edges")) return null;
  const original = sourceType(scope, { kind: "signature-return", signature: use.original });
  const bound = original === undefined || original.causes.length !== 0 ? undefined : use.receiver.slots.get(original.type);
  if (bound === undefined || type !== bound.argument) return null;
  const source = directBinderSource(scope, bound, use.syntax, parameter);
  return source === undefined ? null : { ...use, source };
}

interface OriginalIndexInventory {
  readonly rows: readonly TypeIndexInfo[];
  origins: Map<Node, Map<Type, TypeIndexInfo | null>> | null;
}

function originalIndexRow(scope: CaptureScope, inventory: OriginalIndexInventory, declaration: Node, key: Type): TypeIndexInfo | null {
  if (inventory.origins === null) {
    if (!admit(scope, "edges")) return null;
    const origins = new Map<Node, Map<Type, TypeIndexInfo | null>>();
    for (let index = 0; index < inventory.rows.length; index += 1) {
      if (!admit(scope, "edges")) return null;
      const row = inventory.rows[index];
      if (row === undefined) return throwInvariant(invariant("A native index template requires a dense inventory."));
      if (row.declaration === undefined || row.keyType === undefined) continue;
      let byKey = origins.get(row.declaration);
      if (byKey === undefined) origins.set(row.declaration, byKey = new Map());
      byKey.set(row.keyType, byKey.has(row.keyType) ? null : row);
    }
    inventory.origins = origins;
  }
  if (!admit(scope, "edges")) return null;
  return inventory.origins.get(declaration)?.get(key) ?? null;
}

function checkedIndexValueBinder(scope: CaptureScope, target: CheckerSymbol, selected: TypeIndexInfo,
  originals: OriginalIndexInventory, accepts: (type: Type) => boolean):
  { readonly node: Node; readonly type: Type; readonly symbol: CheckerSymbol | undefined } | undefined {
  const { declaration, keyType, readonly } = selected;
  const ast = scope.checked.ast;
  if (declaration === undefined || keyType === undefined ||
    selected.components.length > 1 || selected.components.length === 1 && selected.components[0] !== declaration ||
    !admit(scope, "edges") || ast.kindName(declaration) !== "KindIndexSignature" ||
    ast.hasModifierKind(declaration, "readonly") !== readonly) return undefined;
  const valueNode = ast.typeNode(declaration);
  const name = valueNode === undefined ? undefined : parameterReferenceName(scope, valueNode);
  const parent = ast.parent(declaration);
  if (valueNode === undefined || name === undefined || parent === undefined ||
    scope.checker.getSymbolAtLocation(ast.name(parent)) !== target) return undefined;
  const original = originalIndexRow(scope, originals, declaration, keyType);
  if (original === null || original.readonly !== readonly || original.valueType === undefined || !accepts(original.valueType) ||
    original.components.length > 1 || original.components.length === 1 && original.components[0] !== declaration ||
    !admit(scope, "edges")) return undefined;
  const parameters = ast.parameters(declaration);
  const key = parameters.length === 1 ? ast.typeNode(parameters[0]) : undefined;
  if (key === undefined) return undefined;
  const authored = sourceType(scope, { kind: "annotation", node: key });
  if (authored === undefined || authored.type !== keyType || authored.causes.length !== 0 || !admit(scope, "edges")) return undefined;
  return { node: valueNode, type: original.valueType, symbol: scope.checker.getSymbolAtLocation(name) };
}

function directIndexValueSource(scope: CaptureScope, receiver: ReceiverUse, bound: ReceiverSlotUse, selected: TypeIndexInfo,
  originals: OriginalIndexInventory): Node | undefined {
  const value = checkedIndexValueBinder(scope, receiver.target, selected, originals, type => type === bound.parameter);
  return value === undefined ? undefined : directBinderSource(scope, bound, value.node, value.symbol);
}

function selectedMergedIndexArgument(scope: CaptureScope, reference: Type, selected: TypeIndexInfo):
  { readonly source: Node | null; readonly slot: MergedSlotUse | null } | null {
  const argument = selected.valueType;
  if (argument === undefined || !scope.shape.isTypeReference(reference)) return null;
  const symbol = scope.checker.getTypeSymbol(argument);
  if (symbol === undefined || scope.checker.getSymbolDeclarations(symbol).length < 2 || !admit(scope, "edges")) return null;
  const target = scope.shape.getTypeReferenceTarget(reference);
  const receiver = target === undefined ? undefined : scope.checker.getTypeSymbol(target);
  if (target === undefined || receiver === undefined) return null;
  const original = scope.shape.getStructuredInventory(target, nativeCaptureAdmission(scope));
  if (original.kind !== "complete") return null;
  const authored = checkedIndexValueBinder(scope, receiver, selected, { rows: original.value.indexes, origins: null }, () => true);
  if (authored === undefined || authored.symbol === undefined || scope.checker.getTypeSymbol(authored.type) !== authored.symbol) return null;
  const checked = sourceType(scope, { kind: "annotation", node: authored.node });
  if (checked?.type !== authored.type || checked.causes.length !== 0) return null;
  const selectedSlot = scope.shape.acquireCompletedTypeArgument(reference, authored.type, nativeCaptureAdmission(scope));
  if (selectedSlot.kind !== "complete" || selectedSlot.value !== argument) return null;
  if (authored.type === argument) return { source: authored.node, slot: null };
  const declarations = mergedArgumentGroup(scope, argument);
  return declarations === null ? null : { source: null, slot: { kind: "merged-slot", type: argument, declarations } };
}

function selectMergedParameter(scope: CaptureScope, symbol: CheckerSymbol, declarations: readonly (Node | undefined)[],
  source: Node | undefined): Node | undefined {
  if (source === undefined || !admit(scope, "edges")) return undefined;
  const ast = scope.checked.ast;
  const name = parameterReferenceName(scope, source);
  if (name === undefined || scope.checker.getSymbolAtLocation(name) !== symbol) return undefined;
  let byOwner = scope.tables.mergedParameterOwners?.get(symbol);
  if (byOwner === undefined) {
    if (!admit(scope, "edges")) return undefined;
    const indexed = new Map<Node, Node>();
    for (let index = 0; index < declarations.length; index += 1) {
      if (!admit(scope, "edges")) return undefined;
      const declaration = declarations[index];
      if (declaration === undefined) return throwInvariant(invariant("A native declaration group cannot contain an absent row."));
      if (ast.kindName(declaration) !== "KindTypeParameter") return undefined;
      const owner = ast.parent(declaration);
      if (owner === undefined || indexed.has(owner))
        return throwInvariant(invariant("A merged type parameter requires distinct actual enclosing declarations."));
      indexed.set(owner, declaration);
    }
    (scope.tables.mergedParameterOwners ??= new Map()).set(symbol, indexed);
    byOwner = indexed;
  }
  let selected: Node | undefined;
  for (let node: Node | undefined = source; node !== undefined; node = ast.parent(node)) {
    if (!admit(scope, "edges")) return undefined;
    const declaration = byOwner.get(node);
    if (declaration === undefined) continue;
    if (selected !== undefined)
      return throwInvariant(invariant("The actual type occurrence cannot belong to competing declarations of one merged parameter."));
    selected = declaration;
  }
  return selected;
}

function captureAuthoredAnnotation(scope: CaptureScope, node: Node, source: RawNodeRef,
  selected?: Type): RawTypeId | null {
  return rawType(scope, () => {
    const authored = sourceType(scope, { kind: "annotation", node });
    if (scope.meter.refusal !== null) return undefined;
    if (authored === undefined || selected !== undefined && authored.type !== selected)
      return throwInvariant(invariant("An authored annotation must agree with its actual checked answer."));
    return authored;
  }, component(scope, source, null), source, null, scope.numericLiterals.has(node) ? node : null);
}

function authoredOperatorOperand(scope: CaptureScope, child: Node | undefined, selected: Type | undefined): RawTypeId | null {
  if (!admit(scope, "edges")) return null;
  const source = child === undefined ? null : referenceTo(scope, scope.program, child);
  if (scope.meter.refusal !== null) return null;
  if (child === undefined || source === null) return throwInvariant(invariant("A dependent operator requires its actual admitted operand syntax."));
  return captureAuthoredAnnotation(scope, child, source, selected);
}

type SelectedIndex = {
  readonly form: Extract<RawTypeForm, { kind: "indexed-access" | "indexed-alias-dependency" }>;
  readonly alias: Extract<RawCheckedType["alias"], { kind: "available" }>["value"];
};

function selectedOperand(scope: CaptureScope, parent: RawComponent, value: Type, step: RawComponentStep,
  indexedObject = false, binding: MergedSlotUse | ComposedUnionUse | DeclaredArgumentsUse | null = null): RawTypeId | null {
  if (!admit(scope, "edges")) return null;
  const occurrence = appendComponent(scope, parent, step);
  if (occurrence === null) return null;
  const role = (value.flags & TypeFlagsIndexedAccess) !== 0 ? "indexed-result"
    : indexedObject && scope.shape.isTuple(value) ? "indexed-tuple-object" : null;
  const use: ProjectedOperandUse | MergedSlotUse | ComposedUnionUse | DeclaredArgumentsUse | null =
    binding ?? (role === null ? null : { kind: "projected-operand", type: value, role });
  return rawType(scope, () => withoutTypeCause(value), occurrence, null, use);
}

function selectedIndexedType(scope: CaptureScope, type: Type, componentId: RawComponentId,
  projection: ProjectedOperandUse | null, backedge = false): SelectedIndex | null {
  if (!admit(scope, "edges")) return null;
  const operands = scope.shape.getIndexedAccessComponents(type);
  if (operands === undefined)
    throw new TypeError("front: an indexed result requires its actual native operands");
  if (!admit(scope, "edges")) return null;
  const componentRoot = scope.tables.components[componentId];
  if (componentRoot === undefined) return throwInvariant(invariant("A selected indexed answer requires its actual result component."));
  const application = type.alias === undefined ? undefined : nativeAliasApplication(scope, type, scope.shape.acquireTypeAliasApplication);
  if (scope.meter.refusal !== null) return null;
  let selected: { readonly declaration: RawNodeRef; readonly operator: RawNodeRef;
    readonly recursive: boolean; readonly native: RetainedTypeAliasApplication } | null = null;
  if (application === undefined) {
    if (type.alias !== undefined || projection?.role !== "indexed-result" || projection.type !== type)
      throw new TypeError("front: the selected indexed answer requires its actual retained indexed alias application");
  } else {
    if (application.result !== type || scope.checked.ast.kindName(application.typeNode) !== "KindIndexedAccessType")
      throw new TypeError("front: the selected indexed answer requires its actual retained indexed alias application");
    const declaration = referenceTo(scope, scope.program, application.declaration);
    const operator = referenceTo(scope, scope.program, application.typeNode);
    if (scope.meter.refusal !== null) return null;
    if (declaration === null || operator === null)
      return throwInvariant(invariant("A selected indexed application requires its actual source declaration and operator."));
    if (!admit(scope, "edges")) return null;
    selected = { declaration, operator, recursive: scope.tables.activeIndexedAliases.has(application.declaration), native: application };
  }
  if (backedge && selected?.recursive !== true)
    throw new TypeError("front: a recursive indexed result requires its actual qualified application dependency");
  let form: SelectedIndex["form"];
  if (selected?.recursive === true) form = { kind: "indexed-alias-dependency", operator: selected.operator };
  else {
    const declaration = selected?.native.declaration;
    if (declaration !== undefined) scope.tables.pending.push({ kind: "indexed-alias-scope", declaration, enter: false });
    const object = selectedOperand(scope, componentRoot, operands.objectType, { kind: "projection-source" }, true);
    if (object === null) return null;
    const index = selectedOperand(scope, componentRoot, operands.indexType, { kind: "projection-index" });
    if (index === null) return null;
    if (declaration !== undefined) scope.tables.pending.push({ kind: "indexed-alias-scope", declaration, enter: true });
    form = { kind: "indexed-access", operator: selected?.operator ?? null, object, index };
  }
  if (selected === null) return { form, alias: null };
  const { declaration, native } = selected;
  const arguments_: { parameter: RawNodeRef; type: RawTypeId }[] = [];
  for (let ordinal = 0; ordinal < native.bindings.length; ordinal += 1) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const binding = native.bindings[ordinal];
    if (binding === undefined) return throwInvariant(invariant("A selected alias application requires its complete ordered argument vector."));
    const parameter = referenceTo(scope, scope.program, binding.declaration);
    if (scope.meter.refusal !== null) return null;
    if (parameter === null) return throwInvariant(invariant("A selected alias argument requires its actual admitted parameter."));
    const argument = selectedOperand(scope, componentRoot, binding.argument, { kind: "type-argument", declaration, index: ordinal });
    if (argument === null) return null;
    arguments_.push({ parameter, type: argument });
  }
  return { form, alias: { declaration, arguments: arguments_ } };
}

function projectedConditional(scope: CaptureScope, type: Type, parent: RawComponent, member: RawNodeRef | null): RawTypeForm | null {
  if (!admit(scope, "edges")) return null;
  const answer = scope.shape.getConditionalComponents(type);
  if (answer === undefined)
    throw new TypeError("front: a projected conditional requires its actual native components");
  const { declaration, checkType, extendsType, trueBranch, falseBranch, distributive } = answer;
  const ast = scope.checked.ast;
  if (member === null && answer.inferParameters.length !== 0)
    throw new TypeError("front: a selected conditional key cannot borrow a local inference binder");
  if (member !== null) {
    if (!admit(scope, "edges")) return null;
    let annotation = ast.typeNode(admittedTypeUse(scope, member));
    while (annotation !== undefined && ast.kindName(annotation) === "KindParenthesizedType") {
      if (!admit(scope, "edges")) return null;
      annotation = ast.as.AsParenthesizedTypeNode(annotation)?.Type;
    }
    if (annotation !== declaration)
      throw new TypeError("front: a conditional property component requires its actual authored operator");
    if (answer.application === null) {
      if (!admit(scope, "edges")) return null;
      const original = sourceType(scope, { kind: "annotation", node: declaration });
      if (scope.meter.refusal !== null) return null;
      if (original?.type !== type || original.causes.length !== 0)
        throw new TypeError("front: a selected conditional property component requires its exact retained application");
    }
  }
  const syntax = ast.as.AsConditionalTypeNode(declaration);
  if (syntax === undefined) return throwInvariant(invariant("A projected conditional requires its actual source operator."));
  const operator = referenceTo(scope, scope.program, declaration);
  if (scope.meter.refusal !== null) return null;
  if (operator === null) return throwInvariant(invariant("A projected conditional requires its actual admitted operator."));
  const inferParameters = conditionalBinders(scope, syntax.ExtendsType, answer.inferParameters);
  if (inferParameters === null) return null;
  const authored = member !== null && answer.application === null;
  const check = authored ? authoredOperatorOperand(scope, syntax.CheckType, checkType)
    : selectedOperand(scope, parent, checkType, { kind: "projection-source" });
  if (check === null) return null;
  const extended = authored ? authoredOperatorOperand(scope, syntax.ExtendsType, extendsType)
    : selectedOperand(scope, parent, extendsType, { kind: "projection-extends" });
  if (extended === null) return null;
  const branch = (child: Node | undefined, selected: Type | undefined, step: "projection-when-true" | "projection-when-false"):
    RawConditionalBranch | null => {
    if (authored) {
      const authored = authoredOperatorOperand(scope, child, selected);
      return authored === null ? null : { kind: "ready", type: authored };
    }
    if (selected !== undefined) {
      const captured = selectedOperand(scope, parent, selected, { kind: step });
      return captured === null ? null : { kind: "ready", type: captured };
    }
    if (member === null || answer.application === null)
      throw new TypeError("front: a projected conditional key requires both available native branch inputs");
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const source = child === undefined ? null : referenceTo(scope, scope.program, child);
    if (scope.meter.refusal !== null) return null;
    if (source === null) return throwInvariant(invariant("A deferred conditional branch requires its actual source occurrence."));
    return { kind: "deferred", source };
  };
  const whenTrue = branch(syntax.TrueType, trueBranch?.type, "projection-when-true");
  if (whenTrue === null) return null;
  const whenFalse = branch(syntax.FalseType, falseBranch?.type, "projection-when-false");
  if (whenFalse === null) return null;
  let application: { parameter: RawNodeRef; type: RawTypeId }[] | null = null;
  if (answer.application !== null) {
    application = [];
    for (let index = 0; index < answer.application.length; index += 1) {
      if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
      const binding = answer.application[index];
      if (binding === undefined) return throwInvariant(invariant("A projected conditional retains every actual outer binding."));
      const parameter = referenceTo(scope, scope.program, binding.declaration);
      if (scope.meter.refusal !== null) return null;
      if (parameter === null) return throwInvariant(invariant("A projected conditional argument retains its actual parameter."));
      const argument = selectedOperand(scope, parent, binding.argument, { kind: "projection-argument", index });
      if (argument === null) return null;
      application.push({ parameter, type: argument });
    }
  }
  return { kind: "conditional", operator, check, extends: extended, whenTrue, whenFalse, distributive, inferParameters, application };
}

function conditionalBinders(scope: CaptureScope, pattern: Node | undefined, parameters: readonly Type[]): readonly RawNodeRef[] | null {
  const result: RawNodeRef[] = [];
  const ast = scope.checked.ast;
  for (let index = 0; index < parameters.length; ++index) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const parameter = parameters[index];
    const symbol = parameter === undefined ? undefined : scope.checker.getTypeSymbol(parameter);
    const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
    const declaration = declarations[0];
    const inference = ast.parent(declaration);
    if (declarations.length !== 1 || declaration === undefined || ast.kindName(declaration) !== "KindTypeParameter"
      || inference === undefined || ast.as.AsInferTypeNode(inference)?.TypeParameter !== declaration || pattern === undefined)
      return throwInvariant(invariant("A conditional binder requires its actual InferType parameter declaration."));
    let owner: Node | undefined = inference;
    while (owner !== undefined && owner !== pattern) {
      if (!admit(scope, "edges")) return null;
      if (ast.kindName(owner) === "KindConditionalType")
        return throwInvariant(invariant("A conditional binder belongs to its actual nearest extends pattern."));
      owner = ast.parent(owner);
    }
    if (owner !== pattern) return throwInvariant(invariant("A direct conditional binder belongs to its actual extends pattern."));
    const reference = referenceTo(scope, scope.program, declaration);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return throwInvariant(invariant("A conditional inference binder needs an admitted original declaration."));
    result.push(reference);
  }
  return result;
}

function deferredAliasApplication(scope: CaptureScope, type: Type, parent: RawComponent,
  syntax: Node | undefined): RawTypeForm | null {
  const ast = scope.checked.ast;
  const reference = ast.kindName(syntax) === "KindTypeReference" ? ast.as.AsTypeReferenceNode(syntax) : undefined;
  if (syntax !== undefined && reference === undefined || syntax === undefined && type.alias === undefined) return null;
  if (!admit(scope, "edges")) return null;
  const authoredParent = reference === undefined ? undefined : ast.parent(syntax);
  const enclosing = ast.kindName(authoredParent) === "KindTypeAliasDeclaration" && ast.typeNode(authoredParent) === syntax
    ? scope.checker.getSymbolAtLocation(ast.name(authoredParent)) : undefined;
  const written = reference === undefined ? undefined : scope.checker.getSymbolAtLocation(reference.TypeName);
  let forwarding: { readonly owner: Node; readonly arguments: readonly { readonly source: Node; readonly argument: Type }[] } | null = null;
  if (reference !== undefined && written !== undefined && enclosing !== undefined && enclosing !== written
    && type.alias?.symbol === enclosing && ast.typeParameters(authoredParent).length !== 0) {
    if (!admit(scope, "edges")) return null;
    const declarations = scope.checker.getSymbolDeclarations(written);
    const candidate = declarations[0];
    const operands = reference.TypeArguments?.Nodes;
    if (declarations.length === 1 && candidate !== undefined && ast.kindName(candidate) === "KindTypeAliasDeclaration" &&
      operands !== undefined && operands.length === ast.typeParameters(candidate).length) {
      const actual = sourceType(scope, { kind: "annotation", node: syntax });
      if (scope.meter.refusal !== null) return null;
      if (actual?.type === type && actual.causes.length === 0) {
        if (!admit(scope, "facts")) return null;
        const inputs: { source: Node; argument: Type }[] = [];
        let open = false;
        for (let index = 0; index < operands.length; ++index) {
          if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
          const source = operands[index];
          if (source === undefined) return null;
          const checked = sourceType(scope, { kind: "annotation", node: source });
          if (checked === undefined || checked.causes.length !== 0) return null;
          if (!open) {
            if (!admit(scope, "edges")) return null;
            const owners = scope.checker.getSymbolDeclarations(scope.checker.getTypeSymbol(checked.type));
            open = (checked.type.flags & (TypeFlagsConditional | TypeFlagsIndexedAccess)) !== 0
              || owners.length === 1 && ast.kindName(owners[0]) === "KindTypeParameter";
          }
          inputs.push({ source, argument: checked.type });
        }
        if (open) forwarding = { owner: candidate, arguments: inputs };
      }
    }
  }
  const conditional = forwarding === null && (type.flags & TypeFlagsConditional) !== 0;
  const answer = conditional ? scope.shape.getConditionalComponents(type) : undefined;
  const nativeAcquisition = reference !== undefined && (type.flags & TypeFlagsIndexedAccess) !== 0
    ? scope.shape.acquireTypeAliasApplication : scope.shape.acquireDeferredTypeAliasApplication;
  const retained = conditional || forwarding !== null ? undefined
    : nativeAliasApplication(scope, type, nativeAcquisition);
  if (scope.meter.refusal !== null) return null;
  const definition = forwarding === null ? answer?.declaration ?? retained?.typeNode : ast.typeNode(forwarding.owner);
  const owner = forwarding?.owner ?? retained?.declaration ?? ast.parent(definition);
  if (owner === undefined || definition === undefined || ast.kindName(owner) !== "KindTypeAliasDeclaration" || ast.typeNode(owner) !== definition)
    return null;
  if (reference !== undefined) {
    if (!admit(scope, "edges")) return null;
    const declared = scope.checker.getSymbolAtLocation(ast.name(owner));
    if (written === undefined || declared === undefined || written !== declared) return null;
    if (forwarding === null) {
      const actual = sourceType(scope, { kind: "annotation", node: syntax });
      if (actual?.type !== type || actual.causes.length !== 0) return null;
    }
  }
  let native = answer?.application ?? retained?.bindings ?? null;
  if (forwarding === null && (reference === undefined || native === null)) {
    if (!admit(scope, "edges")) return null;
    const actual = retained ?? nativeAliasApplication(scope, type, scope.shape.acquireTypeAliasApplication);
    if (scope.meter.refusal !== null) return null;
    if (actual?.result !== type || actual.declaration !== owner || actual.typeNode !== definition) return null;
    native = actual.bindings;
  }
  const parameters = ast.typeParameters(owner);
  if ((forwarding?.arguments.length ?? native?.length) !== parameters.length) return null;
  const declaration = referenceTo(scope, scope.program, owner);
  if (scope.meter.refusal !== null) return null;
  if (declaration === null) return throwInvariant(invariant("An open alias must retain its actual admitted declaration."));
  const arguments_: RawTypeId[] = [];
  const annotations = reference?.TypeArguments?.Nodes;
  for (let index = 0; index < parameters.length; ++index) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const row = native?.[index];
    const authoredInput = forwarding?.arguments[index];
    const argument = authoredInput?.argument ?? row?.argument;
    if (argument === undefined || authoredInput === undefined && (row === undefined || row.declaration !== parameters[index]))
      return throwInvariant(invariant("An open alias application must pair its actual ordered formal declarations."));
    const source = authoredInput?.source ?? annotations?.[index];
    if (source !== undefined && authoredInput === undefined) {
      const actual = sourceType(scope, { kind: "annotation", node: source });
      if (scope.meter.refusal !== null) return null;
      if (actual?.type !== argument || actual.causes.length !== 0) return null;
    }
    const step: RawComponentStep = { kind: "argument-place", index };
    let captured: RawTypeId | null;
    if (source === undefined) captured = selectedOperand(scope, parent, argument, step);
    else {
      const authored = referenceTo(scope, scope.program, source);
      if (scope.meter.refusal !== null) return null;
      if (authored === null) return throwInvariant(invariant("A written alias argument requires its actual numbered operand."));
      captured = rawType(scope, () => withoutTypeCause(argument), appendComponent(scope, parent, step), authored);
    }
    if (captured === null) return null;
    arguments_.push(captured);
  }
  return { kind: "alias-application", declaration, arguments: arguments_ };
}

interface TypeInterfaceApplication {
  readonly target: Type;
  readonly declarations: readonly [Node, ...Node[]];
  readonly arguments: readonly TypeReferenceArgumentInfo[];
}

function nativeInterfaceDeclarations(scope: CaptureScope, target: Type): readonly [Node, ...Node[]] | undefined | null {
  if (!admit(scope, "edges")) return null;
  const capture = scope.tables.interfaceCapture;
  const known = capture.declarations?.get(target);
  if (known !== undefined) return known;
  const result = scope.shape.acquireInterfaceDeclarations(target, nativeCaptureAdmission(scope));
  if (result.kind === "refused" && result.stop === scope.meter.refusal) return null;
  if (result.kind === "unavailable") return undefined;
  if (result.kind !== "complete") return throwInvariant(invariant("A declaration acquisition must retain its actual refusal."));
  if (!admit(scope, "facts", capture.declarations === null ? 2 : 1)) return null;
  (capture.declarations ??= new Map()).set(target, result.value);
  return result.value;
}

function nativeInterfaceApplication(scope: CaptureScope, type: Type): TypeInterfaceApplication | null {
  if (!admit(scope, "edges")) return null;
  const capture = scope.tables.interfaceCapture;
  const known = capture.applications?.get(type);
  if (known !== undefined) return known;
  const target = scope.shape.getTypeReferenceTarget(type) ?? type;
  const declarations = nativeInterfaceDeclarations(scope, target);
  if (declarations === null) return null;
  if (declarations === undefined)
    return throwInvariant(invariant("A merged interface must borrow its actual native declaration target."));
  const result = scope.shape.acquireInterfaceArguments(type, target, nativeCaptureAdmission(scope));
  if (result.kind === "complete") {
    if (!admit(scope, "facts", capture.applications === null ? 3 : 2)) return null;
    const value = { target, declarations, arguments: result.value };
    (capture.applications ??= new Map()).set(type, value);
    return value;
  }
  if (result.kind === "refused" && result.stop === scope.meter.refusal) return null;
  return throwInvariant(invariant("A merged interface must borrow its actual native declaration application."));
}

function mergedArgumentGroup(scope: CaptureScope, argument: Type): readonly [RawNodeRef, ...RawNodeRef[]] | null {
  if (!admit(scope, "edges")) return null;
  const symbol = scope.checker.getTypeSymbol(argument);
  if (symbol === undefined) return null;
  return parameterGroup(scope, symbol, 2);
}

function parameterGroup(scope: CaptureScope, binder: CheckerSymbol, minimum: 1 | 2): readonly [RawNodeRef, ...RawNodeRef[]] | null {
  const declarations = scope.checker.getSymbolDeclarations(binder);
  if (declarations.length < minimum) return null;
  let result: [RawNodeRef, ...RawNodeRef[]] | null = null;
  for (let index = 0; index < declarations.length; ++index) {
    if (!admit(scope, "edges")) return null;
    const node = declarations[index];
    if (node === undefined || scope.checked.ast.kindName(node) !== "KindTypeParameter") return null;
    const reference = referenceTo(scope, scope.program, node);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return throwInvariant(invariant("A native parameter group requires its actual admitted declarations."));
    if (!admit(scope, "facts", result === null ? 2 : 1)) return null;
    if (result === null) result = [reference];
    else result.push(reference);
  }
  return result;
}

function activeMergedSlot(scope: CaptureScope, type: Type, symbol: CheckerSymbol): RawTypeForm | null {
  for (const inventory of scope.tables.activeMergedInventories.values()) {
    if (!admit(scope, "edges")) return null;
    const arguments_ = scope.shape.getTypeReferenceArgumentInfos(inventory);
    if (arguments_ === undefined) continue;
    for (const slot of arguments_) {
      if (!admit(scope, "edges")) return null;
      if (slot.parameter !== type) continue;
      const declarations = parameterGroup(scope, symbol, 2);
      if (scope.meter.refusal !== null) return null;
      if (declarations === null)
        return throwInvariant(invariant("An active merged slot must retain its actual admitted parameter group."));
      return captureMergedParameter(scope, declarations);
    }
  }
  return null;
}

function restArgumentForSlot(rest: ReceiverUse | DeclaredRestUse | null, selected: TypeReferenceArgumentInfo): ComposedUnionUse | DeclaredArgumentsUse | null {
  if (rest === null || selected.scope !== "local" || selected.argument.alias !== undefined) return null;
  if (rest.kind === "declared-rest") return rest.slot.parameter === selected.parameter && rest.slot.argument === selected.argument ? rest.argument : null;
  const slot = rest.slots.get(selected.parameter);
  return slot?.parameter === selected.parameter && slot.argument === selected.argument && slot.composition?.type === selected.argument
    ? slot.composition : null;
}

function retainInterfaceGroup(scope: CaptureScope, application: TypeInterfaceApplication): RawInterfaceGroup | null {
  const { byTarget, rows } = scope.tables.interfaceGroups;
  const known = byTarget.get(application.target);
  if (known !== undefined) return known;
  const { interfaceCapture } = scope.tables;
  const register = (evidence: RawInterfaceGroupEvidence): RawInterfaceGroup => {
    const group: RawInterfaceGroup = { ordinal: rows.length, evidence };
    byTarget.set(application.target, group);
    rows.push(group);
    return group;
  };
  if (!admit(scope, "edges")) return null;
  const recorded = interfaceCapture.groups?.get(application.target);
  if (recorded !== undefined) return admit(scope, "facts", 3) ? register(recorded) : null;
  if (!admit(scope, "facts", interfaceCapture.groups === null ? 8 : 7)) return null;
  const captureDeclaration = (index: number): RawNodeRef | null => {
    if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
    const source = application.declarations[index];
    const reference = source === undefined ? null : referenceTo(scope, scope.program, source);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return throwInvariant(invariant("A merged type recipe requires every actual interface declaration."));
    return reference;
  };
  const first = captureDeclaration(0);
  if (first === null) return null;
  const second = captureDeclaration(1);
  if (second === null) return null;
  const declarations: [RawNodeRef, RawNodeRef, ...RawNodeRef[]] = [first, second];
  for (let index = 2; index < application.declarations.length; ++index) {
    const reference = captureDeclaration(index);
    if (reference === null) return null;
    declarations.push(reference);
  }
  const slots: RawInterfaceGroupEvidence["slots"][number][] = [];
  for (let index = 0; index < application.arguments.length; ++index) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const selected = application.arguments[index];
    const binder = selected === undefined ? undefined : scope.checker.getTypeSymbol(selected.parameter);
    if (selected === undefined || binder === undefined)
      return throwInvariant(invariant("A merged interface slot needs its actual parameter symbol."));
    const parameters = parameterGroup(scope, binder, 1);
    if (scope.meter.refusal !== null) return null;
    if (parameters === null)
      return throwInvariant(invariant("A merged interface slot must retain its actual admitted parameter declarations."));
    slots.push({ scope: selected.scope, parameters });
  }
  const evidence: RawInterfaceGroupEvidence = { declarations, slots };
  (interfaceCapture.groups ??= new Map()).set(application.target, evidence);
  return register(evidence);
}

function captureDeclaredInterfaceGroup(scope: CaptureScope, declaration: Node): boolean {
  if (!admit(scope, "edges")) return false;
  const name = scope.checked.ast.name(declaration);
  const symbol = scope.checker.getSymbolAtLocation(name);
  if (symbol === undefined) return true;
  const source = scope.checker.getSymbolDeclarations(symbol);
  if (source.length < 2) return true;
  const checked = sourceType(scope, { kind: "expression", node: name });
  if (scope.meter.refusal !== null) return false;
  if (checked === undefined || scope.checker.getTypeSymbol(checked.type) !== symbol)
    return throwInvariant(invariant("An interface declaration must retain its actual native instance target."));
  const target = scope.shape.getTypeReferenceTarget(checked.type) ?? checked.type;
  const declarations = nativeInterfaceDeclarations(scope, target);
  if (declarations === null) return false;
  if (declarations === undefined) {
    for (let index = 0; index < source.length; ++index) {
      if (!admit(scope, "edges")) return false;
      const fragment = source[index];
      if (fragment === undefined) return throwInvariant(invariant("A type's declaration inventory cannot contain an absent row."));
      if (scope.checked.ast.kindName(fragment) === "KindClassDeclaration") return true;
    }
    return throwInvariant(invariant("An interface declaration must retain its actual native declaration inventory."));
  }
  if (declarations.length < 2) return true;
  const application = nativeInterfaceApplication(scope, target);
  return application !== null && retainInterfaceGroup(scope, application) !== null;
}

function captureMergedParameter(scope: CaptureScope, declarations: readonly [RawNodeRef, ...RawNodeRef[]]): RawTypeForm | null {
  if (!admit(scope, "edges")) return null;
  const ast = scope.checked.ast;
  const parameter = admittedTypeUse(scope, declarations[0]);
  const owner = ast.parent(parameter);
  if (ast.kindName(parameter) !== "KindTypeParameter" || ast.kindName(owner) !== "KindInterfaceDeclaration")
    return throwInvariant(invariant("A symbolic merged parameter must retain its actual interface owner."));
  if (!admit(scope, "edges")) return null;
  const symbol = scope.checker.getSymbolAtLocation(ast.name(owner));
  const target = symbol === undefined ? undefined : scope.checker.getDeclaredTypeOfSymbol(symbol);
  if (target === undefined) return throwInvariant(invariant("A symbolic merged parameter requires its independently declared target."));
  let sourceGroup = scope.tables.interfaceGroups.byTarget.get(target);
  if (sourceGroup === undefined) {
    const application = nativeInterfaceApplication(scope, target);
    if (application === null) return null;
    const retained = retainInterfaceGroup(scope, application);
    if (retained === null) return null;
    sourceGroup = retained;
  }
  for (let index = 0; index < sourceGroup.evidence.slots.length; ++index) {
    if (!admit(scope, "edges")) return null;
    const slot = sourceGroup.evidence.slots[index];
    if (slot === undefined) return throwInvariant(invariant("A retained merged group must have dense native slots."));
    if (slot.scope !== "local" || slot.parameters.length !== declarations.length) continue;
    let agrees = true;
    for (let position = 0; position < declarations.length; ++position) {
      if (!admit(scope, "edges")) return null;
      const expected = declarations[position];
      if (expected === undefined || !sameSource(slot.parameters[position], expected)) { agrees = false; break; }
    }
    if (agrees) return { kind: "merged-slot-parameter", declarations: slot.parameters };
  }
  return throwInvariant(invariant("A symbolic merged parameter must match a complete independently declared native slot."));
}

function bindsWrittenTypeTarget(scope: CaptureScope, name: Node, target: CheckerSymbol | undefined): boolean {
  if (target === undefined) return false;
  let selected = scope.checker.getSymbolAtLocation(name);
  let visited: Set<CheckerSymbol> | null = null;
  while (selected !== undefined && selected !== target) {
    if (!admit(scope, "edges") || visited?.has(selected) === true) return false;
    const step = scope.checker.getAliasStep(selected);
    if (step?.kind !== "symbol") return false;
    if (!admit(scope, "facts", visited === null ? 2 : 1)) return false;
    (visited ??= new Set()).add(selected);
    selected = step.symbol;
  }
  return selected === target;
}

function nativeArrayReadonly(scope: CaptureScope, type: Type, arguments_: readonly TypeReferenceArgumentInfo[]): boolean | null {
  if (arguments_.length !== 1) return null;
  const receipt = scope.shape.acquireNativeArrayType(type, nativeCaptureAdmission(scope));
  if (receipt.kind !== "complete") return null;
  if (!admit(scope, "edges")) return null;
  const slot = arguments_[0];
  if (slot?.scope !== "local" || slot.argument !== receipt.value.element)
    return throwInvariant(invariant("A native array must retain its actual selected element slot."));
  return receipt.value.readonly;
}

function authoredNativeArrayElement(scope: CaptureScope, syntax: Node | undefined, type: Type, target: CheckerSymbol,
  inputs: readonly TypeReferenceArgumentInfo[]): DeclaredArgumentUse | null {
  if (syntax === undefined || !admit(scope, "edges")) return null;
  const bare = unparenthesizedType(scope, syntax);
  if (bare === undefined) return null;
  const bracketed = writtenBracketedElement(scope, bare);
  const named = bracketed === undefined ? unaryTypeReference(scope, bare) : undefined;
  const element = bracketed ?? named?.argument;
  const slot = inputs[0];
  if (element === undefined || slot?.scope !== "local" || named !== undefined && !bindsWrittenTypeTarget(scope, named.name, target))
    return null;
  const parent = sourceType(scope, { kind: "annotation", node: syntax });
  if (parent?.type !== type || parent.causes.length !== 0) return null;
  const child = sourceType(scope, { kind: "annotation", node: element });
  return child?.type === slot.argument && child.causes.length === 0 && admit(scope, "facts")
    ? { authored: element, selected: element, argument: slot.argument } : null;
}

function mergedInterfaceDependency(scope: CaptureScope, position: RawComponentId, application: TypeInterfaceApplication,
  rest: ReceiverUse | DeclaredRestUse | null, source: OriginalTypeUse | null, selectedType: Type): RawTypeForm | null {
  if (!admit(scope, "facts")) return null;
  const group = retainInterfaceGroup(scope, application);
  if (group === null) return null;
  if (!admit(scope, "edges")) return null;
  if (scope.tables.interfaceCapture.descriptions?.has(application.target) !== true &&
    !scope.tables.interfaceDescriptions.has(application.target)) {
    if (!admit(scope, "facts", 3)) return null;
    const anchor = component(scope, group.evidence.declarations[0], null);
    const description = rawType(scope, () => withoutTypeCause(application.target), anchor, null,
      { kind: "interface-description", target: application.target });
    if (description === null) return null;
    scope.tables.interfaceDescriptions.set(application.target, { group, shape: description });
  }
  const parent = scope.tables.components[position];
  if (parent === undefined) return throwInvariant(invariant("A recursive merged interface needs its actual captured position."));
  const sourceNode = source === null ? undefined : admittedTypeUse(scope, source);
  const written = writtenApplication(scope, sourceNode);
  let direct: readonly (Node | undefined)[] = [];
  if (written !== null && written.arguments.length !== 0) {
    if (!admit(scope, "edges")) return null;
    if (written.name === null ? application.arguments.length === 1
      : bindsWrittenTypeTarget(scope, written.name, scope.checker.getTypeSymbol(application.target))) {
      const actual = sourceType(scope, { kind: "annotation", node: sourceNode });
      if (scope.meter.refusal !== null) return null;
      if (actual?.type === selectedType && actual.causes.length === 0) direct = written.arguments;
    }
    if (scope.meter.refusal !== null) return null;
  }
  let local = 0;
  const arguments_: RawTypeId[] = [];
  for (let index = 0; index < application.arguments.length; index += 1) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const selected = application.arguments[index];
    const slot = group.evidence.slots[index];
    if (selected === undefined || slot === undefined || selected.scope !== slot.scope)
      return throwInvariant(invariant("A recursive merged interface must retain each actual parameter slot."));
    const writtenIndex = selected.scope === "local" ? local++ : null;
    let authored: Node | null = null;
    const receiver = rest?.kind === "receiver" ? rest.slots.get(selected.parameter) : undefined;
    if (receiver?.argument === selected.argument && receiver.composition === undefined) authored = receiver.source;
    else if (writtenIndex !== null && writtenIndex < direct.length) {
      if (!admit(scope, "edges")) return null;
      const original = direct[writtenIndex];
      const actual = original === undefined ? undefined : sourceType(scope, { kind: "annotation", node: original });
      if (scope.meter.refusal !== null) return null;
      if (actual?.type === selected.argument && actual.causes.length === 0) authored = original ?? null;
    }
    let use: ComposedUnionUse | DeclaredArgumentsUse | MergedSlotUse | null = restArgumentForSlot(rest, selected);
    if (use === null && authored === null) {
      const group = selected.argument === selected.parameter ? slot.parameters : mergedArgumentGroup(scope, selected.argument);
      if (scope.meter.refusal !== null) return null;
      if (group !== null) use = { kind: "merged-slot", type: selected.argument, declarations: group };
    }
    const step: RawComponentStep = { kind: "argument-place", index };
    const operation = authored === null ? null : signatureAnnotationOperator(scope, authored, authored);
    if (scope.meter.refusal !== null) return null;
    const argument = authored === null || use !== null
      ? selectedOperand(scope, parent, selected.argument, step, false, use)
      : rawType(scope, () => withoutTypeCause(selected.argument), appendComponent(scope, parent, step), operation ?? authored);
    if (argument === null) return null;
    arguments_.push(argument);
  }
  const readonly = nativeArrayReadonly(scope, selectedType, application.arguments);
  return scope.meter.refusal !== null ? null : { kind: "merged-interface-dependency", group, arguments: arguments_, nativeArrayReadonly: readonly };
}

function authoredOperatorComponent(scope: CaptureScope, component: RawComponent | undefined, operator: RawNodeRef,
  source: OriginalTypeUse | null): boolean {
  if (component === undefined) return false;
  if (component.path === null) return sameSource(component.root, operator);
  if (source === null || !("module" in source) || !sameSource(source, operator)) return false;
  const ast = scope.checked.ast;
  let current = admittedTypeUse(scope, operator);
  let cursor = component;
  while (cursor.path?.step.kind === "argument-place" || cursor.path?.step.kind === "union-member" ||
    cursor.path?.step.kind === "intersection-member") {
    if (!admit(scope, "edges")) return false;
    const parent = ast.parent(current);
    const step = cursor.path.step;
    if (step.kind === "argument-place") {
      const argument = writtenApplication(scope, parent)?.arguments[step.index];
      if (argument === undefined || argument !== current) return false;
    } else {
      const members = (step.kind === "union-member" ? ast.as.AsUnionTypeNode(parent) : ast.as.AsIntersectionTypeNode(parent))?.Types?.Nodes;
      if (members === undefined) return false;
      let matched = false;
      for (let index = 0; index < members.length; ++index) {
        if (!admit(scope, "edges")) return false;
        if (members[index] === current) { matched = true; break; }
      }
      if (!matched) return false;
    }
    const prefix = cursor.path.prefix;
    if (prefix === null) return parent === admittedTypeUse(scope, component.root);
    const previous = scope.tables.components[prefix];
    if (previous?.id !== prefix || previous.id >= cursor.id || !sameSource(previous.root, component.root)) return false;
    current = parent;
    cursor = previous;
  }
  if (cursor.path?.prefix !== null) return false;
  const step = cursor.path.step;
  if (step.kind !== "parameter" && step.kind !== "result") return false;
  if (cursor === component) return true;
  if (!admit(scope, "edges")) return false;
  const signature = scope.tables.signatures[step.signature];
  if (signature?.id !== step.signature || signature.target !== null || signature.composition !== null ||
    !sameSource(signature.owner, component.root)) return false;
  const reference = step.kind === "parameter" ? signature.parameters[step.index]?.declaration ?? null : signature.declaration;
  const declaration = reference === null ? undefined : admittedTypeUse(scope, reference);
  return current !== undefined && ast.typeNode(declaration) === current;
}

function lexicalSubstitution(scope: CaptureScope, type: Type, syntax: Node, position: RawComponentId): RawTypeForm | undefined | null {
  const ast = scope.checked.ast;
  if (ast.kindName(syntax) !== "KindTypeReference") return undefined;
  const parent = ast.parent(syntax);
  const indexed = ast.kindName(parent) === "KindIndexedAccessType" && ast.as.AsIndexedAccessTypeNode(parent)?.IndexType === syntax;
  const branch = indexed ? parent : syntax;
  const conditionalNode = indexed ? ast.parent(parent) : parent;
  const conditional = ast.kindName(conditionalNode) === "KindConditionalType" ? ast.as.AsConditionalTypeNode(conditionalNode) : undefined;
  if (conditionalNode === undefined || conditional === undefined || conditional.TrueType !== branch)
    return indexed ? mappedSubstitution(scope, type, syntax, position) : undefined;
  if (!admit(scope, "edges")) return null;
  const substitution = scope.shape.getSubstitutionComponents(type);
  if (substitution === undefined) return undefined;
  const reference = ast.as.AsTypeReferenceNode(syntax);
  const symbol = scope.checker.getTypeSymbol(substitution.base);
  if (reference === undefined || symbol === undefined || scope.checker.getSymbolAtLocation(reference.TypeName) !== symbol)
    return throwInvariant(invariant("A lexical substitution must retain the actual referenced type parameter."));
  const operator = referenceTo(scope, scope.program, conditionalNode);
  if (scope.meter.refusal !== null) return null;
  if (operator === null) return throwInvariant(invariant("A lexical substitution requires its actual admitted conditional."));
  const base = authoredOperatorOperand(scope, conditional.CheckType, substitution.base);
  if (base === null) return null;
  const constraint = authoredOperatorOperand(scope, conditional.ExtendsType, substitution.constraint);
  if (constraint === null) return null;
  return { kind: "substitution", operator, base, constraint, scope: { kind: "conditional" } };
}

function mappedSubstitution(scope: CaptureScope, type: Type, syntax: Node, position: RawComponentId): RawTypeForm | undefined | null {
  const substitution = scope.shape.getSubstitutionComponents(type);
  if (substitution === undefined) return undefined;
  if (!admit(scope, "edges")) return null;
  const ast = scope.checked.ast;
  const baseSymbol = scope.checker.getTypeSymbol(substitution.base);
  const declarations = scope.checker.getSymbolDeclarations(baseSymbol);
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  const owner = ast.parent(declaration);
  if (declaration === undefined || owner === undefined || ast.kindName(owner) !== "KindMappedType") return undefined;
  const mapped = ast.as.AsMappedTypeNode(owner);
  const source = ast.as.AsTypeReferenceNode(syntax);
  if (baseSymbol === undefined || mapped?.TypeParameter !== declaration || mapped.Type === undefined || mapped.NameType !== undefined ||
    source === undefined || scope.checker.getSymbolAtLocation(source.TypeName) !== baseSymbol ||
    scope.checker.getDeclaredTypeOfSymbol(baseSymbol) !== substitution.base) return undefined;
  let child: Node | undefined = syntax;
  while (child !== mapped.Type) {
    if (!admit(scope, "edges")) return null;
    if (child === undefined || child === owner) return undefined;
    child = ast.parent(child);
  }
  const component = scope.tables.components[position];
  if (component === undefined || component.id !== position)
    return throwInvariant(invariant("A lexical mapped substitution requires its actual operand component."));
  const operator = referenceTo(scope, scope.program, owner);
  if (scope.meter.refusal !== null) return null;
  const parameter = referenceTo(scope, scope.program, declaration);
  if (scope.meter.refusal !== null) return null;
  if (operator === null || parameter === null) return throwInvariant(invariant("A mapped key must retain its admitted binder and owner."));
  const base = rawType(scope, () => withoutTypeCause(substitution.base),
    appendComponent(scope, component, { kind: "projection-source" }), null);
  if (base === null) return null;
  const constraint = rawType(scope, () => withoutTypeCause(substitution.constraint),
    appendComponent(scope, component, { kind: "projection-constraint" }), null);
  return constraint === null ? null : { kind: "substitution", operator, base, constraint, scope: { kind: "mapped", parameter } };
}

function mappedProjection(scope: CaptureScope, type: Type, position: RawComponentId, syntax: Node,
  source: OriginalTypeUse | null): RawTypeForm | undefined | null {
  if (!admit(scope, "edges")) return null;
  const ast = scope.checked.ast;
  const declarations = scope.checker.getSymbolDeclarations(scope.checker.getTypeSymbol(type));
  if (declarations.length !== 1 || declarations[0] !== syntax) return undefined;
  const written = ast.as.AsMappedTypeNode(syntax);
  const parameter = written?.TypeParameter;
  const binder = ast.as.AsTypeParameterDeclaration(parameter);
  if (written === undefined || parameter === undefined || binder?.Constraint === undefined ||
    ast.parent(parameter) !== syntax || written.Type === undefined) return undefined;
  const actual = sourceType(scope, { kind: "annotation", node: syntax });
  if (scope.meter.refusal !== null) return null;
  if (actual?.type !== type || actual.causes.length !== 0) return undefined;
  const operator = referenceTo(scope, scope.program, syntax);
  if (scope.meter.refusal !== null) return null;
  const declaration = referenceTo(scope, scope.program, parameter);
  if (scope.meter.refusal !== null) return null;
  const qualified = operator !== null && authoredOperatorComponent(scope, scope.tables.components[position], operator, source);
  if (scope.meter.refusal !== null) return null;
  if (operator === null || declaration === null || !qualified)
    return throwInvariant(invariant("A mapped formula requires its actual admitted defining component and binder."));
  const domain = authoredOperatorOperand(scope, binder.Constraint, undefined);
  if (domain === null) return null;
  const remap = written.NameType === undefined ? null : authoredOperatorOperand(scope, written.NameType, undefined);
  if (written.NameType !== undefined && remap === null) return null;
  const value = authoredOperatorOperand(scope, written.Type, undefined);
  if (value === null) return null;
  const modification = (token: Node | undefined) => token === undefined ? "preserve"
    : ast.kindName(token) === "KindMinusToken" ? "remove" : "add";
  return { kind: "mapped-projection", operator, parameter: declaration, domain, remap, value,
    readonly: modification(written.ReadonlyToken), optional: modification(written.QuestionToken) };
}

function templateLiteral(scope: CaptureScope, position: RawComponentId, type: Type): RawTypeForm | null {
  const template = scope.shape.getTemplateLiteralComponents(type);
  if (template === undefined) return { kind: "scalar", scalar: "string" };
  if (!admit(scope, "edges")) return null;
  const parent = scope.tables.components[position];
  const head = template.texts[0];
  if (parent === undefined || head === undefined || template.types.length === 0)
    return throwInvariant(invariant("A native template literal requires its actual texts and placeholders."));
  if (!admit(scope, "edges", head.length) || !admit(scope, "facts")) return null;
  const spans: { readonly type: RawTypeId; readonly tail: string }[] = [];
  for (let index = 0; index < template.types.length; index += 1) {
    if (!admit(scope, "edges", 2) || !admit(scope, "facts")) return null;
    const operand = template.types[index];
    const tail = template.texts[index + 1];
    if (tail === undefined || operand === undefined)
      return throwInvariant(invariant("A native template literal requires every actual placeholder and text."));
    if (!admit(scope, "edges", tail.length)) return null;
    const type = rawType(scope, () => withoutTypeCause(operand),
      appendComponent(scope, parent, { kind: "template-span", index }), null);
    if (type === null) return null;
    spans.push({ type, tail });
  }
  return { kind: "template-literal", head, spans };
}

function sourceEnvironment(scope: CaptureScope, type: Type): RawTypeForm | null {
  if (!admit(scope, "edges")) return null;
  const existing = scope.tables.globalEnvironment;
  if (existing !== null) return existing;
  const members: RawMemberHeader[] = [];
  const admission = nativeCaptureAdmission(scope);
  const acquired = scope.shape.getObjectPropertyHeaders(type, admission);
  if (acquired.kind === "refused") return null;
  if (acquired.kind === "unavailable") return throwInvariant(invariant("The actual checked global object requires its complete member inventory."));
  for (let position = 0; position < acquired.value.length; position += 1) {
    if (!admit(scope, "facts")) return null;
    const selected = acquired.value.read(position, admission);
    if (selected.kind === "refused") return null;
    if (selected.kind === "unavailable") return throwInvariant(invariant("The actual global property retains its owning checker."));
    const header = selected.value;
    const declarations: RawNodeRef[] = [];
    const origins: RawMemberOrigin[] = [];
    if (header.intrinsicOrigin !== undefined) {
      if (!admit(scope, "facts")) return null;
      origins.push({ kind: "intrinsic", symbol: header.intrinsicOrigin, access: "read" });
      if (!header.readonly) {
        if (!admit(scope, "facts")) return null;
        origins.push({ kind: "intrinsic", symbol: header.intrinsicOrigin, access: "write" });
      }
    } else {
      const seen = new Set<Node>();
      for (let rootIndex = 0; rootIndex < header.rootSymbols.length; rootIndex += 1) {
        if (!admit(scope, "edges")) return null;
        const root = header.rootSymbols[rootIndex];
        if (root === undefined) return throwInvariant(invariant("A global property requires its actual root symbols."));
        const nodes = scope.checker.getSymbolDeclarations(root);
        for (let index = 0; index < nodes.length; index += 1) {
          if (!admit(scope, "edges")) return null;
          const node = nodes[index];
          if (node === undefined) return throwInvariant(invariant("A global declaration group must be dense."));
          if (seen.has(node)) continue;
          seen.add(node);
          const kind = scope.checked.ast.kindName(node);
          if (kind === "KindInterfaceDeclaration" || kind === "KindTypeAliasDeclaration") continue;
          const declaration = referenceTo(scope, scope.program, node);
          if (scope.meter.refusal !== null) return null;
          if (declaration === null)
            return throwInvariant(invariant("A global value declaration must retain its actual admitted source."));
          if (!admit(scope, "facts") || !admit(scope, "facts")) return null;
          declarations.push(declaration);
          origins.push({ kind: "declaration", declaration, access: "read" });
          if (!header.readonly) {
            if (!admit(scope, "facts")) return null;
            origins.push({ kind: "declaration", declaration, access: "write" });
          }
        }
      }
      if (declarations.length === 0) return throwInvariant(invariant("A global property requires its actual value origins."));
    }
    members.push({ key: { kind: "text", value: header.name }, name: header.name, origins,
      declarations, getters: [], setters: [], optional: header.optional, readonly: header.readonly, readKind: "property" });
  }
  const result: Extract<RawTypeForm, { readonly kind: "source-environment" }> = { kind: "source-environment", members };
  scope.tables.globalEnvironment = result;
  return result;
}

function typeForm(scope: CaptureScope, type: Type, task: TypeCapture, originalUse: OriginalTypeUse | null,
  bindingUse: BindingUse | null, projection: ProjectedOperandUse | null): RawTypeForm | null {
  const { position } = task;
  const shape = scope.shape;
  const syntax = originalUse === null ? undefined : admittedTypeUse(scope, originalUse);
  if (syntax !== undefined) {
    if (scope.checked.ast.kindName(syntax) === "KindMappedType") {
      const mapped = mappedProjection(scope, type, position, syntax, originalUse);
      if (mapped !== undefined) return mapped;
    }
    const substitution = lexicalSubstitution(scope, type, syntax, position);
    if (substitution !== undefined) return substitution;
    if (scope.checked.ast.kindName(syntax) === "KindTypeOperator" && scope.checked.ast.operatorKindName(syntax) === "KindKeyOfKeyword") {
      if (!admit(scope, "edges")) return null;
      const open = shape.getKeyOfComponents(type);
      if (open !== undefined) {
        const ast = scope.checked.ast.as.AsTypeOperatorNode(syntax);
        const operator = referenceTo(scope, scope.program, syntax);
        if (scope.meter.refusal !== null) return null;
        const associated = operator !== null && authoredOperatorComponent(scope, scope.tables.components[position], operator, originalUse);
        if (scope.meter.refusal !== null) return null;
        if (open.indexFlags !== 0 || ast === undefined || operator === null || !associated)
          return throwInvariant(invariant("An open keyof requires its actual ordinary native key domain and authored operator."));
        const target = authoredOperatorOperand(scope, ast.Type, open.target);
        return target === null ? null : { kind: "keyof", operator, target };
      }
    }
  }
  if (syntax !== undefined && scope.checked.ast.kindName(syntax) === "KindConditionalType") {
    if (!admit(scope, "edges")) return null;
    const answer = shape.getConditionalComponents(type);
    if (answer !== undefined) {
      const parent = scope.tables.components[position];
      const ast = scope.checked.ast.as.AsConditionalTypeNode(syntax);
      const operator = referenceTo(scope, scope.program, syntax);
      if (scope.meter.refusal !== null) return null;
      const associated = operator !== null && authoredOperatorComponent(scope, parent, operator, originalUse);
      if (scope.meter.refusal !== null) return null;
      if (answer.declaration !== syntax || ast === undefined || operator === null || !associated)
        throw new TypeError("front: a direct conditional requires its actual operator");
      const inferParameters = conditionalBinders(scope, ast.ExtendsType, answer.inferParameters);
      if (inferParameters === null) return null;
      const check = authoredOperatorOperand(scope, ast.CheckType, answer.checkType);
      if (check === null) return null;
      const extended = authoredOperatorOperand(scope, ast.ExtendsType, answer.extendsType);
      if (extended === null) return null;
      const whenTrue = authoredOperatorOperand(scope, ast.TrueType, answer.trueBranch?.type);
      if (whenTrue === null) return null;
      const whenFalse = authoredOperatorOperand(scope, ast.FalseType, answer.falseBranch?.type);
      if (whenFalse === null) return null;
      return { kind: "conditional", operator, check, extends: extended, whenTrue: { kind: "ready", type: whenTrue },
        whenFalse: { kind: "ready", type: whenFalse }, distributive: answer.distributive,
        inferParameters, application: null };
    }
  }
  if (syntax !== undefined && scope.checked.ast.kindName(syntax) === "KindIndexedAccessType") {
    if (!admit(scope, "edges")) return null;
    const components = shape.getIndexedAccessComponents(type);
    if (components !== undefined) {
      const ast = scope.checked.ast.as.AsIndexedAccessTypeNode(syntax);
      const parent = scope.tables.components[position];
      const operator = referenceTo(scope, scope.program, syntax);
      if (scope.meter.refusal !== null) return null;
      const associated = operator !== null && authoredOperatorComponent(scope, parent, operator, originalUse);
      if (scope.meter.refusal !== null) return null;
      if (ast === undefined || ast.ObjectType === undefined || ast.IndexType === undefined || operator === null || !associated)
        return throwInvariant(invariant("An open indexed annotation requires its actual defining operator component."));
      const object = authoredOperatorOperand(scope, ast.ObjectType, components.objectType);
      if (object === null) return null;
      const index = authoredOperatorOperand(scope, ast.IndexType, components.indexType);
      if (index === null) return null;
      return { kind: "indexed-access", operator, object, index };
    }
  }
  const selected = scope.tables.components[position];
  if (syntax === undefined && (type.flags & TypeFlagsConditional) !== 0 && selected !== undefined) {
    const endpoint = selected.path?.step;
    if (endpoint?.kind === "projection-index") return projectedConditional(scope, type, selected, null);
    if (endpoint?.kind === "member") return projectedConditional(scope, type, selected, endpoint.declaration);
  }
  if (selected !== undefined && ((type.flags & TypeFlagsConditional) !== 0 || type.alias !== undefined)) {
    const alias = deferredAliasApplication(scope, type, selected, syntax);
    if (alias !== null || scope.meter.refusal !== null) return alias;
  }
  const binder = writtenForwardedOperand(scope, type, syntax, "binder");
  if (scope.meter.refusal !== null) return null;
  if (binder !== undefined && scope.checked.ast.kindName(binder) === "KindThisType") {
    if (!admit(scope, "edges")) return null;
    const owner = authoredSelfOwner(scope, type, binder);
    if (scope.meter.refusal !== null) return null;
    if (owner === undefined) throw new TypeError("front: a self type requires its actual authored interface method owner");
    const authored = sourceType(scope, { kind: "annotation", node: binder });
    if (scope.meter.refusal !== null) return null;
    if (authored?.type !== type || authored.causes.length !== 0)
      throw new TypeError("front: a self type requires its actual authored checker answer");
    const source = referenceTo(scope, scope.program, owner);
    if (scope.meter.refusal !== null) return null;
    if (source === null) return throwInvariant(invariant("A self type requires its actual captured interface owner."));
    return { kind: "self", owner: source };
  }
  const symbol = scope.checker.getTypeSymbol(type);
  const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
  if (symbol !== undefined && declarations.length === 0 && shape.isGlobalScopeObject(type)) return sourceEnvironment(scope, type);
  let interfaceFragments = 0;
  let interfaceFragment: Node | undefined;
  let classFacet = false;
  for (let index = 0; index < declarations.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const candidate = declarations[index];
    if (candidate === undefined) return throwInvariant(invariant("A type's declaration inventory cannot contain an absent row."));
    const kind = scope.checked.ast.kindName(candidate);
    if (kind === "KindInterfaceDeclaration") { interfaceFragments += 1; interfaceFragment = candidate; }
    if (kind === "KindClassDeclaration") classFacet = true;
    if (kind !== "KindTypeParameter") continue;
    if (declarations.length > 1 && originalUse !== null && syntax === undefined)
      return throwInvariant(invariant("An authored type occurrence must retain its actual numbered checker node."));
    const declaration = declarations.length === 1 ? candidate : symbol === undefined ? undefined : selectMergedParameter(scope, symbol, declarations, binder);
    if (scope.meter.refusal !== null) return null;
    if (declaration === undefined) {
      if (symbol !== undefined && originalUse === null && bindingUse === null && scope.tables.activeMergedArguments.size !== 0) {
        const slot = activeMergedSlot(scope, type, symbol);
        if (slot !== null || scope.meter.refusal !== null) return slot;
      }
      throw new TypeError("front: a merged type parameter requires its actual selected declaration association");
    }
    const ast = scope.checked.ast;
    const parameter = referenceTo(scope, scope.program, declaration);
    if (scope.meter.refusal !== null) return null;
    if (parameter === null) return throwInvariant(invariant("A checked type parameter declaration must belong to the actual captured source domain."));
    const selected = ast.as.AsTypeParameterDeclaration(declaration);
    if (selected === undefined) return throwInvariant(invariant("A checked type parameter must retain its actual syntax payload."));
    const read = (node: Node | undefined): RawTypeId | null => {
      if (node === undefined) return null;
      const source = referenceTo(scope, scope.program, node);
      return source === null ? null : rawType(scope, () => sourceType(scope, { kind: "annotation", node }), component(scope, source, null), source);
    };
    const constraint = read(selected.Constraint);
    if (scope.meter.refusal !== null) return null;
    const defaultType = read(selected.DefaultType);
    if (scope.meter.refusal !== null) return null;
    return { kind: "parameter", parameter, constraint, default: defaultType };
  }
  const literal = shape.getNumericLiteralTypeValue(type) !== undefined || shape.getStringLiteralTypeValue(type) !== undefined ||
    shape.getBooleanLiteralTypeValue(type) !== undefined;
  // The checker's `boolean` is a union of its two literal types and is boolean-like as a whole; any other union is not a scalar.
  if (!literal && !shape.isIntersection(type) && shape.isBooleanLike(type)) return { kind: "scalar", scalar: "boolean" };
  if (!literal && !shape.isUnion(type) && !shape.isIntersection(type)) {
    if (shape.isNumberLike(type)) return { kind: "scalar", scalar: "number" };
    if (shape.isStringLike(type)) return templateLiteral(scope, position, type);
    if (shape.isBigIntLike(type)) return { kind: "scalar", scalar: "bigint" };
    if (shape.isSymbolLike(type)) return { kind: "scalar", scalar: "symbol" };
    if (shape.isAny(type)) return { kind: "scalar", scalar: shape.isIntrinsicAliasMarker(type) ? "alias-marker" : "any" };
    if (shape.isUnknown(type)) return { kind: "scalar", scalar: "unknown" };
    if (shape.isNever(type)) return { kind: "scalar", scalar: "never" };
    if (shape.isNullish(type)) {
      const flags = shape.intrinsicNullishFlags(type);
      if (flags.null === flags.undefined) return throwInvariant(invariant("An atomic nullish checker type must identify exactly one actual source absence spelling."));
      return { kind: "scalar", scalar: flags.null ? "null" : "undefined" };
    }
    if (shape.isVoidLike(type)) return { kind: "scalar", scalar: "void" };
    if (shape.isNonPrimitive(type)) return { kind: "scalar", scalar: "object" };
  }
  if (shape.isUnion(type) || shape.isIntersection(type)) {
    const kind = shape.isUnion(type) ? "union" : "intersection";
    const parent = scope.tables.components[position];
    if (parent === undefined) return throwInvariant(invariant("A captured composite type requires its actual original component."));
    const actual = shape.getUnionOrIntersectionTypes(type);
    let written = bindingUse?.kind === "authored-formal-arms" ? bindingUse : null;
    const syntaxKind = scope.checked.ast.kindName(syntax);
    if (bindingUse === null && (syntaxKind === "KindUnionType" || syntaxKind === "KindIntersectionType") && syntax !== undefined) {
      if (!admit(scope, "edges")) return null;
      const source = sourceType(scope, { kind: "annotation", node: syntax });
      if (scope.meter.refusal !== null) return null;
      if (source?.type === type && source.causes.length === 0) written = authoredCompoundArms(scope, type, syntax, "direct", () => actual);
      if (scope.meter.refusal !== null) return null;
    }
    const members: RawTypeId[] = [];
    for (let index = 0; index < actual.length; index += 1) {
      if (!admit(scope, "edges")) return null;
      const member = actual[index];
      if (member === undefined) return throwInvariant(invariant("A checked composite type cannot contain a missing member."));
      const position = appendComponent(scope, parent, { kind: kind === "union" ? "union-member" : "intersection-member", index });
      if (position === null) return null;
      const composed = bindingUse?.kind === "composed-union" ? bindingUse : null;
      const association = bindingUse?.kind === "callback" && bindingUse.type === member ? bindingUse
        : composed?.reference === member ? composed.argument : null;
      const source = bindingUse?.kind === "union-arm" && bindingUse.type === member ? bindingUse.source
        : written?.sources.get(member) ?? (composed?.bare === member ? composed.source : null);
      const operator = source === null || source === undefined ? null : signatureAnnotationOperator(scope, source, source);
      if (scope.meter.refusal !== null) return null;
      const captured = rawType(scope, () => withoutTypeCause(member), position, operator ?? source, association);
      if (captured === null) return null;
      members.push(captured);
    }
    return { kind, members };
  }
  if (shape.isTuple(type)) return captureTuple(scope, type, position, originalUse,
    bindingUse?.kind === "tuple-projection" || bindingUse?.kind === "contextual-tuple" || bindingUse?.kind === "literal-tuple" ? bindingUse : null, projection);
  if (symbol !== undefined && interfaceFragments === 1 && interfaceFragment !== undefined) {
    const native = declarations.length === 1 ? undefined : nativeInterfaceDeclarations(scope, shape.getTypeReferenceTarget(type) ?? type);
    if (native === null) return null;
    if (native !== undefined && (native.length !== 1 || native[0] !== interfaceFragment))
      return throwInvariant(invariant("A native instance must retain its actual interface facet declaration."));
    if (declarations.length === 1 || native !== undefined) {
      const declaration = interfaceFragment;
      const source = referenceTo(scope, scope.program, declaration);
      if (scope.meter.refusal !== null) return null;
      if (source === null) return throwInvariant(invariant("A declared interface type requires its actual admitted declaration."));
      const parameters: RawNodeRef[] = [];
      for (const parameter of scope.checked.ast.typeParameters(declaration)) {
        if (!admit(scope, "edges")) return null;
        if (parameter === undefined) return throwInvariant(invariant("An interface's actual parameter inventory must be dense."));
        const reference = referenceTo(scope, scope.program, parameter);
        if (scope.meter.refusal !== null) return null;
        if (reference === null) return throwInvariant(invariant("An interface parameter must retain its actual admitted declaration."));
        parameters.push(reference);
      }
      const infos = parameters.length === 0 ? [] : shape.getTypeReferenceArgumentInfos(type);
      if (infos === undefined) return throwInvariant(invariant("A selected generic interface requires its actual checked argument associations."));
      const qualified = bindingUse?.kind === "declared-arguments" ? bindingUse
        : bindingUse === null && originalUse !== null && infos.length !== 0 && syntax !== undefined
          ? authoredArgumentSources(scope, syntax, symbol, infos, () => {
            if (!("Kind" in originalUse)) return true;
            if (!admit(scope, "edges")) return false;
            const actual = sourceType(scope, { kind: "annotation", node: syntax });
            return actual?.type === type && actual.causes.length === 0;
          }, true) : null;
      if (scope.meter.refusal !== null) return null;
      const parent = scope.tables.components[position];
      if (parent === undefined) return throwInvariant(invariant("A declared type requires its actual captured component."));
      let rest: DeclaredRestUse | null = null;
      if (bindingUse?.kind === "declared-rest" && bindingUse.type === type && type.alias === undefined) {
        if (!admit(scope, "edges")) return null;
        if (shape.getTypeReferenceTarget(type) === bindingUse.nativeTarget) rest = bindingUse;
      }
      const readonly = nativeArrayReadonly(scope, type, infos);
      if (scope.meter.refusal !== null) return null;
      const nativeElement = readonly !== null && scope.sourcePrimitiveFacts && bindingUse === null
        ? authoredNativeArrayElement(scope, syntax, type, symbol, infos) : null;
      if (scope.meter.refusal !== null) return null;
      const arguments_: RawTypeArgument[] = [];
      let local = 0;
      for (let index = 0; index < infos.length; index += 1) {
        if (!admit(scope, "edges")) return null;
        const info = infos[index];
        const parameter = parameters[index];
        if (info === undefined || parameter === undefined) return throwInvariant(invariant("An interface's checked arguments must match its actual ordered parameters."));
        const ordinal = info.scope === "local" ? local++ : null;
        const capturedUse = qualified?.slots.get(info.parameter);
        const receiverSlot = bindingUse?.kind === "receiver" && bindingUse.type === type && bindingUse.target === symbol
          ? bindingUse.slots.get(info.parameter) : undefined;
        const restArgument = restArgumentForSlot(rest, info);
        const sourceUse = capturedUse !== undefined && capturedUse.argument === info.argument ? capturedUse
          : receiverSlot !== undefined && info.argument === receiverSlot.argument
            ? { authored: receiverSlot.source, selected: receiverSlot.source }
            : restArgument !== null && rest !== null ? { authored: rest.element, selected: null }
            : index === 0 && nativeElement !== null ? nativeElement
            : originalUse !== null && ordinal !== null && shape.isTuple(info.argument)
              ? authoredTupleArgument(scope, type, originalUse, info.argument, ordinal) : null;
        if (scope.meter.refusal !== null) return null;
        const explicitTypeNode = sourceUse === null ? null : referenceTo(scope, scope.program, sourceUse.authored);
        if (scope.meter.refusal !== null) return null;
        if (sourceUse !== null && explicitTypeNode === null)
          return throwInvariant(invariant("A declared argument must retain its actual authored type occurrence."));
        const position = appendComponent(scope, parent, { kind: "argument-place", index });
        if (position === null) return null;
        const selected = sourceUse?.selected;
        const operand = selected != null && "Kind" in selected ? signatureAnnotationOperator(scope, selected, selected) : null;
        if (scope.meter.refusal !== null) return null;
        const tupleArgument: ProjectedOperandUse | null = selected === undefined && originalUse === null && task.bindingUse === null
          && parent.path?.step.kind === "result" && shape.isTuple(info.argument)
          ? { kind: "projected-operand", type: info.argument, role: "declared-tuple-argument" } : null;
        const argument = rawType(scope, () => withoutTypeCause(info.argument), position,
          operand ?? (selected != null && "Kind" in selected ? selected : null),
          selected != null && !("Kind" in selected) ? selected : restArgument ?? tupleArgument);
        if (argument === null) return null;
        arguments_.push({ parameter, declaration: null, argument: available(argument), explicitTypeNode, defaultTypeNode: null, scope: info.scope });
      }
      if (arguments_.length !== parameters.length) return throwInvariant(invariant("Every selected interface parameter requires its actual checked argument."));
      let extent: RawFact<null> = notProvided();
      if (scope.closedOrdinaryExtent) {
        if (snapshotDeclaration(scope.program, source)) extent = available(null);
        else {
          const provider = providerDeclaration(scope, declaration, source);
          if (provider === null) return null;
          if (provider !== undefined) extent = available(null);
        }
      }
      return scope.meter.refusal !== null ? null
        : { kind: "declared", declaration: source, facet: "instance", parameters, arguments: arguments_, definition: null,
            extent, nativeArrayReadonly: readonly };
    }
  }
  const merged = interfaceFragments > 1 && !classFacet ? symbol : undefined;
  const preparing = bindingUse?.kind === "interface-description";
  if (preparing && (merged === undefined || bindingUse.target !== type))
    return throwInvariant(invariant("An interface description requires its actual neutral target."));
  if (merged !== undefined && !preparing) {
    const application = nativeInterfaceApplication(scope, type);
    if (application === null) return null;
    const alias = type.alias?.symbol;
    const qualified = (bindingUse?.kind === "declared-rest" && alias === undefined ||
      bindingUse?.kind === "receiver" && bindingUse.target === merged && (alias === undefined || bindingUse.forwardedAlias === alias)) &&
      bindingUse.type === type && bindingUse.nativeTarget === application.target ? bindingUse : null;
    return mergedInterfaceDependency(scope, position, application, qualified, originalUse, type);
  }
  if (scope.meter.refusal !== null) return null;
  const expandMerged = preparing ? merged : undefined;
  if (!admit(scope, "edges")) return null;
  const structured = shape.getStructuredInventory(type, nativeCaptureAdmission(scope));
  if (structured.kind === "refused") return null;
  if (structured.kind === "unavailable") return throwInvariant(invariant("A checked type retains its actual owning structured inventory."));
  const { signatures, callSignatureCount, indexes: selectedIndexes, properties } = structured.value;
  const hasInventory = signatures.length !== 0 || selectedIndexes.length !== 0;
  const original = !hasInventory && declarations.length === 1 ? declarations[0] : undefined;
  const syntaxKind = original === undefined ? null : scope.checked.ast.kindName(original);
  let authoredObject = syntaxKind === "KindObjectLiteralExpression" || syntaxKind === "KindTypeLiteral";
  if (!hasInventory && !properties.mayHaveRows && !authoredObject && syntax !== undefined
    && scope.checked.ast.kindName(syntax) === "KindTypeLiteral") {
    if (!admit(scope, "edges")) return null;
    const written = scope.checked.ast.as.AsTypeLiteralNode(syntax);
    if (written?.Members?.Nodes.length === 0) {
      const checked = sourceType(scope, { kind: "annotation", node: syntax });
      if (scope.meter.refusal !== null) return null;
      authoredObject = checked?.type === type && checked.causes.length === 0;
    }
  }
  if (hasInventory || properties.mayHaveRows || authoredObject || preparing) {
    if (!admit(scope, "facts")) return null;
    if (expandMerged !== undefined) scope.tables.pending.push({ kind: "merged-inventory-scope", symbol: expandMerged, type, enter: false });
    const inventory = rawMemberTableId(scope.tables.nextMember++);
    const root = scope.tables.components[position]?.root;
    if (root === undefined) return throwInvariant(invariant("A callable type has no captured component root."));
    const captureSignatures = (first: number, end: number, kind: "call" | "construct"): RawSignatureId[] | null => {
      const captured: RawSignatureId[] = [];
      for (let index = first; index < end; index += 1) {
        if (!admit(scope, "edges")) return null;
        const signature = signatures[index];
        if (signature === undefined) return throwInvariant(invariant("A callable inventory contains an absent signature."));
        const id = rawSignature(scope, signature, root, kind,
          bindingUse?.kind === "member" || bindingUse?.kind === "callback" ? bindingUse : null);
        if (id === null) return null;
        captured.push(id);
      }
      return captured;
    };
    const callSignatures = captureSignatures(0, callSignatureCount, "call");
    if (callSignatures === null) return null;
    const constructSignatures = captureSignatures(callSignatureCount, signatures.length, "construct");
    if (constructSignatures === null) return null;
    const indexes: RawIndexSignature[] = [];
    const parent = scope.tables.components[position];
    if (parent === undefined) return throwInvariant(invariant("An index inventory requires its actual captured type component."));
    const receiver = bindingUse?.kind === "receiver" && bindingUse.type === type ? bindingUse : null;
    const tupleSlot = receiver === null ? undefined : onlyReceiverSlot(receiver);
    let originalIndexes: OriginalIndexInventory | null | undefined;
    for (let index = 0; index < selectedIndexes.length; index += 1) {
      if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
      const selected = selectedIndexes[index];
      if (selected === undefined || selected.keyType === undefined || selected.valueType === undefined)
        return throwInvariant(invariant("A checked index inventory must retain its actual key and value types."));
      const mapped = declarations.length === 1 ? declarations[0] : undefined;
      const declaration = selected.declaration ?? (mapped !== undefined && scope.checked.ast.kindName(mapped) === "KindMappedType" ? mapped : undefined);
      if (declaration === undefined) throw new TypeError("front: a selected index without its actual declared or mapped source origin is not implemented");
      const origin = referenceTo(scope, scope.program, declaration);
      if (scope.meter.refusal !== null) return null;
      if (origin === null) return throwInvariant(invariant("A selected index origin must belong to the actual captured source domain."));
      const key = rawTypeId(scope.tables.nextType);
      const capturedKey = rawType(scope, () => withoutTypeCause(selected.keyType),
        appendComponent(scope, parent, { kind: "index-key", origin, key }), null);
      if (capturedKey === null) return null;
      if (capturedKey !== key) return throwInvariant(invariant("An index selector must retain its actual captured row key."));
      let source: Node | undefined;
      if (selected.declaration === declaration && scope.checked.ast.kindName(declaration) === "KindIndexSignature" &&
        (selected.components.length === 0 || selected.components.length === 1 && selected.components[0] === declaration)) {
        if (!admit(scope, "edges")) return null;
        const written = scope.checked.ast.typeNode(declaration);
        const actual = written === undefined ? undefined : sourceType(scope, { kind: "annotation", node: written });
        if (scope.meter.refusal !== null) return null;
        if (actual?.type === selected.valueType && actual.causes.length === 0) source = written;
      }
      if (source === undefined && receiver !== null && tupleSlot?.declaration === null && selected.valueType === tupleSlot.argument) {
        if (originalIndexes === undefined) {
          if (!admit(scope, "edges")) return null;
          originalIndexes = shape.getTypeReferenceTarget(type) === receiver.nativeTarget
            ? { rows: shape.getIndexInfos(receiver.nativeTarget), origins: null } : null;
        }
        if (originalIndexes !== null) source = directIndexValueSource(scope, receiver, tupleSlot, selected, originalIndexes);
        if (scope.meter.refusal !== null) return null;
      }
      const selectedArgument = source === undefined ? selectedMergedIndexArgument(scope, type, selected) : null;
      if (scope.meter.refusal !== null) return null;
      const value = rawType(scope, () => withoutTypeCause(selected.valueType),
        appendComponent(scope, parent, { kind: "index-value", origin, key }), source ?? selectedArgument?.source ?? null, selectedArgument?.slot ?? null);
      if (value === null) return null;
      indexes.push({ origin, key, value, readonly: selected.readonly });
    }
    const members = capturedMembers(scope, type, properties, position, bindingUse?.kind === "receiver" ? bindingUse : null);
    if (members === null) return null;
    if (!hasInventory && !authoredObject && members.length === 0 && !preparing)
      throw new TypeError(`front: the captured form of the checker type ${scope.checker.typeToString(type)} is not implemented`);
    scope.tables.members[inventory] = { id: inventory, component: position, members, indexes, elementBinders: available([]),
      calls: callSignatures, constructs: constructSignatures };
    if (expandMerged !== undefined) scope.tables.pending.push({ kind: "merged-inventory-scope", symbol: expandMerged, type, enter: true });
    return { kind: "structure", inventory };
  }
  throw new TypeError(`front: the captured form of the checker type ${scope.checker.typeToString(type)} is not implemented`);
}

type CheckedMember = Extract<ResolvedSourcePropertyAccessInfo, { readonly kind: "member" }>;

function capturedIndexUse(scope: CaptureScope, occurrence: RawNodeRef, info: ResolvedSourceElementAccessInfo,
  declaration: Node, viewRead: { readonly position: RawComponentId; readonly answer: ResolvedSourceTypeInfo } | null):
  Extract<RawMemberUse, { readonly kind: "property" }> | null {
  if (!admit(scope, "edges")) return null;
  const selected = referenceTo(scope, scope.program, declaration);
  if (scope.meter.refusal !== null) return null;
  if (!admit(scope, "edges")) return null;
  const receiver = referenceTo(scope, scope.program, info.receiver.expression);
  if (scope.meter.refusal !== null) return null;
  if (!admit(scope, "edges")) return null;
  const key = referenceTo(scope, scope.program, info.argument.expression);
  if (scope.meter.refusal !== null) return null;
  if (selected === null || receiver === null || key === null)
    return throwInvariant(invariant("An indexed access must name its actual checked declaration and operand occurrences."));

  const receiverComponent = component(scope, receiver, null);
  if (receiverComponent === null) return null;
  const receiverType = rawType(scope, () => withoutTypeCause(info.receiver.type), receiverComponent, null);
  if (receiverType === null) return null;
  const keyComponent = component(scope, key, null);
  if (keyComponent === null) return null;
  const keyKind = scope.checked.ast.kindName(info.argument.expression);
  if (rawType(scope, () => withoutTypeCause(info.argument.type), keyComponent, null, null,
    keyKind === "KindNumericLiteral" || keyKind === "KindBigIntLiteral" ? info.argument.expression : null) === null) return null;

  const readComponent = info.sourceReadType === undefined ? null : viewRead?.position ?? component(scope, occurrence, null);
  if (scope.meter.refusal !== null) return null;
  const read = info.sourceReadType === undefined ? null
    : rawType(scope, () => viewRead?.answer ?? withoutTypeCause(info.sourceReadType), readComponent, null);
  if (scope.meter.refusal !== null) return null;
  const writeComponent = info.sourceWriteType === undefined ? null : component(scope, occurrence, null);
  if (scope.meter.refusal !== null) return null;
  const write = info.sourceWriteType === undefined ? null
    : rawType(scope, () => withoutTypeCause(info.sourceWriteType), writeComponent, null);
  if (scope.meter.refusal !== null || !admit(scope, "facts") || !admit(scope, "edges")) return null;

  return { kind: "property", occurrence, receiver, receiverComponent, receiverType, key, access: info.accessMode,
    callCallee: info.callCallee, optionalChain: info.optionalChain, chainContinuation: false, selectedDeclaration: selected,
    selectedDeclarations: [selected], nativeExtent: null, readDeclarations: read === null ? [] : [selected],
    writeDeclarations: write === null ? [] : [selected], read, write,
    arms: [{ kind: "index", receiver: receiverComponent,
      selection: { kind: info.nativeArray === null ? "index-signature" : "array-element", declarations: [selected] },
      key: keyComponent, read: readComponent, write: writeComponent, readonly: !info.writable }] };
}

function selectedMemberOf(scope: CaptureScope, node: Node, occurrence: RawNodeRef): CheckedMember | null {
  if (!admit(scope, "facts")) return null;
  const selector = scope.fieldSelectors?.get(occurrence.node);
  const acquired = scope.checker.acquireResolvedPropertyAccess(node, nativeCaptureAdmission(scope));
  if (acquired.kind === "refused") {
    if (acquired.stop !== scope.meter.refusal)
      return throwInvariant(invariant("A selected member acquisition must retain its actual first refusal."));
    return null;
  }
  if (acquired.kind === "unavailable" && selector !== undefined) return unavailableLayoutSelector(scope, selector);
  if (acquired.kind !== "complete" || acquired.value.kind !== "member" || acquired.value.expression !== node)
    throw new TypeError("front: a property access requires its actual selected member answer");
  return acquired.value;
}

function isNativeArrayExtent(scope: CaptureScope, info: CheckedMember, primary: Node, key: RawMemberKey): boolean {
  if (key.kind !== "text" || key.value !== "length" || info.accessMode !== "read" || info.callCallee
    || info.selectedDeclaration !== primary || info.selectedReadDeclaration !== primary || info.sourceReadType === undefined)
    return false;
  if (!admit(scope, "edges")) return false;
  const { ast } = scope.checked;
  if (ast.kindName(primary) !== "KindPropertySignature" || !scope.shape.isNumberLike(info.sourceReadType)) return false;
  const parent = ast.parent(primary);
  if (parent === undefined || ast.kindName(parent) !== "KindInterfaceDeclaration") return false;
  const receiver = info.receiver.type;
  const native = scope.shape.acquireNativeArrayType(receiver, nativeCaptureAdmission(scope));
  if (native.kind !== "complete" || !admit(scope, "edges")) return false;
  const name = ast.name(parent);
  if (name === undefined || !scope.shape.isTypeReference(receiver)) return false;
  const actualOwner = scope.checker.getSymbolAtLocation(name);
  return actualOwner !== undefined && actualOwner === scope.checker.getTypeSymbol(scope.shape.getTypeReferenceTarget(receiver));
}

function capturedMemberUse(scope: CaptureScope, occurrence: RawNodeRef, info: CheckedMember,
  viewRead: { readonly position: RawComponentId; readonly answer: ResolvedSourceTypeInfo } | null): RawMemberUse | null {
  const selector = scope.fieldSelectors?.get(occurrence.node);
  if (selector !== undefined) {
    if (!admit(scope, "edges")) return null;
    const nativeFormal = info.receiver.valueDeclaration;
    const formal = nativeFormal === undefined ? null : referenceTo(scope, scope.program, nativeFormal);
    if (scope.meter.refusal !== null) return null;
    if (formal === null || !sameSource(formal, selector.formal)) {
      const actual = scope.syntaxOf(selector.receiver.node);
      if (actual === undefined) return throwInvariant(invariant("A selector receiver retains its actual authored occurrence."));
      return layoutSyntaxFault(scope, actual, "A physical field selector must read its own authored formal.");
    }
  }
  if (info.optionalChain || info.selectedIndex !== undefined)
    throw new TypeError("front: selected optional or index-backed property transport is not implemented");
  const receiver = referenceTo(scope, scope.program, info.receiver.expression);
  if (scope.meter.refusal !== null) return null;
  if (receiver === null) return throwInvariant(invariant("A selected member receiver requires its actual source occurrence."));
  const selectedMember = info.selectedDeclaration;
  const ast = scope.checked.ast;
  if (selectedMember !== undefined && ast.kindName(selectedMember) === "KindEnumMember"
      && ast.kindName(info.receiver.expression) === "KindIdentifier" && info.accessMode === "read" && !info.callCallee) {
    if (!admit(scope, "edges")) return null;
    const parent = ast.parent(selectedMember);
    const enumName = parent === undefined ? undefined : ast.name(parent);
    const enumSymbol = enumName === undefined ? undefined : scope.checker.getSymbolAtLocation(enumName);
    const qualifier = scope.checker.getSymbolAtLocation(info.receiver.expression);
    if (enumSymbol !== undefined && qualifier !== undefined && scope.checker.getTypeSymbol(info.receiver.type) === enumSymbol) {
      const target = qualifier === enumSymbol ? qualifier : scope.checker.getAliasStep(qualifier)?.kind === "symbol"
        ? scope.checker.getAliasedSymbol(qualifier) : undefined;
      if (target === enumSymbol) {
        if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
        const nominal = scope.checker.getSymbolValueDeclaration(enumSymbol);
        if (nominal === undefined || ast.kindName(nominal) !== "KindEnumDeclaration")
          return throwInvariant(invariant("A selected enum member must have its actual nominal owner."));
        const owner = referenceTo(scope, scope.program, nominal);
        const member = referenceTo(scope, scope.program, selectedMember);
        if (scope.meter.refusal !== null) return null;
        if (owner === null || member === null)
          return throwInvariant(invariant("The selected enum and member belong to the actual source domain."));
        return { kind: "enum", occurrence, receiver, owner, member };
      }
    }
  }
  const receiverComponent = component(scope, receiver, null);
  if (receiverComponent === null) return null;
  const receiverSource = ast.kindName(info.receiver.expression) === "KindIdentifier" && scope.shape.isTypeReference(info.receiver.type)
    && admit(scope, "edges")
    ? declaredTupleRead(scope, info.receiver.type, info.receiver.valueDeclaration) : null;
  const receiverUse = receiverSource === null ? null : receiverBindingUse(scope, info.receiver.type, receiverSource);
  if (scope.meter.refusal !== null) return null;
  const receiverType = rawType(scope, () => withoutTypeCause(info.receiver.type), receiverComponent, receiverSource, receiverUse);
  if (receiverType === null || receiverComponent === null) return null;
  const property = info.property;
  if (property === null || property.symbol !== info.sourceSymbol)
    return throwInvariant(invariant("A selected property must show its actual native source member."));
  if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
  const primary = scope.checker.getSymbolValueDeclaration(property.symbol);
  if (primary === undefined) throw new TypeError("front: selected property transport requires its original member declaration");
  const captured = capturedDeclaredMember(scope, property, primary);
  if (captured === null) return null;
  const member = captured.header;
  if (selector !== undefined) {
    if (member.optional || member.readKind !== "property" || info.accessMode !== "read" || info.callCallee) {
      const actual = scope.syntaxOf(occurrence.node);
      if (actual === undefined) return throwInvariant(invariant("A field selector retains its actual authored property access."));
      return layoutSyntaxFault(scope, actual, "A physical field selector must read one non-optional stored property.");
    }
    scope.fieldSelectors?.delete(occurrence.node);
  }
  const source = (declaration: Node | undefined): RawNodeRef | null => {
    if (declaration === undefined) return null;
    if (!admit(scope, "edges")) return null;
    const reference = referenceTo(scope, scope.program, declaration);
    if (scope.meter.refusal !== null) return null;
    return reference ?? throwInvariant(invariant("A selected member declaration belongs to the actual captured source domain."));
  };
  const selected = source(info.selectedDeclaration);
  if (scope.meter.refusal !== null) return null;
  if (selected === null) throw new TypeError("front: selected property transport requires its actual source declaration");
  if (selectedMember === undefined || !captured.declarations.has(selectedMember))
    throw new TypeError("front: the selected declaration is missing from its actual receiver member inventory");
  const readDeclaration = source(info.selectedReadDeclaration);
  if (scope.meter.refusal !== null) return null;
  const writeDeclaration = source(info.selectedWriteDeclaration);
  if (scope.meter.refusal !== null) return null;
  const readComponent = info.sourceReadType === undefined ? null : viewRead?.position ?? component(scope, occurrence, null);
  if (scope.meter.refusal !== null) return null;
  const binding: MemberBindingUse | null = receiverUse !== null && member.readKind === "method"
    ? { kind: "member", receiver: receiverUse, declarations: captured.declarations } : null;
  const primitive = member.readKind === "property" ? primitiveFieldSource(scope, property, primary, info.sourceReadType ?? info.sourceWriteType) : null;
  if (scope.meter.refusal !== null) return null;
  const fieldRead = captureFieldSource(primitive, info.sourceReadType);
  const read = info.sourceReadType === undefined ? null
    : rawType(scope, () => viewRead?.answer ?? withoutTypeCause(info.sourceReadType), readComponent, fieldRead?.annotation ?? null,
      binding ?? fieldRead?.arm ?? null);
  if (info.sourceReadType !== undefined && read === null) return null;
  const writeComponent = info.sourceWriteType === undefined ? null : component(scope, occurrence, null);
  if (scope.meter.refusal !== null) return null;
  const fieldWrite = captureFieldSource(primitive, info.sourceWriteType);
  const write = info.sourceWriteType === undefined ? null
    : rawType(scope, () => withoutTypeCause(info.sourceWriteType), writeComponent, fieldWrite?.annotation ?? null, fieldWrite?.arm ?? null);
  if (info.sourceWriteType !== undefined && write === null) return null;
  if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
  const readDeclarations = readDeclaration === null ? [] : [readDeclaration];
  const writeDeclarations = writeDeclaration === null ? [] : [writeDeclaration];
  const nativeExtent = selector === undefined && isNativeArrayExtent(scope, info, primary, member.key) ? selected : null;
  if (scope.meter.refusal !== null) return null;
  return { kind: "property", occurrence, receiver, receiverComponent, receiverType, key: null, access: info.accessMode, callCallee: info.callCallee,
    optionalChain: info.optionalChain, chainContinuation: false, selectedDeclaration: selected,
    selectedDeclarations: member.declarations, readDeclarations, writeDeclarations, read, write, nativeExtent,
    arms: [{ kind: "member", receiver: receiverComponent, member,
      readDeclarations, writeDeclarations }] };
}

function snapshotDeclaration(program: CheckedProgram, reference: RawNodeRef): boolean {
  return OpenedProgram.file(program, reference.module)?.origin.kind === "snapshot";
}

function closedCoreInventory(program: CheckedProgram): Pick<CaptureScope,
  "emptyCoreInventory" | "emptyObservationInventory" | "closedOrdinaryPassing" | "closedOrdinaryExtent" | "closedOrdinaryApplication" | "sourcePrimitiveFacts"> {
  const contributions = OpenedProgram.contributions(program);
  const table = OpenedProgram.table(program);
  const noRoles = OpenedProgram.libraryData(program).every(entry => entry.roles.length === 0);
  const closedCheckerExtensions = contributions.compilerExtensions.length === 0 &&
    ExtensionTable.entries(table).every(entry => entry.kind === "semantics-module" || entry.kind === "declaration-provider");
  const closedOrdinaryPassing = contributions.safetyProviders.length === 0 && closedCheckerExtensions;
  const semantics = ExtensionTable.semantics(table);
  const emptyRuntimeSemantics = semantics.every(module => module.exports.every(entry => entry.kind === "source-primitive"));
  const closedOrdinaryApplication = noRoles && closedOrdinaryPassing && emptyRuntimeSemantics;
  return {
    closedOrdinaryPassing,
    closedOrdinaryApplication,
    sourcePrimitiveFacts: !closedCheckerExtensions || semantics.some(module => module.exports.some(entry => entry.kind === "source-primitive")),
    closedOrdinaryExtent: closedOrdinaryPassing && semantics.every(module =>
      module.exports.every(entry => entry.kind !== "type-marker" || entry.marker !== "fixed-array")),
    emptyCoreInventory: closedOrdinaryApplication && contributions.declarationProviders.length === 0 &&
      ExtensionTable.entries(table).every(entry => entry.kind === "semantics-module"),
    emptyObservationInventory: closedOrdinaryApplication && contributions.dataLayouts.length === 0,
  };
}

function declarationPassing(scope: CaptureScope, node: Node | undefined): Extract<ArgumentPassingFact, { readonly role: "declaration" }> | undefined {
  const fact = scope.checked.sourceFacts.getFact(node, argumentPassingFactKey);
  if (fact !== undefined && fact.role !== "declaration")
    return throwInvariant(invariant("A signature parameter's passing fact must belong to its actual declaration."));
  return fact;
}

function coreFacts(node: RawNodeRef, empty: boolean, noLayoutQuery: boolean): RawCoreCapture {
  const proven = <Value>(value: Value): RawFact<Value> => empty ? available(value) : notProvided();
  return {
    node, provider: proven(null), markers: proven({ struct: null, field: null, defaultValue: null, jsString: false, application: available(null) }), pointerType: proven(null),
    pointerOperation: proven(null), metadata: proven(null), layout: proven(null), field: proven(null), fieldBinding: proven(null),
    recordBinding: proven(null), layoutQuery: noLayoutQuery ? available(null) : notProvided(), attribute: proven(null), safety: proven(null), argumentPassing: proven(null), flowState: proven(null),
  };
}

function markerField(scope: CaptureScope, field: FieldFact): RawFieldMarker | null {
  const typeNode = referenceTo(scope, scope.program, field.type);
  if (typeNode === null) return scope.meter.refusal !== null ? null
    : throwInvariant(invariant("A field marker must retain its actual authored type node."));
  return { name: field.name, typeNode, readonly: field.readonly === true };
}

function capturedMarkers(scope: CaptureScope, node: Node, occurrence: NodeId): RawMarkers | undefined | null {
  if (scope.emptyCoreInventory) return undefined;
  const facts = scope.checked.sourceFacts;
  const structure = facts.getFact(node, structFactKey);
  const field = facts.getFact(node, fieldFactKey);
  const defaultValue = facts.getFact(node, defaultValueFactKey);
  const jsString = facts.getFact(node, sourceMarkerFactKey)?.marker === "js-string";
  if (structure === undefined && field === undefined && defaultValue === undefined && !jsString) return undefined;
  if (!admit(scope, "facts")) return null;
  let capturedStruct: RawMarkers["struct"] = null;
  if (structure !== undefined) {
    if (!admit(scope, "facts")) return null;
    const supplied = structure.fields;
    let fields: RawFact<readonly RawFieldMarker[]> = notProvided();
    if (supplied !== undefined) {
      const entries: RawFieldMarker[] = [];
      for (let index = 0; index < supplied.length; index += 1) {
        if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
        const entry = supplied[index];
        if (entry === undefined) return throwInvariant(invariant("A struct marker's authored field inventory must be dense."));
        const capture = markerField(scope, entry);
        if (capture === null) return null;
        entries.push(capture);
      }
      fields = available(entries);
    }
    capturedStruct = { valueType: structure.valueType, fields };
  }
  let capturedField: RawFieldMarker | null = null;
  if (field !== undefined) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    capturedField = markerField(scope, field);
    if (capturedField === null) return null;
  }
  let capturedDefault: RawMarkers["defaultValue"] = null;
  if (defaultValue !== undefined) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const typeNode = referenceTo(scope, scope.program, defaultValue.type);
    if (typeNode === null) return scope.meter.refusal !== null ? null
      : throwInvariant(invariant("A default-value marker must retain its actual authored type node."));
    capturedDefault = { typeNode };
  }
  let application: RawMarkers["application"] = available(null);
  if ((structure !== undefined || field !== undefined) && scope.checked.ast.kindName(node) === "KindCallExpression") {
    const selected = scope.callCore.get(occurrence);
    application = selected !== undefined && selected !== "ordinary" && (selected.role === "struct" || selected.role === "field")
      && (selected.role === "struct" ? structure !== undefined : field !== undefined)
      ? available(selected) : { kind: "unavailable", reason: "incomplete-association", causes: [] };
  }
  return { struct: capturedStruct, field: capturedField, defaultValue: capturedDefault, jsString, application };
}

function providerDeclaration(scope: CaptureScope, node: Node, reference: RawNodeRef): RawProviderDeclaration | null | undefined {
  const facts = scope.checked.sourceFacts;
  let fact = facts.getFact(node, providerVirtualDeclarationFactKey);
  if (fact === undefined) {
    const name = scope.checked.ast.name(node);
    if (name !== undefined) fact = facts.getFact(scope.checker.getSymbolAtLocation(name), providerVirtualDeclarationFactKey);
  }
  if (fact === undefined || fact.exportId === undefined) return undefined;
  const module = OpenedProgram.moduleAt(scope.program, fact.artifactFileName);
  const input = module === undefined ? undefined : OpenedProgram.file(scope.program, module);
  if (input === undefined || input.origin.kind !== "session-document")
    return throwInvariant(invariant("A provider declaration must retain its actual admitted session document."));
  const provider = input.origin.document.provider;
  if (provider.providerId !== fact.providerId || provider.providerVersion !== fact.providerVersion
    || provider.providerModuleId !== fact.providerModuleId || provider.moduleSpecifier !== fact.moduleSpecifier)
    return throwInvariant(invariant("A provider declaration fact must agree with its actual admitted provider identity."));
  const kind = scope.checked.ast.kindName(node);
  if (kind === "KindExportSpecifier" || kind === "KindImportSpecifier") return undefined;
  if (!admit(scope, "facts")) return null;
  return { node: reference, identity: { module: provider, exportId: fact.exportId,
    memberId: fact.memberId ?? null, signatureId: fact.signatureId ?? null }, wellKnownDeclaration: notProvided() };
}

/** The type at one position (component); each position has its own row, so a row's component is where it was read. */
function withoutTypeCause(type: Type | undefined, typeSource?: Node): ResolvedSourceTypeInfo | undefined {
  return type === undefined ? undefined : typeSource === undefined ? { type, causes: [] } : { type, causes: [], typeSource };
}

function rawType(scope: CaptureScope, read: () => ResolvedSourceTypeInfo | undefined, position: RawComponentId | null,
  originalUse: OriginalTypeUse | null, bindingUse: TypeBindingUse | null = null, literalNode: Node | null = null): RawTypeId | null {
  if (position === null || !admit(scope, "facts")) return null;
  const answer = read();
  return scope.meter.refusal === null ? enqueueRawType(scope, answer, position, originalUse, bindingUse, literalNode) : null;
}

function enqueueRawType(scope: CaptureScope, answer: ResolvedSourceTypeInfo | undefined, position: RawComponentId,
  originalUse: OriginalTypeUse | null, bindingUse: TypeBindingUse | null, literalNode: Node | null): RawTypeId {
  if (answer === undefined) return throwInvariant(invariant("The checker returned no type at a position that has one."));
  const id = rawTypeId(scope.tables.nextType++);
  scope.tables.pending.push({ kind: "type", id, answer, position, originalUse, bindingUse, literalNode });
  return id;
}

function backingEndpoints(edge: ResolvedCheckerBackingConstraint): readonly [ResolvedCheckedComponentEvidence, ResolvedCheckedComponentEvidence] {
  switch (edge.kind) {
    case "operator": return [edge.left, edge.right];
    case "index": return [edge.receiver, edge.index];
    case "write-fit": return [edge.source, edge.destination];
  }
}

function directBackingRows(scope: CaptureScope): ReadonlyMap<number, readonly ResolvedCheckerBackingConstraint[] | null> | null {
  const joined = new Map<number, ResolvedCheckerBackingConstraint[] | null>();
  if (scope.diagnosticRoots.size === 0) return joined;
  if (!admit(scope, "facts")) return null;
  const edges = scope.checker.getBackingConstraints();
  const byRoot = new Map<CheckerDiagnostic, Map<CheckerDiagnostic, ResolvedCheckerBackingConstraint | null>>();
  for (let index = 0; index < edges.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const edge = edges[index];
    if (edge === undefined) return throwInvariant(invariant("Checker backing evidence must be dense."));
    const { root, diagnostic } = edge.diagnostic;
    if (scope.diagnosticRoots.get(root)?.module !== scope.module) continue;
    let original = byRoot.get(root);
    if (original === undefined) { original = new Map(); byRoot.set(root, original); }
    original.set(diagnostic, original.has(diagnostic) ? null : edge);
  }
  if (byRoot.size === 0) return joined;
  for (const [original, reference] of scope.diagnosticRoots) {
    if (!admit(scope, "edges")) return null;
    if (reference.module !== scope.module || joined.get(reference.index) === null) continue;
    const matches = byRoot.get(original);
    const first = matches?.values().next().value;
    const receipt = first?.diagnostic.rootCoverage;
    if (matches === undefined || receipt?.kind !== "complete" || receipt.root !== original
      || receipt.purpose.kind !== "other" || receipt.obligations.length !== matches.size) {
      joined.set(reference.index, null);
      continue;
    }
    const verified: ResolvedCheckerBackingConstraint[] = [];
    for (let ordinal = 0; ordinal < receipt.obligations.length; ordinal += 1) {
      if (!admit(scope, "edges")) return null;
      const obligation = receipt.obligations[ordinal];
      const edge = obligation === undefined ? undefined : matches.get(obligation.diagnostic);
      if (edge === undefined || edge === null || obligation?.kind !== "backing" || obligation.application !== undefined) break;
      const member = scope.diagnosticRoots.get(edge.diagnostic.diagnostic);
      if (edge.application !== undefined || member?.module !== reference.module || member.index !== reference.index || !scope.ownNodes.has(edge.site)
        || edge.kind === "operator" && !scope.ownNodes.has(edge.operation)
        || edge.kind === "index" && !scope.ownNodes.has(edge.access)
        || backingEndpoints(edge).some(endpoint => endpoint.application !== undefined || endpoint.path.length !== 0
          || endpoint.type !== endpoint.root.type || !scope.ownNodes.has(endpoint.root.node)
          || endpoint.root.kind !== "value" && endpoint.root.kind !== "annotation" && endpoint.root.kind !== "declaration")) break;
      verified.push(edge);
      matches.delete(obligation.diagnostic);
    }
    if (matches.size !== 0) { joined.set(reference.index, null); continue; }
    const previous = joined.get(reference.index);
    if (previous === undefined) joined.set(reference.index, verified);
    else if (previous !== null) for (const edge of verified) previous.push(edge);
  }
  return joined;
}

function captureDiagnosticCoverage(scope: CaptureScope, diagnostics: readonly Diagnostic[]): readonly RawDiagnosticCoverage[] | null {
  if (diagnostics.length === 0) return [];
  const groups = directBackingRows(scope);
  if (groups === null) return null;
  const components = new Map<Node, Map<Type, RawComponentId>>();
  const source = (node: Node): RawNodeRef => {
    const id = scope.ownNodes.get(node);
    if (id === undefined) return throwInvariant(invariant("A backed obligation must name its authenticated local syntax."));
    return { module: scope.module, node: id };
  };
  const endpoint = (evidence: ResolvedCheckedComponentEvidence): RawComponentId | null => {
    if (!admit(scope, "edges")) return null;
    const { node } = evidence.root;
    const known = components.get(node);
    const existing = known?.get(evidence.type);
    if (existing !== undefined) return existing;
    const position = component(scope, source(node), null);
    if (position === null || rawType(scope, () => withoutTypeCause(evidence.type), position,
      evidence.root.kind === "annotation" ? node : null, null, scope.numericLiterals.has(node) ? node : null) === null) return null;
    captureFacts(scope);
    if (scope.meter.refusal !== null) return null;
    if (known === undefined) components.set(node, new Map([[evidence.type, position]]));
    else known.set(evidence.type, position);
    return position;
  };
  const rows: RawDiagnosticCoverage[] = [];
  for (let index = 0; index < diagnostics.length; index += 1) {
    const root = { module: scope.module, index };
    const group = groups.get(index);
    if (group === undefined || group === null) { rows.push({ kind: "unavailable", root }); continue; }
    const obligations: RawConstraint[] = [];
    for (const edge of group) {
      if (!admit(scope, "facts")) return null;
      const [leftEvidence, rightEvidence] = backingEndpoints(edge);
      const left = endpoint(leftEvidence);
      if (left === null) return null;
      const right = endpoint(rightEvidence);
      if (right === null) return null;
      const context = { diagnostic: root, root, site: source(edge.site), application: null };
      switch (edge.kind) {
        case "operator": obligations.push({ ...context, kind: "operator", operation: source(edge.operation), left, right }); break;
        case "index": obligations.push({ ...context, kind: "index", access: source(edge.access), receiver: left, index: right }); break;
        case "write-fit": obligations.push({ ...context, kind: "write-fit", source: left, destination: right }); break;
      }
    }
    rows.push({ kind: "complete", root, obligations, purpose: { kind: "other" } });
  }
  return rows;
}

function tupleLiteralElementAnnotation(scope: CaptureScope, parent: Node, operand: Node): Node | undefined {
  const contexts = scope.tables.tupleLiteralContexts;
  if (contexts === null || !admit(scope, "edges")) return undefined;
  const context = contexts.get(parent);
  if (context === undefined) return undefined;
  const ast = scope.checked.ast;
  const elements = ast.as.AsArrayLiteralExpression(parent)?.Elements?.Nodes;
  const written = tupleSyntax(scope, context.syntax);
  if (scope.meter.refusal !== null || !admit(scope, "edges")) return undefined;
  const native = scope.shape.getTupleInfo(context.original);
  if (elements === undefined || written === undefined || native === undefined
    || elements.length !== written.elements.length || elements.length !== native.elements.length
    || written.readonly !== native.readonly) return undefined;
  while (context.nextElement < elements.length) {
    if (!admit(scope, "edges")) return undefined;
    const ordinal = context.nextElement;
    const element = elements[ordinal];
    const kind = ast.kindName(element);
    if (element === undefined || kind === "KindSpreadElement" || kind === "KindOmittedExpression") return undefined;
    context.nextElement += 1;
    if (element !== operand) continue;
    const annotation = written.elements[ordinal];
    const slot = native.elements[ordinal];
    if (annotation === undefined || slot?.elementKind !== "required") return undefined;
    const original = sourceType(scope, { kind: "annotation", node: annotation });
    return original?.type === slot.type && original.causes.length === 0 ? annotation : undefined;
  }
  return undefined;
}

function tupleAssertion(scope: CaptureScope, node: Node) {
  const ast = scope.checked.ast;
  const kind = ast.kindName(node);
  if ((kind !== "KindAsExpression" && kind !== "KindTypeAssertionExpression") || !admit(scope, "edges")) return undefined;
  return kind === "KindAsExpression" ? ast.as.AsAsExpression(node) : ast.as.AsTypeAssertion(node);
}

function contextualLiteralAnnotation(scope: CaptureScope, node: Node, parent: Node, role: "tuple" | "native-array"): Node | undefined {
  const ast = scope.checked.ast;
  let operand = node;
  let owner: Node | undefined = parent;
  while (owner !== undefined && ast.kindName(owner) === "KindParenthesizedExpression") {
    if (!admit(scope, "edges") || ast.as.AsParenthesizedExpression(owner)?.Expression !== operand) return undefined;
    operand = owner;
    owner = ast.parent(owner);
  }
  if (owner === undefined) return undefined;
  if (role === "tuple") {
    if (ast.kindName(owner) === "KindArrayLiteralExpression") return tupleLiteralElementAnnotation(scope, owner, operand);
    const assertion = tupleAssertion(scope, owner);
    if (assertion !== undefined) return assertion.Expression === operand ? assertion.Type : undefined;
  }
  if (ast.kindName(owner) === "KindVariableDeclaration" && ast.as.AsVariableDeclaration(owner)?.Initializer === operand)
    return ast.typeNode(owner);
  if (role === "native-array" && scope.rootAssignmentAnnotations !== null && ast.kindName(owner) === "KindBinaryExpression") {
    if (!admit(scope, "edges") || ast.as.AsBinaryExpression(owner)?.Right !== operand) return undefined;
    return scope.rootAssignmentAnnotations.get(owner);
  }
  if (ast.kindName(owner) === "KindReturnStatement" && ast.as.AsReturnStatement(owner)?.Expression === operand) {
    for (let enclosed: Node | undefined = owner; enclosed !== undefined;) {
      if (!admit(scope, "edges")) return undefined;
      const containing = ast.parent(enclosed);
      if (containing === undefined) break;
      const kind = ast.kindName(containing);
      if (kind === "KindFunctionDeclaration" || kind === "KindFunctionExpression" || kind === "KindArrowFunction"
        || kind === "KindMethodDeclaration" || kind === "KindGetAccessor" || kind === "KindSetAccessor" || kind === "KindConstructor") {
        return ast.body(containing) === enclosed ? ast.typeNode(containing) : undefined;
      }
      enclosed = containing;
    }
  }
  return undefined;
}

function unparenthesizedTupleValue(scope: CaptureScope, source: Node): Node | undefined {
  const ast = scope.checked.ast;
  let expression = source;
  while (ast.kindName(expression) === "KindParenthesizedExpression") {
    if (!admit(scope, "edges")) return undefined;
    const enclosed = ast.as.AsParenthesizedExpression(expression)?.Expression;
    if (enclosed === undefined) return undefined;
    expression = enclosed;
  }
  return expression;
}

function tupleLiteralExpression(scope: CaptureScope, source: Node): Node | undefined {
  const expression = unparenthesizedTupleValue(scope, source);
  return expression !== undefined && scope.checked.ast.kindName(expression) === "KindArrayLiteralExpression" ? expression : undefined;
}

function retainTupleContext(scope: CaptureScope, node: Node, selected: ContextualTupleUse): ContextualTupleUse | null {
  if (!admit(scope, "facts", scope.tables.tupleLiteralContexts === null ? 2 : 1)) return null;
  (scope.tables.tupleLiteralContexts ??= new Map()).set(node, selected);
  return selected;
}

function contextualTupleUse(scope: CaptureScope, node: Node, parent: Node | undefined,
  contextual: ResolvedSourceTypeInfo | undefined): ContextualTupleUse | null {
  if (parent === undefined || contextual === undefined || contextual.causes.length !== 0 || !scope.shape.isTuple(contextual.type)) return null;
  const ast = scope.checked.ast;
  const chain = scope.tables.tupleLiteralContexts;
  if (chain !== null && ast.kindName(parent) === "KindParenthesizedExpression") {
    if (!admit(scope, "edges")) return null;
    const inherited = ast.as.AsParenthesizedExpression(parent)?.Expression === node ? chain.get(parent) : undefined;
    if (inherited !== undefined) return inherited.original === contextual.type ? retainTupleContext(scope, node, inherited) : null;
  }
  const expression = tupleLiteralExpression(scope, node);
  if (expression === undefined) return null;
  const contexts = scope.tables.tupleArgumentContexts;
  if (contexts !== null && !admit(scope, "edges")) return null;
  const formal = contexts?.get(node);
  const annotation = formal === undefined ? contextualLiteralAnnotation(scope, node, parent, "tuple")
    : formal.type === contextual.type ? formal.annotation : undefined;
  const syntax = tupleAnnotationOf(scope, contextual.type, annotation);
  if (syntax === undefined || !admit(scope, "facts")) return null;
  return retainTupleContext(scope, node, { kind: "contextual-tuple", expression, syntax, original: contextual.type, nextElement: 0 });
}

function retainTupleLiteral(scope: CaptureScope, source: Node, expression: Node, original: Type): LiteralTupleUse | null {
  const reads = scope.tables.tupleLiteralReads;
  if (reads !== null && !admit(scope, "edges")) return null;
  const existing = reads?.get(source);
  if (existing !== undefined) {
    if (existing.expression !== expression || existing.original !== original)
      return throwInvariant(invariant("A tuple literal read must retain its actual expression and native type."));
    return existing;
  }
  if (!admit(scope, "facts", reads === null ? 3 : 2)) return null;
  const read: LiteralTupleUse = { kind: "literal-tuple", expression, original };
  (scope.tables.tupleLiteralReads ??= new Map()).set(source, read);
  return read;
}

function tupleLiteralRead(scope: CaptureScope, source: Node, original: Type, parent?: Node): LiteralTupleUse | null {
  const reads = scope.tables.tupleLiteralReads;
  if (reads === null || !admit(scope, "edges")) return null;
  const direct = reads.get(source);
  if (direct !== undefined) return direct.original === original ? direct : null;
  const ast = scope.checked.ast;
  if (parent === undefined || ast.kindName(parent) !== "KindParenthesizedExpression" || !admit(scope, "edges")
    || ast.as.AsParenthesizedExpression(parent)?.Expression !== source)
    return null;
  const inherited = reads.get(parent);
  if (inherited === undefined || inherited.original !== original || !admit(scope, "facts")) return null;
  reads.set(source, inherited);
  return inherited;
}

function contextualNativeArrayAnnotation(scope: CaptureScope, node: Node, parent: Node, contextual: ResolvedSourceTypeInfo): Node | null {
  const annotation = contextualLiteralAnnotation(scope, node, parent, "native-array");
  if (annotation === undefined) return null;
  const written = sourceType(scope, { kind: "annotation", node: annotation });
  if (written?.type !== contextual.type || written.causes.length !== 0) return null;
  const array = scope.shape.acquireNativeArrayType(contextual.type, nativeCaptureAdmission(scope));
  if (array.kind === "refused" && array.stop !== scope.meter.refusal)
    return throwInvariant(invariant("A native array context must retain its actual first capture refusal."));
  return array.kind === "complete" ? annotation : null;
}

function declaredTupleRead(scope: CaptureScope, type: Type, declaration: Node | undefined): Node | null {
  if (declaration === undefined) return null;
  const ast = scope.checked.ast;
  const kind = ast.kindName(declaration);
  if (kind !== "KindParameter" && kind !== "KindVariableDeclaration") return null;
  if (!admit(scope, "edges")) return null;
  const annotation = ast.typeNode(declaration);
  if (annotation === undefined) return null;
  let tuple = tupleSyntax(scope, annotation) !== undefined;
  if (!tuple) {
    const element = writtenBracketedElement(scope, annotation);
    tuple = element !== undefined && tupleSyntax(scope, element) !== undefined;
  }
  if (!tuple) {
    const written = writtenApplication(scope, unparenthesizedType(scope, annotation));
    for (let index = 0; index < (written?.arguments.length ?? 0); ++index) {
      if (!admit(scope, "edges")) return null;
      const argument = written?.arguments[index];
      if (argument !== undefined && tupleSyntax(scope, argument) !== undefined) { tuple = true; break; }
    }
  }
  if (!tuple || scope.meter.refusal !== null) return null;
  const original = sourceType(scope, { kind: "annotation", node: annotation });
  return original?.type === type && original.causes.length === 0 ? annotation : null;
}

function isDeclaredTupleRead(scope: CaptureScope, node: Node | undefined, answer: ResolvedSourceTypeInfo): boolean {
  return node !== undefined && answer.causes.length === 0 && scope.checked.ast.kindName(node) === "KindIdentifier"
    && (scope.shape.isTuple(answer.type) || scope.shape.isTypeReference(answer.type));
}

function valueTupleAnnotation(scope: CaptureScope, node: Node | undefined, answer: ResolvedSourceTypeInfo | undefined): Node | null {
  if (node === undefined || answer === undefined || answer.causes.length !== 0) return null;
  if (scope.shape.isTuple(answer.type)) {
    if (scope.checked.ast.kindName(node) === "KindCallExpression") return callTupleAnnotation(scope, node, answer.type);
    const assertion = tupleAssertion(scope, node);
    if (assertion !== undefined) return tupleAnnotationOf(scope, answer.type, assertion.Type) ?? null;
  }
  if (!isDeclaredTupleRead(scope, node, answer)) return null;
  const symbol = scope.checker.getSymbolAtLocation(node);
  return symbol !== undefined && admit(scope, "edges")
    ? declaredTupleRead(scope, answer.type, scope.checker.getSymbolValueDeclaration(symbol)) : null;
}

function selectedTupleAnnotation(scope: CaptureScope, call: ResolvedSourceCallInfo): Node | null {
  if (call.kind !== "applicable" || call.optionalChain || call.selection.diagnostics.length !== 0) return null;
  const { application } = call.selection;
  const { signature, instantiatedSignature, signatureShape } = application;
  const declaration = signatureShape.declaration;
  if (application.invocation !== call.call || application.kind !== "call" || signatureShape.composite !== undefined
    || declaration === undefined || signature.declaration !== declaration
    || instantiatedSignature !== signature && instantiatedSignature.target !== signature || !admit(scope, "edges")) return null;
  const annotation = scope.checked.ast.typeNode(declaration);
  if (annotation === undefined || tupleSyntax(scope, annotation) === undefined) return null;
  const original = sourceType(scope, { kind: "signature-return", signature });
  if (original?.type !== call.resultType || original.causes.length !== 0 || original.typeSource === undefined
    || original.typeSource !== annotation && original.typeSource !== unparenthesizedType(scope, annotation)) return null;
  const applied = instantiatedSignature === signature ? original : sourceType(scope, { kind: "signature-return", signature: instantiatedSignature });
  return applied?.type === call.resultType && applied.causes.length === 0 && scope.meter.refusal === null ? annotation : null;
}

function callTupleAnnotation(scope: CaptureScope, node: Node, type: Type): Node | null {
  if (!admit(scope, "edges")) return null;
  const known = scope.tables.tupleCalls?.get(node);
  if (known !== undefined) return known.call.kind === "applicable" && known.call.resultType === type ? known.annotation : null;
  const call = acquireCallEvidence(scope, node);
  if (call === null) return null;
  const annotation = selectedTupleAnnotation(scope, call);
  if (!admit(scope, "facts", scope.tables.tupleCalls === null ? 3 : 2)) return null;
  (scope.tables.tupleCalls ??= new Map()).set(node, { call, annotation });
  return call.kind === "applicable" && call.resultType === type ? annotation : null;
}

function captureNumericToken(scope: CaptureScope, node: Node): RawNumericLiteral {
  return scope.numericLiterals.get(node) ?? throwInvariant(invariant("A numeric literal requires its exact admitted syntax token."));
}

function forwardedNumericToken(scope: CaptureScope, source: Node): RawNumericLiteral | null {
  if (!admit(scope, "edges")) return null;
  const known = scope.numericLiterals.get(source);
  if (known !== undefined) return known;
  const ast = scope.checked.ast;
  const file = ast.getSourceFile(source);
  const module = file === undefined ? undefined : moduleOfFile(scope.program, file, ast);
  const input = module === undefined ? undefined : OpenedProgram.file(scope.program, module);
  if (file === undefined || module === undefined || input?.file !== file)
    return throwInvariant(invariant("A forwarded numeric annotation requires its actual admitted source file."));
  const literal = authoredNumericType({ ast, module, sourceText: input.text, displacement: input.displacement }, source);
  if (literal !== null) scope.numericLiterals.set(source, literal);
  return literal;
}

type TypeCapture = Extract<CaptureTask, { readonly kind: "type" }>;

function indexedTupleArgument(scope: CaptureScope, receiver: Type, object: Node, declaration: Node, result: Type): Node | undefined {
  if (!admit(scope, "edges", 2)) return undefined;
  const ast = scope.checked.ast;
  const owner = ast.parent(declaration);
  const annotation = ast.typeNode(declaration);
  if (ast.kindName(owner) !== "KindInterfaceDeclaration" || annotation === undefined) return undefined;
  const name = parameterReferenceName(scope, annotation);
  const target = scope.shape.getTypeReferenceTarget(receiver);
  const symbol = target === undefined ? undefined : scope.checker.getTypeSymbol(target);
  if (name === undefined || target === undefined || symbol === undefined ||
    scope.checker.getSymbolAtLocation(ast.name(owner)) !== symbol) return undefined;
  const declared = sourceType(scope, { kind: "annotation", node: annotation });
  if (declared === undefined || declared.causes.length !== 0 || !admit(scope, "edges")) return undefined;
  const parameter = scope.checker.getTypeSymbol(declared.type);
  if (parameter === undefined || scope.checker.getSymbolAtLocation(name) !== parameter) return undefined;
  const source = unparenthesizedType(scope, object);
  if (scope.meter.refusal !== null) return undefined;
  const application = writtenApplication(scope, source);
  const bracketed = application === null ? writtenBracketedElement(scope, object) : undefined;
  if (scope.meter.refusal !== null || application === null && bracketed === undefined) return undefined;
  if (application?.name !== undefined && application.name !== null && !bindsWrittenTypeTarget(scope, application.name, symbol))
    return undefined;
  const binding = scope.shape.acquireInterfaceArguments(receiver, target, nativeCaptureAdmission(scope));
  if (binding.kind === "refused" && binding.stop === scope.meter.refusal || binding.kind === "unavailable") return undefined;
  if (binding.kind !== "complete") return throwInvariant(invariant("An indexed tuple must retain its actual native binding refusal."));
  let ordinal = 0;
  for (let position = 0; position < binding.value.length; ++position) {
    if (!admit(scope, "edges")) return undefined;
    const entry = binding.value[position];
    if (entry === undefined) return throwInvariant(invariant("An indexed tuple must retain each actual native slot."));
    if (entry.scope !== "local") continue;
    const index = ordinal++;
    if (entry.parameter !== declared.type) continue;
    if (entry.argument !== result || !admit(scope, "edges")) return undefined;
    const argument = application === null ? index === 0 ? bracketed : undefined : application.arguments[index];
    if (argument === undefined || tupleSyntax(scope, argument) === undefined) return undefined;
    const written = sourceType(scope, { kind: "annotation", node: argument });
    return written?.type === result && written.causes.length === 0 ? argument : undefined;
  }
  return undefined;
}

function declaredIndexResult(scope: CaptureScope, task: TypeCapture, type: Type): RawTypeForm | null | undefined {
  const receipt = task.answer.indexedRead;
  if (receipt?.kind !== "declared-index-read") return undefined;
  if (!admit(scope, "edges")) return null;
  if (!hasDeclaredIndexReadEvidence(receipt))
    return throwInvariant(invariant("An indexed result requires its actual native declared-index receipt."));
  const tuple = scope.shape.isTuple(type);
  const declarations = tuple ? null : mergedArgumentGroup(scope, type);
  if (!tuple && declarations === null) return scope.meter.refusal === null ? undefined : null;
  const written = task.originalUse === null ? undefined : admittedTypeUse(scope, task.originalUse);
  if (scope.meter.refusal !== null) return null;
  const ast = scope.checked.ast;
  const syntax = ast.as.AsIndexedAccessTypeNode(receipt.annotation);
  if (receipt.result !== type || written !== receipt.annotation && task.answer.typeSource !== receipt.annotation
    || syntax?.ObjectType === undefined || syntax.IndexType === undefined
    || ast.kindName(receipt.declaration) !== "KindIndexSignature")
    return throwInvariant(invariant("An indexed result must retain its actual checked index signature and annotation."));
  const receiver = sourceType(scope, { kind: "annotation", node: syntax.ObjectType });
  if (scope.meter.refusal !== null) return null;
  const index = sourceType(scope, { kind: "annotation", node: syntax.IndexType });
  if (scope.meter.refusal !== null) return null;
  if (receiver?.type !== receipt.receiver || receiver.causes.length !== 0 || index?.type !== receipt.index || index.causes.length !== 0)
    return throwInvariant(invariant("An indexed result must retain its actual checked receiver and index operands."));
  if (declarations !== null) return captureMergedParameter(scope, declarations);
  const argument = indexedTupleArgument(scope, receipt.receiver, syntax.ObjectType, receipt.declaration, type);
  if (scope.meter.refusal !== null) return null;
  return argument === undefined ? undefined : captureTuple(scope, type, task.position, argument, null, null);
}

function exactNumericUnion(scope: CaptureScope, task: TypeCapture): RawTypeForm | undefined | null {
  const ast = scope.checked.ast;
  const position = scope.tables.components[task.position];
  const original = task.originalUse;
  const direct = original !== null && "module" in original && position?.path === null && sameSource(position.root, original)
    ? admittedTypeUse(scope, original) : undefined;
  const selected = task.answer.indexedRead?.kind === "indexed-read" ? task.answer.indexedRead : undefined;
  const source = selected?.annotation ?? task.answer.typeSource ?? direct;
  if (source === undefined || ast.kindName(source) !== (selected === undefined ? "KindUnionType" : "KindIndexedAccessType")) return undefined;
  const operands = selected?.properties ?? ast.as.AsUnionTypeNode(source)?.Types?.Nodes;
  if (operands === undefined || operands.length < 2)
    return throwInvariant(invariant("An authored union requires its actual constituent syntax."));
  for (const operand of operands) {
    if (operand === undefined) return throwInvariant(invariant("An authored union cannot omit a constituent."));
    if (!admit(scope, "edges")) return null;
    if (ast.kindName(operand) !== "KindLiteralType" || forwardedNumericToken(scope, operand) === null)
      return scope.meter.refusal === null ? undefined : null;
  }
  const annotation = referenceTo(scope, scope.program, source);
  if (scope.meter.refusal !== null) return null;
  if (annotation === null) return throwInvariant(invariant("An authored numeric union requires its actual admitted source."));
  const members: RawTypeId[] = [];
  const sources: RawNodeRef[] | null = selected === undefined ? null : [];
  for (const operand of operands) {
    if (operand === undefined) return throwInvariant(invariant("An authored numeric union requires its actual constituent."));
    const reference = referenceTo(scope, scope.program, operand);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return throwInvariant(invariant("An authored numeric union constituent requires its actual admitted source."));
    const member = rawType(scope, () => sourceType(scope, { kind: "annotation", node: operand }), component(scope, reference, null), reference, null, operand);
    if (member === null) return null;
    members.push(member);
    sources?.push(reference);
  }
  return { kind: "union", members,
    numericOrigin: sources === null ? { kind: "authored", annotation } : { kind: "indexed-read", annotation, sources } };
}

function capturedSourcePrimitive(scope: CaptureScope, row: TypeCapture): RawCheckedType["primitive"] | null {
  const annotation = row.originalUse === null ? row.answer.typeSource : admittedTypeUse(scope, row.originalUse);
  if (annotation === undefined) return notProvided();
  const kind = scope.checked.ast.kindName(annotation);
  if (kind !== "KindTypeReference" && kind !== "KindImportType") return notProvided();
  if (!admit(scope, "edges")) return null;
  const primitive = scope.checked.sourceFacts.getFact(annotation, sourcePrimitiveFactKey);
  if (primitive === undefined) return notProvided();
  const selected = sourceType(scope, { kind: "annotation", node: annotation });
  if (scope.meter.refusal !== null) return null;
  if (selected?.type !== row.answer.type || selected.causes.length !== 0) return notProvided();
  return admit(scope, "facts") ? available({ primitive: primitive.kind, runtimeBase: primitive.runtimeBase }) : null;
}

function storeRawType(scope: CaptureScope, row: TypeCapture, form: RawFact<RawTypeForm>, literal: RawLiteral | null,
  alias: RawCheckedType["alias"]): void {
  const primitive: RawCheckedType["primitive"] | null = scope.sourcePrimitiveFacts && form.kind === "available" && literal === null
    ? capturedSourcePrimitive(scope, row) : notProvided();
  if (primitive === null) return;
  scope.tables.types[row.id] = {
    id: row.id, component: row.position, authoredTypeNode: row.originalUse !== null && "module" in row.originalUse ? row.originalUse : null,
    declaration: null, definitionOwner: null, definitionFacet: null,
    definitionParameters: available([]), alias, instantiatedBases: available([]), literal: available(literal),
    primitive, form,
  };
}

function captureFacts(scope: CaptureScope): void {
  while (scope.meter.refusal === null) {
    const next = scope.tables.pending.pop();
    if (next === undefined) return;
    if (next.kind === "leave-type") {
      scope.tables.activeMergedArguments.delete(next.id);
      if (next.key === null) scope.tables.activeTypes.delete(next.type);
      else {
        const active = scope.tables.activeQualifiedTypes.get(next.key);
        active?.delete(next.type);
        if (active?.size === 0) scope.tables.activeQualifiedTypes.delete(next.key);
      }
    } else if (next.kind === "indexed-alias-scope") {
      const { declaration, enter } = next;
      if (scope.tables.activeIndexedAliases.has(declaration) === enter)
        return throwInvariant(invariant("A retained indexed alias must scope exactly its actual body capture."));
      if (enter) scope.tables.activeIndexedAliases.add(declaration);
      else scope.tables.activeIndexedAliases.delete(declaration);
    } else if (next.kind === "merged-inventory-scope") {
      const { symbol, type, enter } = next;
      const active = scope.tables.activeMergedInventories.get(symbol);
      if (enter ? active !== undefined : active !== type)
        return throwInvariant(invariant("A merged declaration must scope exactly its actual inventory capture."));
      if (enter) scope.tables.activeMergedInventories.set(symbol, type);
      else scope.tables.activeMergedInventories.delete(symbol);
    } else if (next.kind === "signature") captureSignature(scope, next.id, next.signature, next.owner, next.signatureKind, next.use);
    else if (next.kind === "signature-parameter") captureSignatureParameter(scope, next.draft, next.index);
    else {
      const { type, causes } = next.answer;
      let form: RawFact<RawTypeForm>;
      let alias: RawCheckedType["alias"] = available(null);
      let literal: RawLiteral | null = null;
      if (causes.length !== 0) {
        const failed = originalTypeFailure(scope, causes);
        if (failed === null) return;
        form = failed;
      } else if (scope.shape.isError(type)) form = { kind: "unavailable", reason: "missing-original-component", causes: [] };
      else if ((type.flags & TypeFlagsEnumLike) !== 0) {
        if (!admit(scope, "edges")) return;
        const owner = scope.shape.getEnumOwnerDeclaration(type);
        if (owner === undefined) return throwInvariant(invariant("A checked enum type requires its native enum declaration owner."));
        const declaration = referenceTo(scope, scope.program, owner);
        if (scope.meter.refusal !== null) return;
        if (declaration === null) return throwInvariant(invariant("A checked enum declaration belongs to the actual source domain."));
        form = available({ kind: "enum", declaration });
      }
      else {
        const numericUnion = exactNumericUnion(scope, next);
        if (numericUnion === null) return;
        if (numericUnion !== undefined) {
          storeRawType(scope, next, available(numericUnion), null, alias);
          continue;
        }
        const boolean = scope.shape.getBooleanLiteralTypeValue(type);
        const string = scope.shape.getStringLiteralTypeValue(type);
        if (boolean !== undefined) literal = { kind: "boolean", value: boolean };
        else if (string !== undefined) literal = { kind: "string", value: string };
        else if ((type.flags & TypeFlagsUniqueESSymbol) !== 0) {
          const symbol = scope.checker.getTypeSymbol(type);
          const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
          if (!admit(scope, "edges")) return;
          const declaration = declarations[0];
          if (declarations.length !== 1 || declaration === undefined)
            return throwInvariant(invariant("A unique symbol must retain its one actual checked declaration."));
          const source = referenceTo(scope, scope.program, declaration);
          if (scope.meter.refusal !== null) return;
          if (source === null) return throwInvariant(invariant("A unique symbol's declaration must belong to the admitted source domain."));
          literal = { kind: "symbol", declaration: source };
        } else if ((scope.shape.isNumberLike(type) || scope.shape.isBigIntLike(type)) && scope.checker.getTypeSymbol(type) === undefined) {
          const numeric = scope.shape.getNumericLiteralTypeValue(type);
          if (numeric !== undefined) {
            const source = next.answer.typeSource;
            const authored = next.literalNode !== null ? captureNumericToken(scope, next.literalNode)
              : source === undefined ? null : forwardedNumericToken(scope, source);
            if (scope.meter.refusal !== null) return;
            literal = typeof numeric === "number"
              ? { kind: "number", value: authored === null ? { kind: "checker-value", value: numeric } : { kind: "authored", literal: authored } }
              : { kind: "bigint", value: authored === null ? { kind: "checker-value", value: numeric }
                : { kind: "authored", literal: authored, checked: numeric } };
          }
        }
        const base = literal === null ? type : scope.shape.getBaseTypeOfLiteralType(type);
        if (base === undefined) return throwInvariant(invariant("A captured literal type requires its actual SDK base type."));
        const bindingUse = next.bindingUse?.kind === "receiver-projection" ? projectedReceiver(scope, next.bindingUse, base)
          : next.bindingUse?.kind === "callback-input" ? callbackBindingUse(scope, next.bindingUse, base)
          : next.bindingUse?.kind === "rest-input" ? next.bindingUse.selected === base
            ? restBindingUse(scope, next.bindingUse.syntax, next.bindingUse.original, base, next.bindingUse.receiver) : null
          : next.bindingUse?.kind === "composed-union" ? next.bindingUse.type === base ? next.bindingUse : null
          : next.bindingUse?.kind === "direct-result" ? directResultUse(scope, next.bindingUse, base)
          : next.bindingUse?.kind === "union-result" ? unionArmUse(scope, base, null, next.bindingUse)
          : next.bindingUse?.kind === "projected-operand" || next.bindingUse?.kind === "merged-slot" ? null : next.bindingUse;
        const projection = next.bindingUse?.kind === "projected-operand" ? next.bindingUse : null;
        if (scope.meter.refusal !== null) return;
        const use = bindingUse ?? (next.originalUse === null ? null : scope.shape.isUnion(base)
          ? authoredFormalAnnotation(scope, next, base) ?? (scope.meter.refusal !== null ? null :
            authoredComposedUnion(scope, base, next.originalUse) ?? (scope.meter.refusal === null ? unionArmUse(scope, base, next.originalUse, null) : null))
          : receiverBindingUse(scope, base, next.originalUse));
        if (scope.meter.refusal !== null) return;
        const ancestor = use === null ? scope.tables.activeTypes.get(type) : scope.tables.activeQualifiedTypes.get(use)?.get(type);
        let captured: RawTypeForm | null;
        if (ancestor === undefined) {
          const exit: Extract<CaptureTask, { readonly kind: "leave-type" }> = { kind: "leave-type", id: next.id, type, key: use };
          scope.tables.pending.push(exit);
          const source = use?.kind === "direct-result" ? use.source ?? next.originalUse : next.originalUse;
          const indexed = (base.flags & TypeFlagsIndexedAccess) !== 0;
          const written = indexed && source !== null && "module" in source ? admittedTypeUse(scope, source) : undefined;
          const writtenKind = scope.checked.ast.kindName(written);
          const indexedResult = next.bindingUse === null ? declaredIndexResult(scope, next, base) : undefined;
          if (indexedResult !== undefined) captured = indexedResult;
          else if (next.bindingUse?.kind === "merged-slot") {
            if (next.bindingUse.type !== base) return throwInvariant(invariant("A merged slot argument must retain its actual native parameter."));
            captured = captureMergedParameter(scope, next.bindingUse.declarations);
          } else if (indexed && writtenKind !== "KindIndexedAccessType") {
            const position = scope.tables.components[next.position];
            if (position === undefined) return throwInvariant(invariant("An indexed answer must retain its actual component."));
            captured = position.path === null && writtenKind === "KindTypeReference" && base.alias !== undefined
              ? deferredAliasApplication(scope, base, position, written) : null;
            if (scope.meter.refusal !== null) return;
            if (captured === null) {
              const selected = selectedIndexedType(scope, base, next.position, projection);
              if (selected === null) return;
              alias = available(selected.alias);
              captured = selected.form;
            }
          } else captured = typeForm(scope, base, next, source, use, projection);
          if (captured === null) return;
          if (exit.key === null) scope.tables.activeTypes.set(type, next.id);
          else {
            const active = scope.tables.activeQualifiedTypes.get(exit.key);
            if (active === undefined) scope.tables.activeQualifiedTypes.set(exit.key, new Map([[type, next.id]]));
            else active.set(type, next.id);
          }
          if (captured.kind === "merged-interface-dependency" || next.bindingUse?.kind === "interface-description")
            scope.tables.activeMergedArguments.add(next.id);
        } else {
          const original = scope.tables.types[ancestor];
          if (original?.form.kind !== "available")
            return throwInvariant(invariant("A native type backedge requires its actual available captured ancestor form."));
          if (original.form.value.kind === "indexed-access" || original.form.value.kind === "indexed-alias-dependency") {
            const retained = selectedIndexedType(scope, base, next.position, projection, true);
            if (retained === null) return;
            alias = available(retained.alias);
            captured = retained.form;
          } else if (original.form.value.kind === "merged-interface-dependency") {
            if (!admit(scope, "edges")) return;
            captured = { kind: "merged-interface-backedge", group: original.form.value.group, application: original.id };
          } else captured = original.form.value;
        }
        if (captured === null) return;
        form = available(captured);
      }
      storeRawType(scope, next, form, literal, alias);
    }
  }
}

function captureEnum(scope: CaptureScope, node: Node, declaration: RawNodeRef): RawEnum | null {
  if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
  const name = scope.checked.ast.name(node);
  const symbol = name === undefined ? undefined : scope.checker.getSymbolAtLocation(name);
  if (symbol === undefined) return throwInvariant(invariant("A checked enum declaration has no native declaration symbol."));
  if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
  const owner = scope.checker.getSymbolValueDeclaration(symbol);
  if (owner === undefined || scope.checked.ast.kindName(owner) !== "KindEnumDeclaration")
    return throwInvariant(invariant("An enum symbol needs its actual nominal declaration."));
  const nominal = referenceTo(scope, scope.program, owner);
  if (scope.meter.refusal !== null) return null;
  if (nominal === null) return throwInvariant(invariant("The enum's nominal declaration must belong to the actual source domain."));
  const declared = scope.checker.getSymbolDeclarations(symbol);
  const declarations: RawNodeRef[] = [];
  for (let index = 0; index < declared.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const part = declared[index];
    if (part === undefined) return throwInvariant(invariant("An enum declaration inventory is dense."));
    if (scope.checked.ast.kindName(part) !== "KindEnumDeclaration") continue;
    const reference = referenceTo(scope, scope.program, part);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return throwInvariant(invariant("An enum part must belong to the actual checked source domain."));
    if (!admit(scope, "facts")) return null;
    declarations.push(reference);
  }
  const members: RawEnumMember[] = [];
  const authored = scope.checked.ast.members(node);
  for (let index = 0; index < authored.length; index += 1) {
    if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
    const member = authored[index];
    if (member === undefined || scope.checked.ast.kindName(member) !== "KindEnumMember")
      return throwInvariant(invariant("An enum member must be its checked declaration's actual authored occurrence."));
    const reference = referenceTo(scope, scope.program, member);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return throwInvariant(invariant("A checked enum member belongs to the actual source domain."));
    if (!admit(scope, "edges")) return null;
    const value = scope.shape.getConstantValue(member);
    let constant: RawFact<RawEnumConstant> = notProvided();
    if (typeof value === "number") {
      const initializer = scope.checked.ast.as.AsEnumMember(member)?.Initializer;
      const token = initializer === undefined ? null : forwardedNumericToken(scope, initializer);
      if (scope.meter.refusal !== null) return null;
      constant = available({ kind: "number", checkerValue: value, authored: token });
    } else if (typeof value === "string") constant = available({ kind: "string", value });
    members.push({ declaration: reference, constant });
  }
  return { declaration, nominal, declarations, members };
}

function rawSymbol(scope: CaptureScope, symbol: CheckerSymbol): RawSymbolId | null {
  const known = scope.tables.symbolIds.get(symbol);
  if (known !== undefined) return known;
  if (!admit(scope, "facts")) return null;
  const id = rawSymbolId(scope.tables.symbols.length);
  const target = symbolTarget(scope, symbol, null);
  if (target === null) return null;
  scope.tables.symbols.push({ id, name: scope.checker.getSymbolName(symbol), target });
  // The identity is known only once its row exists (R2 M-1): a refusal inside leaves no entry without a row.
  scope.tables.symbolIds.set(symbol, id);
  return id;
}

function bindingTarget(scope: CaptureScope, symbol: CheckerSymbol | undefined): RawFact<RawBindingTarget> | null {
  if (symbol === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
  const step = scope.checker.getAliasStep(symbol);
  if (step === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
  if (step.kind === "unresolved") return originalFailure(scope, step.cause);
  const targetSymbol = step.kind === "symbol" ? step.symbol : step.exportAssignment;
  return symbolTarget(scope, targetSymbol, step.kind === "exported-value-member" ? step.member : null);
}

function originalDiagnosticReference(scope: CaptureScope, diagnostic: CheckerDiagnostic): CheckerDiagnosticRef | null {
  if (!admit(scope, "facts")) return null;
  let root = scope.diagnosticRoots.get(diagnostic);
  if (root === undefined && diagnostic.file !== undefined && diagnostic.file !== scope.file) {
    const path = scope.checked.ast.getFileName(diagnostic.file);
    const module = OpenedProgram.moduleAt(scope.program, path);
    const input = module === undefined ? undefined : OpenedProgram.file(scope.program, module);
    if (input?.file !== diagnostic.file || module === undefined)
      return throwInvariant(invariant("A checker cause must name its actual opened source file."));
    const syntax = fileNumberingOf(scope.deps, scope.program, path, module);
    if (syntax.kind === "refused") {
      scope.meter.refusal = syntax.diagnostic;
      return null;
    }
    captureFileDiagnostics(scope.program, module, input, syntax.numbering.ids, scope.diagnosticRoots, () => admit(scope, "facts"));
    if (scope.meter.refusal !== null) return null;
    root = scope.diagnosticRoots.get(diagnostic);
  }
  if (root === undefined) return throwInvariant(invariant("An actual checker failure must retain membership in its original published checker diagnostic run."));
  return root;
}

function checkerCause(diagnostic: CheckerDiagnosticRef): Cause {
  return { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic } };
}

function originalFailure(scope: CaptureScope, diagnostic: CheckerDiagnostic): Extract<RawFact<never>, { readonly kind: "unavailable" }> | null {
  const root = originalDiagnosticReference(scope, diagnostic);
  return root === null ? null : { kind: "unavailable", reason: "checker-error", causes: [checkerCause(root)] };
}

function originalTypeFailure(scope: CaptureScope, diagnostics: readonly CheckerDiagnostic[]): Extract<RawFact<never>, { readonly kind: "unavailable" }> | null {
  const first = diagnostics[0];
  if (first === undefined) return throwInvariant(invariant("A failed type answer requires its actual original diagnostics."));
  if (diagnostics.length === 1) return originalFailure(scope, first);
  const roots = new Set<CheckerDiagnosticRef>();
  const causes: Cause[] = [];
  for (let index = 0; index < diagnostics.length; index += 1) {
    const diagnostic = diagnostics[index];
    if (diagnostic === undefined) return throwInvariant(invariant("Original type diagnostics must be dense."));
    const root = originalDiagnosticReference(scope, diagnostic);
    if (root === null) return null;
    if (roots.has(root)) continue;
    roots.add(root);
    causes.push(checkerCause(root));
  }
  return { kind: "unavailable", reason: "checker-error", causes };
}

function symbolTarget(scope: CaptureScope, targetSymbol: CheckerSymbol, memberTarget: ResolvedAliasTarget | undefined | null): RawFact<RawBindingTarget> | null {
  const declarations: RawNodeRef[] = [];
  let targetBinding = false;
  let targetModule: ModuleId | null = null;
  for (const declaration of scope.checker.getSymbolDeclarations(targetSymbol)) {
    if (!admit(scope, "edges")) return null;
    if (declaration === undefined) return throwInvariant(invariant("An alias target declaration inventory contains an absent row."));
    const reference = referenceTo(scope, scope.program, declaration);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
    const kind = scope.checked.ast.kindName(declaration);
    if (memberTarget === null && kind === "KindSourceFile") {
      if (targetModule !== null && targetModule !== reference.module)
        return throwInvariant(invariant("A module alias cannot name two different source-file modules."));
      targetModule = reference.module;
    }
    if (isModuleBindingKind(kind.replace(/^Kind/u, ""), scope.checked.ast.name(declaration) !== undefined)) targetBinding = true;
    declarations.push(reference);
  }
  if (targetModule !== null) return available({ kind: "module", module: targetModule });
  declarations.sort((left, right) => left.module < right.module ? -1 : left.module > right.module ? 1 : left.node - right.node);
  const first = declarations[0];
  if (first === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
  if (memberTarget !== null) {
    const failed = memberTarget?.kind === "unresolved" ? originalFailure(scope, memberTarget.cause) : null;
    const member = memberTarget?.kind === "symbol" ? rawSymbol(scope, memberTarget.symbol) : null;
    if (scope.meter.refusal !== null) return null;
    return available({ kind: "member", through: [first, ...declarations.slice(1)],
      member: failed ?? (member === null ? { kind: "unavailable", reason: "incomplete-association", causes: [] } : available(member)),
      key: failed ?? { kind: "unavailable", reason: "incomplete-association", causes: [] },
      origins: failed ?? { kind: "unavailable", reason: "incomplete-association", causes: [] } });
  }
  if (targetBinding) {
    if (declarations.length !== 1) return throwInvariant(invariant("A nearest alias binding must identify its actual single syntax occurrence."));
    return available({ kind: "binding", occurrence: first });
  }
  return available({ kind: "declarations", declarations: [first, ...declarations.slice(1)] });
}

interface AppliedCallableTarget {
  readonly original: Signature;
  readonly selected: Signature;
  readonly declaration: Node;
  selectedOwnDeclaration?: boolean;
}

function appliedCallableTarget(scope: CaptureScope, signature: Signature, callable: CallableUse): AppliedCallableTarget | undefined {
  const original = signature.target;
  if (original === undefined || signature.mapper === undefined || signature.composite !== undefined ||
    original.target !== undefined || original.mapper !== undefined || original.composite !== undefined || !admit(scope, "edges")) return undefined;
  if (callable.kind === "callback") return signature === callable.selected && original === callable.original
    ? { original, selected: signature, declaration: callable.syntax } : undefined;
  const declaration = scope.checker.getSignatureDeclaration(original);
  if (declaration === undefined || !callable.declarations.has(declaration)) return undefined;
  const ast = scope.checked.ast;
  const owner = ast.parent(declaration);
  if (owner === undefined || ast.kindName(owner) !== "KindInterfaceDeclaration" ||
    scope.checker.getSymbolAtLocation(ast.name(owner)) !== callable.receiver.target) return undefined;
  return { original, selected: signature, declaration };
}

function selectedCallableDeclarationMatches(scope: CaptureScope, target: AppliedCallableTarget): boolean {
  if (scope.meter.refusal !== null) return false;
  if (target.selectedOwnDeclaration === undefined) {
    if (!admit(scope, "edges")) return false;
    target.selectedOwnDeclaration = scope.checker.getSignatureDeclaration(target.selected) === target.declaration;
  }
  return target.selectedOwnDeclaration;
}

function appliedFormalUses(scope: CaptureScope, target: AppliedCallableTarget, use: CallableUse): ReadonlyMap<number, FormalUse> | null {
  const { original, selected: signature, declaration: owner } = target;
  const receiver = use.receiver;
  const sources = signatureParameters(scope, original);
  if (sources === null) return null;
  const applied = signatureParameters(scope, signature);
  if (applied === null) return null;
  if (sources.length !== applied.length) return null;
  let uses: Map<number, FormalUse> | undefined;
  for (let index = 0; index < sources.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const source = sources[index];
    const selected = applied[index];
    if (source === undefined || selected === undefined || source.declaration === undefined || source.declaration !== selected.declaration ||
      original.parameters[index] !== source.sourceSymbol || signature.parameters[index] !== selected.sourceSymbol) continue;
    const bound = receiver.slots.get(source.type);
    const tupleArgument = bound?.declaration === null;
    const originalAnnotation = scope.checked.ast.typeNode(source.declaration);
    const originalName = tupleArgument && originalAnnotation !== undefined ? parameterReferenceName(scope, originalAnnotation) : undefined;
    const binder = originalName === undefined ? undefined : scope.checker.getTypeSymbol(source.type);
    const direct = bound !== undefined && selected.type === bound.argument && (tupleArgument
      ? scope.checked.ast.parent(source.declaration) === owner &&
        source.parameterKind === "required" && selected.parameterKind === "required" && !source.acceptsOmission && !selected.acceptsOmission &&
        source.typeSource === originalAnnotation && binder !== undefined && scope.checker.getSymbolAtLocation(originalName) === binder
      : source.type !== selected.type ||
      source.parameterKind === "required" && selected.parameterKind === "required" && source.typeSource !== undefined
      && source.typeSource === originalAnnotation
      && isMergedBinderUse(scope, source.typeSource, source.type));
    const optional = source.parameterKind === "optional";
    const declaration = !direct && use.kind === "member" && (optional || source.parameterKind === "required") &&
      source.parameterKind === selected.parameterKind && source.acceptsOmission === optional && selected.acceptsOmission === optional &&
      scope.checked.ast.kindName(source.declaration) === "KindParameter" ? scope.checked.ast.as.AsParameterDeclaration(source.declaration) : undefined;
    const syntax = declaration !== undefined && (declaration.QuestionToken !== undefined) === optional &&
      declaration.DotDotDotToken === undefined && declaration.Initializer === undefined ? declaration.Type : undefined;
    const callback = syntax !== undefined && scope.checked.ast.kindName(syntax) === "KindFunctionType" ? syntax : undefined;
    const ast = scope.checked.ast;
    const wholeRest = use.kind === "member" && source.parameterKind === "rest";
    const receiverArray = use.kind === "callback" && source.parameterKind === "required" || wholeRest;
    let arraySyntax: Node | undefined;
    if (!direct && receiverArray && source.parameterKind === selected.parameterKind && source.acceptsOmission === selected.acceptsOmission &&
      (wholeRest || selected.type === receiver.type) && ast.parent(source.declaration) === owner) {
      if (!wholeRest) arraySyntax = ast.typeNode(source.declaration);
      else if (ast.kindName(source.declaration) === "KindParameter") {
        const parameter = ast.as.AsParameterDeclaration(source.declaration);
        if (parameter?.DotDotDotToken !== undefined && parameter.QuestionToken === undefined && parameter.Initializer === undefined)
          arraySyntax = parameter.Type;
      }
    }
    const named = use.kind === "callback" && arraySyntax !== undefined && ast.kindName(arraySyntax) === "KindTypeReference"
      ? ast.as.AsTypeReferenceNode(arraySyntax) : undefined;
    const projected = arraySyntax !== undefined && selected.type === receiver.type &&
      (ast.kindName(arraySyntax) === "KindArrayType" || named?.TypeName !== undefined &&
        scope.checker.getSymbolAtLocation(named.TypeName) === receiver.target) ? arraySyntax : undefined;
    const sole = onlyReceiverSlot(receiver);
    const rest = wholeRest && arraySyntax !== undefined && projected === undefined && sole !== undefined && sole.composition === undefined
      ? restArraySyntax(scope, arraySyntax) : undefined;
    if (!direct && callback === undefined && projected === undefined && rest === undefined) continue;
    if (rest?.kind === "declared") {
      if (sole?.declaration !== null) continue;
      const matches = selectedCallableDeclarationMatches(scope, target);
      if (scope.meter.refusal !== null) return null;
      if (!matches) continue;
    }
    const roots = scope.checker.getRootSymbols(selected.sourceSymbol);
    if (roots.length !== 1 || roots[0] !== source.sourceSymbol) continue;
    if (callback !== undefined) (uses ??= new Map()).set(index,
      { kind: "callback-input", receiver, syntax: callback, optional, original: source.type, selected: selected.type });
    else if (projected !== undefined) (uses ??= new Map()).set(index,
      { kind: "receiver-projection", receiver, syntax: projected, source: { kind: "formal", type: source.type } });
    else if (rest !== undefined) (uses ??= new Map()).set(index,
      { kind: "rest-input", receiver, syntax: rest, original: source.type, selected: selected.type });
    else if (bound !== undefined) (uses ??= new Map()).set(index, bound.composition ?? bound.source);
  }
  return uses ?? null;
}

function rawSignature(scope: CaptureScope, signature: Signature, owner: RawNodeRef, kind: "call" | "construct",
  callable: CallableUse | null = null): RawSignatureId | null {
  const target = callable === null ? undefined : appliedCallableTarget(scope, signature, callable);
  if (scope.meter.refusal !== null) return null;
  const receiver = target === undefined ? undefined : callable?.receiver;
  const formalUses = target === undefined || callable === null ? null : appliedFormalUses(scope, target, callable);
  if (scope.meter.refusal !== null) return null;
  const syntax = target === undefined ? undefined : scope.checked.ast.typeNode(target.declaration);
  let result: ResultBindingUse | null = null;
  if (callable?.kind === "member" && target !== undefined && receiver !== undefined && syntax !== undefined) {
    const union = undefinedUnionSyntax(scope, syntax);
    const reference = receiverSyntax(scope, syntax);
    const sole = onlyReceiverSlot(receiver);
    const element = sole?.declaration === null ? writtenBracketedElement(scope, syntax) : undefined;
    const name = sole?.declaration === null ? parameterReferenceName(scope, syntax) : undefined;
    const projectsReceiver = sole?.declaration === null ? tupleReference(scope, syntax) !== undefined
      : sole !== undefined ? reference !== undefined || tupleReference(scope, syntax) !== undefined
      : reference?.name !== undefined && scope.checker.getSymbolAtLocation(reference.name) === receiver.target;
    if (scope.meter.refusal !== null) return null;
    if (union !== undefined) result = { kind: "union-result", syntax: union, original: target.original, receiver };
    else if (name !== undefined || element !== undefined || projectsReceiver || scope.checked.ast.kindName(syntax) === "KindThisType") {
      const carriesTuple = sole?.declaration === null && (name !== undefined || element !== undefined || projectsReceiver);
      const matches = !carriesTuple || selectedCallableDeclarationMatches(scope, target);
      if (scope.meter.refusal !== null) return null;
      if (matches)
        result = name !== undefined ? { kind: "direct-result", receiver, original: target.original, syntax, name }
          : { kind: "receiver-projection", receiver, syntax, source: element === undefined
          ? { kind: "result", signature: target.original } : { kind: "tuple-array-result", signature: target.original, element } };
    }
  } else if (callable?.kind === "callback" && syntax !== undefined && target !== undefined) {
    const name = parameterReferenceName(scope, syntax);
    if (name !== undefined) result = { kind: "direct-result", receiver: callable.receiver, original: target.original, syntax, name };
  }
  const qualifiedUse = formalUses === null && result === null ? undefined : receiver;
  let qualified = qualifiedUse === undefined ? undefined : scope.tables.qualifiedSignatures.get(signature);
  const selector = qualifiedUse === undefined ? undefined : receiverSignatureSelector(qualifiedUse, onlyReceiverSlot(qualifiedUse));
  const binder = selector?.binder;
  let receivers = binder === undefined ? undefined : qualified?.get(binder);
  let occurrences = qualifiedUse === undefined ? undefined : receivers?.get(qualifiedUse.type);
  const source = selector?.source;
  let projections = source === undefined ? undefined : occurrences?.get(source);
  const fields = (result === null ? "" : result.kind === "union-result" ? "u;" : result.kind === "direct-result" ? "d;" : "r;") + (formalUses === null ? "" :
    Array.from(formalUses, ([index, use]) => ("Kind" in use ? "p" : use.kind === "callback-input" ? "f"
      : use.kind === "rest-input" ? use.syntax.kind === "declared" ? "w" : "g" : use.kind === "composed-union" ? "v" : "a") + index).join(","));
  const known = qualifiedUse === undefined ? scope.tables.signatureIds.get(signature) : projections?.get(fields);
  if (known !== undefined) return known;
  if (!admit(scope, "facts")) return null;
  const id = rawSignatureId(scope.tables.nextSignature++);
  if (qualifiedUse === undefined || binder === undefined || source === undefined) scope.tables.signatureIds.set(signature, id);
  else {
    if (qualified === undefined) scope.tables.qualifiedSignatures.set(signature, qualified = new Map());
    if (receivers === undefined) qualified.set(binder, receivers = new Map());
    if (occurrences === undefined) receivers.set(qualifiedUse.type, occurrences = new Map());
    if (projections === undefined) occurrences.set(source, projections = new Map());
    projections.set(fields, id);
  }
  scope.tables.pending.push({ kind: "signature", id, signature, owner, signatureKind: kind,
    use: qualifiedUse === undefined ? null : { formals: formalUses, result } });
  return id;
}

function captureSignature(scope: CaptureScope, id: RawSignatureId, signature: Signature, owner: RawNodeRef, kind: "call" | "construct",
  use: SignatureBindingUse | null): void {
  const program = scope.program;
  const declarationNode = scope.checker.getSignatureDeclaration(signature);
  const declaration = declarationNode === undefined ? null : referenceTo(scope, program, declarationNode);
  if (scope.meter.refusal !== null) return;
  const original = signature.target;
  if (original === signature) return throwInvariant(invariant("A signature cannot be its own original target."));
  const target = original === undefined ? null : rawSignature(scope, original, owner, kind);
  if (original !== undefined && target === null) return;
  const parameterInfos = signatureParameters(scope, signature);
  if (parameterInfos === null) return;
  scope.tables.pending.push({ kind: "signature-parameter", index: 0, draft: { id, signature, target, owner, kind, declaration,
    parameterInfos, parameters: [], use } });
}

function signatureAnnotationOperator(scope: CaptureScope, annotation: Node | null | undefined, checkedSource: Node | undefined): RawNodeRef | null {
  if (annotation === null || annotation === undefined || checkedSource !== annotation) return null;
  const kind = scope.checked.ast.kindName(annotation);
  if (kind !== "KindConditionalType" && kind !== "KindIndexedAccessType" && kind !== "KindMappedType"
    && (kind !== "KindTypeOperator" || scope.checked.ast.operatorKindName(annotation) !== "KindKeyOfKeyword")) return null;
  if (!admit(scope, "edges")) return null;
  const source = referenceTo(scope, scope.program, annotation);
  if (source === null && scope.meter.refusal === null)
    return throwInvariant(invariant("An exact signature annotation must belong to the admitted source domain."));
  return source;
}

function captureSignatureParameter(scope: CaptureScope, draft: SignatureDraft, index: number): void {
  const { id, owner, parameters } = draft;
  const program = scope.program;
  if (index < draft.parameterInfos.length) {
    const parameter = draft.parameterInfos[index];
    if (parameter === undefined) return throwInvariant(invariant("A signature parameter vector contains a missing entry."));
    const symbol = parameter.sourceSymbol;
    const parameterNode = parameter.declaration;
    const parameterReference = parameterNode === undefined ? null : referenceTo(scope, program, parameterNode);
    if (scope.meter.refusal !== null) return;
    const position = component(scope, owner, { kind: "parameter", signature: id, index });
    if (position === null) return;
    const parameterSymbol = rawSymbol(scope, symbol);
    if (parameterSymbol === null) return;
    scope.tables.pending.push({ kind: "signature-parameter", draft, index: index + 1 });
    const parameterSyntax = parameterNode === undefined || scope.checked.ast.kindName(parameterNode) !== "KindParameter"
      ? undefined : scope.checked.ast.as.AsParameterDeclaration(parameterNode);
    if (parameterNode !== undefined && scope.checked.ast.kindName(parameterNode) === "KindParameter" && parameterSyntax === undefined)
      return throwInvariant(invariant("The checker gave no parameter syntax for its parameter declaration."));
    const originalUse = parameterReference !== null && draft.target === null
      && draft.signature.mapper === undefined && draft.signature.composite === undefined ? parameterSyntax?.Type ?? null : null;
    const operator = signatureAnnotationOperator(scope, originalUse, parameter.typeSource);
    if (scope.meter.refusal !== null) return;
    const role = parameterSyntax?.QuestionToken !== undefined && parameterSyntax.DotDotDotToken === undefined
      && parameter.parameterKind === "optional" && parameter.acceptsOmission ? "optional"
      : parameterSyntax?.QuestionToken === undefined && parameterSyntax?.DotDotDotToken !== undefined && parameter.parameterKind === "rest" ? "rest" : null;
    const authoredArms = originalUse !== null && parameterNode !== undefined && parameterSyntax?.Initializer === undefined
      && role !== null && scope.checker.getSignatureDeclaration(draft.signature) === scope.checked.ast.parent(parameterNode) &&
      draft.signature.parameters[index] === symbol ? authoredCompoundArms(scope, parameter.type, originalUse, role,
        () => scope.shape.getUnionOrIntersectionTypes(parameter.type)) : null;
    if (scope.meter.refusal !== null) return;
    const use = draft.use?.formals?.get(index) ?? authoredArms ?? undefined;
    let origin = operator ?? originalUse;
    if (use === undefined && originalUse !== null && operator === null && parameter.parameterKind === "rest"
      && parameterSyntax?.DotDotDotToken !== undefined && scope.shape.isTuple(parameter.type)) {
      if (!admit(scope, "edges")) return;
      const source = referenceTo(scope, program, originalUse);
      if (scope.meter.refusal !== null) return;
      if (source === null) return throwInvariant(invariant("A rest tuple must retain its actual authored annotation."));
      origin = source;
    }
    const type = rawType(scope, () => withoutTypeCause(parameter.type, parameter.typeSource), position,
      use !== undefined && "Kind" in use ? use : origin, use !== undefined && !("Kind" in use) ? use : null);
    if (type === null) return;
    const initializerNode = parameterSyntax?.Initializer;
    const initializer = initializerNode === undefined ? null : referenceTo(scope, program, initializerNode);
    if (scope.meter.refusal !== null) return;
    if (!admit(scope, "facts")) return;
    const passingFact = declarationPassing(scope, parameterNode);
    const passing: RawParameter["passing"] = passingFact === undefined
      ? parameterSyntax !== undefined && parameterReference !== null && scope.closedOrdinaryPassing &&
        snapshotDeclaration(program, parameterReference) ? available("by-value") : notProvided()
      : available(passingFact.mode);
    parameters.push({ declaration: parameterReference, symbol: parameterSymbol, kind: parameter.parameterKind, component: position, type, acceptsOmission: parameter.acceptsOmission,
      initializer, passing });
    return;
  }
  captureSignatureTail(scope, draft);
}

function isMergedBinderUse(scope: CaptureScope, node: Node, type: Type): boolean {
  const name = parameterReferenceName(scope, node);
  const symbol = name === undefined ? undefined : scope.checker.getTypeSymbol(type);
  return symbol !== undefined && scope.checker.getSymbolAtLocation(name) === symbol
    && scope.checker.getSymbolDeclarations(symbol).length > 1;
}

function isMergedBinderArgument(scope: CaptureScope, node: Node, type: Type): boolean {
  if (isMergedBinderUse(scope, node, type)) return true;
  if (!scope.shape.isTuple(type)) return false;
  const syntax = tupleSyntax(scope, node);
  if (syntax === undefined || syntax.elements.length === 0 || !admit(scope, "edges")) return false;
  const actual = scope.shape.getTupleInfo(type);
  if (actual === undefined || actual.readonly !== syntax.readonly || actual.elements.length !== syntax.elements.length) return false;
  for (let index = 0; index < actual.elements.length; index += 1) {
    if (!admit(scope, "edges")) return false;
    const slot = actual.elements[index];
    const source = syntax.elements[index];
    if (slot?.elementKind !== "required" || slot.declaration !== undefined || source === undefined
      || !isMergedBinderUse(scope, source, slot.type)) return false;
  }
  return true;
}

function authoredArgumentSources(scope: CaptureScope, annotation: Node, target: CheckerSymbol,
  inputs: readonly TypeReferenceArgumentInfo[], authorizes: () => boolean, direct: boolean): DeclaredArgumentsUse | null {
  const ast = scope.checked.ast;
  const syntax = ast.kindName(annotation) === "KindTypeReference" ? ast.as.AsTypeReferenceNode(annotation) : undefined;
  const arguments_ = syntax?.TypeArguments?.Nodes;
  if (syntax === undefined || arguments_ === undefined || arguments_.length === 0 || !admit(scope, "edges")) return null;
  if (scope.checker.getSymbolAtLocation(syntax.TypeName) !== target) return null;
  let local = 0;
  let admitted = false;
  let slots: Map<Type, DeclaredArgumentUse> | undefined;
  for (let index = 0; index < inputs.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const input = inputs[index];
    if (input === undefined) return throwInvariant(invariant("A reference requires every actual native argument slot."));
    if (input.scope !== "local") continue;
    const authored = arguments_[local++];
    if (authored === undefined) return null;
    const kind = ast.kindName(authored);
    const dependent = direct && ((input.argument.flags & TypeFlagsConditional) !== 0 && kind === "KindConditionalType" ||
      (input.argument.flags & TypeFlagsIndexedAccess) !== 0 && kind === "KindIndexedAccessType");
    if (!dependent && !isMergedBinderArgument(scope, authored, input.argument)) {
      if (scope.meter.refusal !== null) return null;
      continue;
    }
    if (!admitted) {
      if (!authorizes()) return null;
      admitted = true;
    }
    if (!admit(scope, "edges")) return null;
    const answer = sourceType(scope, { kind: "annotation", node: authored });
    if (scope.meter.refusal !== null) return null;
    if (answer?.type !== input.argument || answer.causes.length !== 0) continue;
    if (!admit(scope, "facts")) return null;
    (slots ??= new Map()).set(input.parameter, { authored, selected: authored, argument: input.argument });
  }
  return local === arguments_.length && slots !== undefined ? { kind: "declared-arguments", slots } : null;
}

function unchangedResultArguments(scope: CaptureScope, signature: Signature, type: Type): DeclaredArgumentsUse | null {
  const original = signature.target;
  const declaration = original?.declaration;
  const ast = scope.checked.ast;
  if (original === undefined || declaration === undefined || signature.declaration !== declaration || signature.composite !== undefined
    || ast.kindName(declaration) !== "KindMethodSignature" || !scope.shape.isTypeReference(type)) return null;
  const annotation = ast.typeNode(declaration);
  if (annotation === undefined || ast.kindName(annotation) !== "KindTypeReference" || !admit(scope, "edges")) return null;
  const owner = scope.shape.getTypeReferenceTarget(type);
  const target = scope.checker.getTypeSymbol(owner);
  if (target === undefined || !admit(scope, "edges")) return null;
  const inputs = scope.shape.getTypeReferenceArgumentInfos(type);
  return inputs === undefined ? null : authoredArgumentSources(scope, annotation, target, inputs, () => {
    if (!admit(scope, "edges")) return false;
    const answer = sourceType(scope, { kind: "signature-return", signature: original });
    return answer?.type === type && answer.typeSource === annotation && answer.causes.length === 0;
  }, false);
}

function captureSignatureTail(scope: CaptureScope, draft: SignatureDraft): void {
  const { id, signature, target, owner, kind, declaration, parameters } = draft;
  const program = scope.program;
  // The explicit this receiver (K-3361), which the checker keeps apart from the ordinary parameters: the SDK's own
  // query answers it, so its absence is the checker's, not assumed.
  const thisSymbol = scope.checker.getSignatureThisParameter(signature);
  let receiver: RawParameter | null = null;
  if (thisSymbol !== undefined) {
    const receiverNode = scope.checker.getSymbolDeclarations(thisSymbol)[0];
    const receiverReference = receiverNode === undefined ? null : referenceTo(scope, program, receiverNode);
    if (scope.meter.refusal !== null) return;
    const position = component(scope, owner, { kind: "receiver", signature: id });
    if (position === null) return;
    const receiverSymbol = rawSymbol(scope, thisSymbol);
    if (receiverSymbol === null) return;
    const type = rawType(scope, () => withoutTypeCause(scope.checker.getTypeOfSymbol(thisSymbol)), position, null);
    if (type === null) return;
    receiver = { declaration: receiverReference, symbol: receiverSymbol, kind: "required", component: position, type, acceptsOmission: false, initializer: null,
      passing: notProvided() };
  }
  const typeParameters: RawTypeId[] = [];
  for (let index = 0; index < signature.typeParameters.length; index += 1) {
    if (!admit(scope, "edges")) return;
    const parameter = signature.typeParameters[index];
    const symbol = parameter === undefined ? undefined : scope.checker.getTypeSymbol(parameter);
    const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
    const selected = declarations[0];
    if (parameter === undefined || declarations.length !== 1 || selected === undefined || scope.checked.ast.kindName(selected) !== "KindTypeParameter")
      throw new TypeError("front: a signature type parameter requires its actual source declaration");
    const reference = requiredCallReference(scope, selected);
    if (reference === null) return;
    const captured = rawType(scope, () => withoutTypeCause(parameter), component(scope, reference, null), null);
    if (captured === null) return;
    typeParameters.push(captured);
  }
  const declared = declaration !== null && target === null && signature.mapper === undefined && signature.composite === undefined
    ? admittedTypeUse(scope, declaration) : undefined;
  const resultSyntax = declared === undefined ? undefined : scope.checked.ast.typeNode(declared);
  const resultKind = scope.checked.ast.kindName(resultSyntax);
  const originalUse = resultSyntax !== undefined && (resultKind === "KindUnionType" || resultKind === "KindThisType" ||
    scope.sourcePrimitiveFacts && (resultKind === "KindTypeReference" || resultKind === "KindImportType" || resultKind === "KindArrayType") ||
    declared !== undefined && scope.checked.ast.kindName(declared) === "KindFunctionType" && parameterReferenceName(scope, resultSyntax) !== undefined ||
    receiverInput(scope, resultSyntax) !== undefined || tupleReference(scope, resultSyntax) !== undefined) ? resultSyntax : null;
  const resultPosition = component(scope, owner, { kind: "result", signature: id });
  if (resultPosition === null || !admit(scope, "facts")) return;
  const answer = sourceType(scope, { kind: "signature-return", signature });
  if (scope.meter.refusal !== null) return;
  const operator = signatureAnnotationOperator(scope, resultSyntax, answer?.typeSource);
  if (scope.meter.refusal !== null) return;
  const direct = resultSyntax !== undefined && answer?.typeSource === resultSyntax
    && scope.checked.ast.kindName(resultSyntax) === "KindTypeReference" ? resultSyntax : null;
  let use: TypeBindingUse | null = draft.use?.result ?? (answer === undefined || answer.causes.length !== 0
    ? null : unchangedResultArguments(scope, signature, answer.type));
  if (scope.meter.refusal !== null) return;
  const projected = answer?.projectedReturn;
  if (use === null && declaration !== null && projected !== undefined) {
    const authored = referenceTo(scope, program, projected.declaration);
    if (scope.meter.refusal !== null) return;
    if (authored !== declaration || projected.selected !== answer?.type)
      return throwInvariant(invariant("A selected signature result must retain its actual declaration and native parameter."));
    if (projected.kind === "receiver") {
      const ast = scope.checked.ast;
      if (target === null || ast.typeNode(projected.declaration) !== projected.annotation
        || ast.kindName(projected.annotation) !== "KindThisType" || !scope.shape.isTuple(projected.selected))
        return throwInvariant(invariant("A selected receiver result must retain its actual written this and mapped tuple."));
      use = { kind: "projected-operand", role: "receiver-tuple-result", type: projected.selected };
    } else {
      const declarations = mergedArgumentGroup(scope, projected.selected);
      if (scope.meter.refusal !== null) return;
      if (declarations !== null) use = { kind: "merged-slot", type: projected.selected, declarations };
    }
  }
  const tupleResult = resultSyntax !== undefined && answer?.typeSource !== undefined && scope.shape.isTuple(answer.type)
    && (answer.typeSource === resultSyntax || answer.typeSource === unparenthesizedType(scope, resultSyntax));
  if (scope.meter.refusal !== null) return;
  const authored = resultSyntax !== undefined && (tupleResult || answer?.typeSource === resultSyntax &&
    (resultKind === "KindArrayType" || resultKind === "KindUnionType" || resultKind === "KindIntersectionType" ||
      resultKind === "KindTypeReference" || resultKind === "KindMappedType"))
    ? referenceTo(scope, program, resultSyntax) : null;
  if (scope.meter.refusal !== null) return;
  const result = enqueueRawType(scope, answer, resultPosition, operator ?? authored ?? originalUse ?? direct, use, null);
  scope.tables.signatures[id] = {
    id, target, owner, declaration, kind, typeParameters: available(typeParameters), receiver: available(receiver), parameters,
    result: available(result), composition: null,
  };
}

function qualifiedStorageAnnotation(scope: CaptureScope, declaration: Node | undefined, selected: ResolvedSourceTypeInfo | undefined): Node | null {
  if (!scope.sourcePrimitiveFacts || declaration === undefined || selected === undefined || selected.causes.length !== 0
    || !admit(scope, "edges")) return null;
  const kind = scope.checked.ast.kindName(declaration);
  if (kind !== "KindParameter" && kind !== "KindVariableDeclaration") return null;
  const annotation = scope.checked.ast.typeNode(declaration);
  if (annotation === undefined) return null;
  const answer = sourceType(scope, { kind: "annotation", node: annotation });
  return answer?.type === selected.type && answer.causes.length === 0 ? annotation : null;
}

function capturedStorage(scope: CaptureScope, node: Node, occurrence: RawNodeRef, assignment: Node | null): RawStorageCapture | null {
  if (!admit(scope, "facts")) return null;
  const outcome = scope.checker.acquireResolvedStorage(node, nativeCaptureAdmission(scope));
  if (outcome.kind === "refused") {
    if (outcome.stop !== scope.meter.refusal)
      return throwInvariant(invariant("A storage acquisition must retain its actual first capture refusal."));
    return null;
  }
  if (outcome.kind === "unavailable") return { node: occurrence, fact: notProvided() };
  const selected = outcome.value;
  const expression = referenceTo(scope, scope.program, selected.expression);
  if (scope.meter.refusal !== null) return null;
  const storageExpression = referenceTo(scope, scope.program, selected.storageExpression);
  if (scope.meter.refusal !== null) return null;
  const declaration = selected.declaration === undefined ? null : referenceTo(scope, scope.program, selected.declaration);
  if (scope.meter.refusal !== null) return null;
  if (expression === null || expression.module !== occurrence.module || expression.node !== occurrence.node || storageExpression === null)
    return throwInvariant(invariant("A captured storage answer must retain its actual expression and storage syntax."));
  const symbol = selected.symbol === undefined ? null : rawSymbol(scope, selected.symbol);
  if (selected.symbol !== undefined && symbol === null) return null;
  const written = qualifiedStorageAnnotation(scope, selected.declaration, selected.type);
  if (scope.meter.refusal !== null) return null;
  const type = rawType(scope, () => selected.type, component(scope, occurrence, null), written);
  if (type === null) return null;
  if (assignment !== null && written !== null && selected.writable) {
    if (!admit(scope, "facts", scope.rootAssignmentAnnotations === null ? 2 : 1)) return null;
    (scope.rootAssignmentAnnotations ??= new Map()).set(assignment, written);
  }
  return { node: occurrence, fact: available({ expression, storageExpression, declaration, symbol, type, writable: selected.writable }) };
}

function inferredStorageAlias(scope: CaptureScope, node: Node, answer: ResolvedSourceTypeInfo | undefined): RawNodeRef | null {
  const ast = scope.checked.ast;
  const declaration = ast.as.AsVariableDeclaration(node);
  if (declaration === undefined || declaration.Type !== undefined || declaration.Initializer === undefined || answer === undefined
    || answer.causes.length !== 0 || !admit(scope, "edges")) return null;
  const type = answer.type;
  if (type.alias === undefined || !admit(scope, "edges")) return null;
  const application = nativeAliasApplication(scope, type, scope.shape.acquireTypeAliasApplication);
  if (scope.meter.refusal !== null) return null;
  if (application === undefined || application.result !== type || application.bindings.length !== 0
    || ast.kindName(application.declaration) !== "KindTypeAliasDeclaration" || ast.kindName(application.typeNode) !== "KindTypeLiteral"
    || ast.typeNode(application.declaration) !== application.typeNode || !admit(scope, "edges")) return null;
  return referenceTo(scope, scope.program, application.declaration);
}

function requiredCallReference(scope: CaptureScope, node: Node): RawNodeRef | null {
  const reference = referenceTo(scope, scope.program, node);
  if (reference !== null || scope.meter.refusal !== null) return reference;
  return throwInvariant(invariant("A call or signature association must retain its actual source node."));
}

type SelectedCall = Extract<ResolvedCallSelectionEvidence, { readonly kind: "applicable" }>["selection"];

function contributedFormalType(scope: CaptureScope, application: SelectedCall["application"],
  contribution: ResolvedCallInferenceContribution): Type | undefined {
  if (contribution.sourcePath.length !== 0) return undefined;
  const { origin, formalPath, formalRootType } = contribution;
  if (formalPath.length === 0) return formalRootType;
  if (origin.kind !== "argument" || formalPath.length !== 1 || !admit(scope, "edges")) return undefined;
  const projection = formalPath[0];
  if (projection?.kind !== "union-member" || projection.owner !== formalRootType || projection.member !== contribution.typeParameter)
    return undefined;
  const parameter = application.signatureShape.parameters[origin.parameterIndex];
  const declaration = parameter?.declaration;
  const ast = scope.checked.ast;
  if (parameter?.index !== origin.parameterIndex || parameter.rest || !parameter.optional ||
    declaration === undefined || ast.parent(declaration) !== application.signatureShape.declaration ||
    ast.kindName(declaration) !== "KindParameter" || !admit(scope, "edges")) return undefined;
  const formal = ast.as.AsParameterDeclaration(declaration);
  const annotation = formal?.Type;
  if (formal?.Initializer === undefined || formal.QuestionToken !== undefined || annotation === undefined || !admit(scope, "edges"))
    return undefined;
  const written = sourceType(scope, { kind: "annotation", node: annotation });
  if (written?.type !== projection.member || written.causes.length !== 0) return undefined;
  const arms = undefinedUnionArms(scope, formalRootType);
  return arms?.value === projection.member && arms.valueIndex === projection.index ? arms.value : undefined;
}

function captureSelectedBindings(scope: CaptureScope, selected: SelectedCall, invocation: RawNodeRef, original: RawSignatureId): {
  readonly arguments: readonly RawTypeArgument[];
  readonly contributions: RawFact<readonly RawInferenceContribution[]>;
} | null {
  const { application, inferenceContributions } = selected;
  const parameters = application.signature.typeParameters;
  const nativeArguments = application.signatureTypeArguments;
  const nativeContributions = inferenceContributions.kind === "available" ? inferenceContributions.contributions : [];
  const ast = scope.checked.ast;
  const declared = application.signatureShape.declaration;
  const originalNodes = declared === undefined ? [] : ast.typeParameters(declared);
  const authored = ast.typeArguments(application.invocation);
  if (nativeArguments.length !== parameters.length || authored.length > nativeArguments.length)
    return throwInvariant(invariant("A selected application must retain its complete original signature bindings."));
  const arguments_: RawTypeArgument[] = [];
  if (nativeContributions.length !== 0 && !admit(scope, "edges")) return null;
  const binders = nativeContributions.length === 0 ? null : new Map<Type, RawNodeRef>();
  for (let index = 0; index < nativeArguments.length; index += 1) {
    if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
    const binding = nativeArguments[index];
    if (binding === undefined || binding.typeParameter !== parameters[index] || binding.declaration === undefined
      || binding.declaration !== originalNodes[index] || ast.kindName(binding.declaration) !== "KindTypeParameter"
      || binding.checkedArgument === undefined || binding.explicitTypeNode !== authored[index])
      return throwInvariant(invariant("A selected signature binding must retain its actual original parameter and argument."));
    if (binding.defaultTypeNode !== undefined && (binding.explicitTypeNode !== undefined
      || ast.as.AsTypeParameterDeclaration(binding.declaration)?.DefaultType !== binding.defaultTypeNode))
      return throwInvariant(invariant("A selected default type argument must retain the original parameter's default."));
    const parameter = requiredCallReference(scope, binding.declaration);
    if (parameter === null) return null;
    const authoredNode = binding.explicitTypeNode ?? binding.defaultTypeNode;
    const argumentNode = authoredNode === undefined ? null : requiredCallReference(scope, authoredNode);
    if (authoredNode !== undefined && argumentNode === null) return null;
    const argument = rawType(scope, () => withoutTypeCause(binding.checkedArgument),
      component(scope, invocation, { kind: "type-argument", declaration: parameter, index }), argumentNode);
    if (argument === null) return null;
    binders?.set(binding.typeParameter, parameter);
    arguments_.push({ parameter, declaration: parameter, argument: available(argument), scope: "local",
      explicitTypeNode: binding.explicitTypeNode === undefined ? null : argumentNode,
      defaultTypeNode: binding.defaultTypeNode === undefined ? null : argumentNode });
  }
  const contributions: RawInferenceContribution[] = [];
  for (let index = 0; index < nativeContributions.length; index += 1) {
    if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
    const contribution = nativeContributions[index];
    if (contribution === undefined)
      return throwInvariant(invariant("A selected inference contribution inventory must be dense."));
    const { origin } = contribution;
    if (origin.kind !== "argument" && origin.kind !== "contextual-result")
      throw new TypeError("front: projected, tail or receiver inference contribution capture is not implemented");
    const parameter = binders?.get(contribution.typeParameter);
    if (parameter === undefined || declared === undefined)
      return throwInvariant(invariant("A selected inference contribution must name an actual original signature parameter."));
    if (origin.kind === "argument") {
      const argument = selected.arguments.values[origin.effectiveArgumentIndex];
      if (argument?.sourceArgument !== origin.subject || argument.parameterIndex !== origin.parameterIndex)
        return throwInvariant(invariant("An inference contribution must retain its actual selected argument association."));
    } else if (origin.subject !== application.invocation)
      return throwInvariant(invariant("A contextual-result contribution must retain its original invocation."));
    const formalType = contributedFormalType(scope, application, contribution);
    if (formalType === undefined) {
      if (scope.meter.refusal !== null) return null;
      throw new TypeError("front: projected, tail or receiver inference contribution capture is not implemented");
    }
    const subject = requiredCallReference(scope, origin.subject);
    if (subject === null) return null;
    const declaration = requiredCallReference(scope, declared);
    if (declaration === null) return null;
    const source = rawType(scope, () => withoutTypeCause(contribution.sourceRootType), component(scope, subject, null), null);
    if (source === null) return null;
    const formal = rawType(scope, () => withoutTypeCause(formalType), component(scope, declaration, origin.kind === "argument"
      ? { kind: "parameter", signature: original, index: origin.parameterIndex } : { kind: "result", signature: original }), null);
    if (formal === null) return null;
    contributions.push({ declaration: parameter, origin: { ...origin, subject }, source, formal });
  }
  return { arguments: arguments_, contributions: inferenceContributions.kind === "available" ? available(contributions) : notProvided() };
}

function captureCallOrder(scope: CaptureScope, invocation: RawNodeRef, signatures: readonly (Signature | undefined)[],
  kind: "call" | "construct", selected: Signature | null): { readonly order: readonly RawSignatureId[]; readonly position: number | null } | null {
  const order: RawSignatureId[] = [];
  let position: number | null = null;
  for (let index = 0; index < signatures.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const signature = signatures[index];
    if (signature === undefined) return throwInvariant(invariant("A call's declaration order must be dense."));
    if (signature === selected) {
      if (position !== null) return throwInvariant(invariant("An applicable call must select exactly one declared position."));
      position = index;
    }
    const captured = rawSignature(scope, signature, invocation, kind);
    if (captured === null) return null;
    order.push(captured);
  }
  return { order, position };
}

function layoutSyntaxFault(scope: CaptureScope, at: Hir.SyntaxNode<Hir.SyntaxPhase>, detail: string): null {
  const name = hostDiagnosticCode("TSONIC_LAYOUT_DESCRIPTOR_SYNTAX");
  scope.invalidLayout = { code: { kind: "host", name, rendered: name }, source: "front", severity: "error",
    site: { kind: "source", origin: at.origin }, message: detail, evidence: [], arguments: [], related: [], fix: null };
  return null;
}

function unavailableLayoutSelector(scope: CaptureScope, selector: RawLayoutSelector): null {
  const at = scope.syntaxOf(selector.access.node);
  if (at === undefined) return throwInvariant(invariant("An unavailable selector retains its actual authored access."));
  return layoutSyntaxFault(scope, at, "A physical field selector requires an actual checked stored member.");
}

function layoutCaptureAdmission(scope: CaptureScope, work: number, created: number): Diagnostic | null {
  return admit(scope, "edges", work) && admit(scope, "facts", created) ? null :
      scope.meter.refusal ?? throwInvariant(invariant("Layout descriptor admission retains its actual first refusal."));
}

function captureLayoutSyntax(scope: CaptureScope, input: Hir.Expression<Hir.SyntaxPhase>,
  kind: RawLayoutConstruction["construction"], retainField: (operand: Hir.Expression<Hir.SyntaxPhase>) => Diagnostic | null,
): Hir.LayoutDescriptorSyntax<Hir.SyntaxPhase> | null {
  const selected = readLayoutDescriptor<Hir.SyntaxPhase, Diagnostic>(input, kind,
    (work, created) => layoutCaptureAdmission(scope, work, created), retainField);
  if (selected.kind === "resource-stop") return null;
  if (selected.kind === "invalid") {
    const at = scope.syntaxOf(selected.fault.at);
    if (at === undefined) return throwInvariant(invariant("A layout descriptor fault retains its exact authored site."));
    const problem = selected.fault;
    const detail = "name" in problem ? `Layout descriptor property ${problem.name} is ${problem.kind.replace("-property", "")}.`
      : problem.kind === "not-inline" ? "A layout descriptor must be an inline object."
      : problem.kind === "not-inline-fields" ? "Layout fields must be an inline array."
      : problem.kind === "invalid-field-entry" ? "Each layout field must be a non-spread descriptor expression."
      : problem.kind === "invalid-selector" ? "A field selector must be one arrow formal with a direct non-optional property access."
      : "A layout descriptor accepts only ordinary data properties.";
    return layoutSyntaxFault(scope, at, detail);
  }
  return selected.value;
}

function capturedLayoutSelector(scope: CaptureScope, value: Hir.LayoutSelectorSyntax<Hir.SyntaxPhase>): RawLayoutSelector | null {
  if (layoutCaptureAdmission(scope, 4, scope.fieldSelectors === null ? 7 : 6) !== null) return null;
  const { arrow, formal, access, receiver } = value;
  if (arrow.parent === null || formal.parent !== arrow.id || access.parent !== arrow.id || receiver.parent !== access.id)
    return throwInvariant(invariant("A field selector belongs to its exact authored arrow, formal and property occurrence."));
  const at = (node: Hir.SyntaxNode<Hir.SyntaxPhase>): RawNodeRef => {
    if (scope.syntaxOf(node.id) !== node)
      return throwInvariant(invariant("A field selector retains its actual captured syntax pointer."));
    return { module: scope.module, node: node.id };
  };
  const selected = { expression: at(arrow), parent: arrow.parent, formal: at(formal), access: at(access), receiver: at(receiver) };
  const pending = scope.fieldSelectors ??= new Map();
  if (pending.has(access.id)) return throwInvariant(invariant("A physical selector has one actual originating quotation."));
  pending.set(access.id, selected);
  return selected;
}

function capturedLayoutQuery(scope: CaptureScope, application: RawApplication, declaration: RawNodeRef,
  operation: RawLayoutQuery["operation"], operands: readonly RawAuthoredArgument[]): RawLayoutQuery | null {
  if (operation !== "field-offset") return { application, declaration, operands, operation };
  if (!admit(scope, "edges")) return null;
  const call = scope.syntaxOf(application.invocation.node);
  if (call?.kind !== "CallExpression")
    return throwInvariant(invariant("A field observation must retain its actual authored call."));
  if (operands.length !== 2 || call.arguments.nodes.length !== 2)
    return layoutSyntaxFault(scope, call, "A field observation requires its layout and one inline field selector.");
  if (!admit(scope, "edges")) return null;
  const actual = call.arguments.nodes[1];
  const authored = operands[1];
  if (actual === undefined || authored?.kind !== "value" || authored.expression.module !== scope.module ||
    authored.expression.node !== actual.id || actual.parent !== call.id)
    return throwInvariant(invariant("A field observation must retain its exact second authored operand."));
  const selected = readLayoutSelector<Hir.SyntaxPhase, Diagnostic>(actual, (work, records) => layoutCaptureAdmission(scope, work, records));
  if (selected.kind === "resource-stop") return null;
  if (selected.kind === "invalid") {
    const site = scope.syntaxOf(selected.fault.at);
    if (site === undefined) return throwInvariant(invariant("A field selector fault retains its exact authored site."));
    return layoutSyntaxFault(scope, site, "A field selector must be one arrow formal with a direct non-optional property access.");
  }
  const selector = capturedLayoutSelector(scope, selected.value);
  return selector === null ? null : { application, declaration, operands, operation, selector };
}

function capturedLayoutConstruction(scope: CaptureScope, application: RawApplication, declaration: RawNodeRef,
  kind: RawLayoutConstruction["construction"], sourceArguments: readonly RawAuthoredArgument[]): RawLayoutConstruction | null {
  if (!admit(scope, "edges")) return null;
  const invocation = scope.syntaxOf(application.invocation.node);
  if (invocation?.kind !== "CallExpression")
    return throwInvariant(invariant("A selected layout constructor must retain its actual authored call syntax."));
  if (sourceArguments.length !== 1 || invocation.arguments.nodes.length !== 1)
    return layoutSyntaxFault(scope, invocation, "A layout constructor requires exactly one inline descriptor.");
  const authored = sourceArguments[0];
  const input = invocation.arguments.nodes[0];
  if (authored?.kind !== "value" || input === undefined)
    return layoutSyntaxFault(scope, invocation, "A layout constructor requires its actual non-spread inline descriptor.");
  if (authored.expression.module !== scope.module || authored.expression.node !== input.id || input.parent !== invocation.id)
    return throwInvariant(invariant("A layout descriptor must be the actually selected authored argument."));
  const occurrence = (node: Hir.SyntaxNode<Hir.SyntaxPhase>): RawLayoutOperand => {
    if (node.parent === null || scope.syntaxOf(node.id) !== node)
      return throwInvariant(invariant("A layout operand belongs to its actual admitted source occurrence."));
    return { expression: { module: scope.module, node: node.id }, parent: node.parent };
  };
  if (kind === "value" && layoutCaptureAdmission(scope, 0, 1) !== null) return null;
  const fields: RawLayoutOperand[] | null = kind === "value" ? [] : null;
  const value = captureLayoutSyntax(scope, input, kind, operand => {
    if (fields === null) return throwInvariant(invariant("Only a value layout has authored field operands."));
    const stopped = layoutCaptureAdmission(scope, 1, 3);
    if (stopped !== null) return stopped;
    fields.push(occurrence(operand));
    return null;
  });
  if (value === null) return null;
  const count = value.kind === "array" ? 6 : 4;
  if (layoutCaptureAdmission(scope, count + 1, 2 * count + (value.kind === "value" ? 4 : value.kind === "array" ? 3 : 2)) !== null) return null;
  const descriptor = { module: scope.module, node: input.id };
  if (value.kind === "field") {
    const selector = capturedLayoutSelector(scope, value.select);
    return selector === null ? null : { kind: "layout-construction", construction: "field", application, declaration, descriptor,
      selector, byteOffset: occurrence(value.byteoffset), byteAlignment: occurrence(value.bytealignment), fieldLayout: occurrence(value.fieldlayout) };
  }
  const geometry = { dataLayout: occurrence(value.datalayout), byteSize: occurrence(value.bytesize),
    byteAlignment: occurrence(value.bytealignment), stride: occurrence(value.stride) };
  if (value.kind === "array") return { kind: "layout-construction", construction: "array", application, declaration, descriptor,
    geometry, element: occurrence(value.elementlayout), length: occurrence(value.length) };
  if (fields === null) return throwInvariant(invariant("A selected value layout must retain its own authored field vector."));
  return { kind: "layout-construction", construction: "value", application, declaration, descriptor, geometry, fields,
    fieldList: { module: scope.module, node: value.fields.id } };
}

function acquireCallEvidence(scope: CaptureScope, node: Node): ResolvedSourceCallInfo | null {
  const captured = scope.checker.acquireResolvedCall(node, nativeCaptureAdmission(scope));
  if (captured.kind === "refused") {
    if (captured.stop !== scope.meter.refusal)
      return throwInvariant(invariant("A call acquisition must retain its actual first capture refusal."));
    return null;
  }
  if (captured.kind === "unavailable") return throwInvariant(invariant("The checker gave no completed evidence for a captured call."));
  const info = captured.value;
  if (info.call !== node) return throwInvariant(invariant("Call evidence must retain its actual source invocation."));
  return info;
}

function selectedFormalTupleAnnotation(scope: CaptureScope, selected: SelectedCall, index: number, type: Type): Node | null {
  if (!scope.shape.isTuple(type) || !admit(scope, "edges")) return null;
  const application = selected.application;
  const formal = selected.parameters[index];
  const original = application.signatureShape.parameters[index];
  const declaration = formal?.parameterDeclaration;
  const annotation = formal?.authoredTypeNode;
  const ast = scope.checked.ast;
  if (formal?.parameterIndex !== index || formal.rest || formal.acceptsOmission || formal.selectedType !== type
    || formal.parameterSymbol !== application.instantiatedSignature.parameters[index] || original?.index !== index
    || original.rest || original.optional || declaration === undefined || original.declaration !== declaration
    || ast.kindName(declaration) !== "KindParameter" || ast.parent(declaration) !== application.signatureShape.declaration
    || annotation === undefined || ast.typeNode(declaration) !== annotation || tupleSyntax(scope, annotation) === undefined) return null;
  const written = sourceType(scope, { kind: "annotation", node: annotation });
  return written?.type === type && written.causes.length === 0 ? annotation : null;
}

function captureCall(scope: CaptureScope, node: Node, invocation: RawNodeRef): RawCallSelection | null {
  if (!admit(scope, "facts") || scope.tables.tupleCalls !== null && !admit(scope, "edges")) return null;
  const tuple = scope.tables.tupleCalls?.get(node);
  const info = tuple?.call ?? acquireCallEvidence(scope, node);
  if (info === null) return null;
  if (!scope.emptyCoreInventory && info.kind === "conditional-candidates" && !info.optionalChain &&
      info.candidates.length === 1 && info.diagnostics.length !== 0) {
    if (!admit(scope, "edges")) return null;
    const candidate = info.candidates[0];
    if (candidate === undefined) return throwInvariant(invariant("A single checked candidate must be present."));
    const callee = candidate.application.callee.expression;
    const role = layoutRole(scope.checked.sourceFacts.getFact(callee, sourceMarkerFactKey));
    if (role?.kind === "construction" && candidate.application.invocation === node &&
        scope.checked.ast.as.AsCallExpression(node)?.Expression === callee) {
      const authored = scope.syntaxOf(invocation.node);
      if (authored?.kind !== "CallExpression") return throwInvariant(invariant("A rejected quoted call retains its original written syntax."));
      if (candidate.sourceArguments.length !== 1 || authored.arguments.nodes.length !== 1)
        return layoutSyntaxFault(scope, authored, "A layout constructor requires exactly one inline descriptor.");
      const native = candidate.sourceArguments[0];
      const input = authored.arguments.nodes[0];
      if (native === undefined || input === undefined || scope.ownNodes.get(native) !== input.id)
        return throwInvariant(invariant("A rejected quoted argument must retain its exact authored occurrence."));
      if (captureLayoutSyntax(scope, input, role.construction, () => null) === null) return null;
    }
  }
  if (info.kind === "conditional-candidates" && !info.optionalChain && info.candidates.length === 0
    && info.declarationOrder.kind === "available" && info.declarationOrder.signatures.length !== 0 && info.diagnostics.length === 1) {
    if (!admit(scope, "edges")) return null;
    const diagnostic = info.diagnostics[0];
    const original = diagnostic?.file === scope.file ? scope.diagnosticRoots.get(diagnostic) : undefined;
    if (original === undefined || original.module !== invocation.module)
      return throwInvariant(invariant("A rejected call must retain its actual published checker diagnostic run."));
    const declared = captureCallOrder(scope, invocation, info.declarationOrder.signatures, "call", null);
    if (declared === null) return null;
    if (!admit(scope, "facts")) return null;
    const candidates = rawCandidateListId(scope.tables.candidates.length);
    scope.tables.candidates.push({ id: candidates, candidates: [] });
    return { kind: "conditional-candidates", invocation, declarationOrder: available(declared.order), candidates, diagnostics: [original] };
  }
  if (info.kind !== "applicable") throw new TypeError("front: conditional or untyped call capture is not implemented");
  const selected = info.selection;
  const application = selected.application;
  if (application.invocation !== node)
    return throwInvariant(invariant("A selected call must retain its actual invocation."));
  if (info.declarationOrder.kind !== "available" || info.declarationOrder.signatures.length === 0)
    return throwInvariant(invariant("An applicable call requires its actual checked declaration order."));
  if (application.instantiatedSignature !== application.signature && application.instantiatedSignature.target !== application.signature)
    return throwInvariant(invariant("An applicable call must retain its actual declared and instantiated signature association."));
  if (application.class !== undefined || application.receiver !== undefined || application.signatureShape.composite !== undefined)
    throw new TypeError("front: class-bound, receiver-bearing or composed call capture is not implemented");
  if (selected.constraints.length !== 0 || selected.diagnostics.length !== 0 || selected.diagnosticCoverage.length !== 0)
    throw new TypeError("front: call diagnostic obligations capture is not implemented");
  const signature = rawSignature(scope, application.instantiatedSignature, invocation, application.kind);
  if (signature === null) return null;
  const callee = referenceTo(scope, scope.program, application.callee.expression);
  if (callee === null) return scope.meter.refusal !== null ? null : throwInvariant(invariant("The selected callee has no source identity."));
  const sourceArguments: RawAuthoredArgument[] = [];
  let tupleSources: Map<number, TupleAnnotation> | null = null;
  for (let index = 0; index < selected.sourceArguments.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const argument = selected.sourceArguments[index];
    if (argument === undefined) return throwInvariant(invariant("A selected call requires its actual dense authored arguments."));
    const ast = scope.checked.ast;
    const spread = ast.kindName(argument) === "KindSpreadElement";
    const operand = spread ? ast.as.AsSpreadElement(argument)?.Expression : argument;
    if (operand === undefined) return throwInvariant(invariant("A selected spread requires its actual authored operand."));
    const occurrence = referenceTo(scope, scope.program, argument);
    if (occurrence === null) return scope.meter.refusal !== null ? null : throwInvariant(invariant("A call argument has no source identity."));
    const expression = spread ? referenceTo(scope, scope.program, operand) : occurrence;
    if (expression === null) return scope.meter.refusal !== null ? null : throwInvariant(invariant("A spread operand has no source identity."));
    const position = spread ? component(scope, expression, null) : component(scope, invocation, { kind: "argument-place", index });
    if (position === null || !admit(scope, "facts")) return null;
    const answer = sourceType(scope, { kind: "expression", node: operand });
    if (scope.meter.refusal !== null) return null;
    const tupleOperand = answer !== undefined && answer.causes.length === 0 && scope.shape.isTuple(answer.type)
      ? unparenthesizedTupleValue(scope, operand) : undefined;
    const tupleLiteral = tupleOperand !== undefined && ast.kindName(tupleOperand) === "KindArrayLiteralExpression" ? tupleOperand : undefined;
    const literal = tupleLiteral === undefined || answer === undefined ? null : retainTupleLiteral(scope, operand, tupleLiteral, answer.type);
    if (scope.meter.refusal !== null) return null;
    const owned = literal === null && (spread || answer !== undefined && scope.shape.isTuple(answer.type))
      ? valueTupleAnnotation(scope, tupleOperand ?? operand, answer) : null;
    if (scope.meter.refusal !== null) return null;
    if (!spread && owned !== null && answer !== undefined) {
      if (!admit(scope, "facts", tupleSources === null ? 3 : 2)) return null;
      (tupleSources ??= new Map()).set(index, { type: answer.type, annotation: owned });
    }
    enqueueRawType(scope, answer, position, owned, literal, ast.kindName(operand) === "KindNumericLiteral" ? operand : null);
    sourceArguments.push({ occurrence, expression, kind: spread ? "spread" : "value", component: available(position) });
  }
  const bindings: RawArgumentBinding[] = [];
  for (let index = 0; index < selected.arguments.values.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const argument = selected.arguments.values[index];
    if (argument === undefined) return throwInvariant(invariant("A selected call requires its actual dense effective arguments."));
    const authored = sourceArguments[argument.sourceArgumentIndex];
    const expansion = argument.spreadElementIndex;
    if (authored === undefined || selected.sourceArguments[argument.sourceArgumentIndex] !== argument.sourceArgument
      || argument.effectiveArgumentIndex !== bindings.length
      || (argument.sourceForm === "spread-element"
        ? authored.kind !== "spread" || expansion === undefined || !Number.isSafeInteger(expansion) || expansion < 0
          || Object.is(expansion, -0) || scope.checked.ast.kindName(argument.effectiveArgument) !== "KindSyntheticExpression"
        : expansion !== undefined || argument.effectiveArgument !== argument.sourceArgument
          || authored.kind !== (argument.sourceForm === "value" ? "value" : "spread")
          || (argument.sourceForm === "spread-sequence") !== (argument.parameterForm === "rest-sequence")))
      return throwInvariant(invariant("A selected transport must retain its actual authored argument and effective slot."));
    const source = component(scope, invocation, { kind: "argument-place", index: argument.effectiveArgumentIndex });
    if (source === null) return null;
    const destination = component(scope, invocation, { kind: "parameter", signature, index: argument.parameterIndex });
    if (destination === null) return null;
    if (argument.selectedArgumentType === undefined || argument.selectedParameterType === undefined)
      throw new TypeError("front: incomplete selected call argument types capture is not implemented");
    const literalNode = selected.sourceArguments[argument.sourceArgumentIndex] === argument.sourceArgument
      && argument.effectiveArgument === argument.sourceArgument && scope.checked.ast.kindName(argument.sourceArgument) === "KindNumericLiteral"
      ? argument.sourceArgument : null;
    const tupleSource = argument.sourceForm === "value" ? tupleSources?.get(argument.sourceArgumentIndex) : undefined;
    const sourceAnnotation = tupleSource?.type === argument.selectedArgumentType ? tupleSource.annotation : null;
    const sourceLiteral = argument.sourceForm === "value" && scope.shape.isTuple(argument.selectedArgumentType)
      ? tupleLiteralRead(scope, argument.sourceArgument, argument.selectedArgumentType) : null;
    if (scope.meter.refusal !== null) return null;
    const destinationAnnotation = argument.parameterForm === "parameter"
      ? selectedFormalTupleAnnotation(scope, selected, argument.parameterIndex, argument.selectedParameterType) : null;
    if (destinationAnnotation !== null && argument.sourceForm === "value") {
      if (!admit(scope, "facts", scope.tables.tupleArgumentContexts === null ? 3 : 2)) return null;
      (scope.tables.tupleArgumentContexts ??= new Map()).set(argument.sourceArgument,
        { type: argument.selectedParameterType, annotation: destinationAnnotation });
    }
    if (rawType(scope, () => withoutTypeCause(argument.selectedArgumentType), source, sourceAnnotation, sourceLiteral, literalNode) === null
      || rawType(scope, () => withoutTypeCause(argument.selectedParameterType), destination, destinationAnnotation) === null) return null;
    bindings.push({ sourceArgument: authored.occurrence, sourceArgumentIndex: argument.sourceArgumentIndex,
      effectiveArgumentIndex: argument.effectiveArgumentIndex, sourceForm: argument.sourceForm, spreadElementIndex: argument.spreadElementIndex ?? null,
      parameterIndex: argument.parameterIndex, parameterForm: argument.parameterForm, source: available(source), destination: available(destination) });
  }
  const declared = captureCallOrder(scope, invocation, info.declarationOrder.signatures, application.kind, application.signature);
  if (declared === null) return null;
  const declarationOrdinal = declared.position;
  const original = declarationOrdinal === null ? undefined : declared.order[declarationOrdinal];
  if (declarationOrdinal === null || original === undefined)
    return throwInvariant(invariant("An applicable call must retain its actual selected position in declaration order."));
  const capturedBindings = captureSelectedBindings(scope, selected, invocation, original);
  if (capturedBindings === null) return null;
  const result = rawType(scope, () => withoutTypeCause(info.resultType), component(scope, invocation, null),
    tuple?.annotation ?? null);
  if (result === null) return null;
  const candidates = rawCandidateListId(scope.tables.candidates.length);
  if (!admit(scope, "facts") || !admit(scope, "facts")) return null;
  const rawApplication: RawApplication = { invocation, kind: application.kind, signature, callee, receiver: null,
    classArguments: [], signatureArguments: capturedBindings.arguments };
  scope.tables.candidates.push({ id: candidates, candidates: [{ ordinal: 0,
    application: rawApplication, sourceArguments,
    arguments: available(bindings), inferenceContributions: capturedBindings.contributions,
    constraints: [], diagnostics: [], diagnosticCoverage: [] }] });
  captureFacts(scope);
  if (scope.meter.refusal !== null) return null;
  const completed = scope.tables.signatures[signature];
  if (completed === undefined) return throwInvariant(invariant("A selected call has no completed captured signature."));
  if (!scope.emptyCoreInventory) {
    const layout = layoutRole(scope.checked.sourceFacts.getFact(node, sourceMarkerFactKey));
    const marker = scope.checked.sourceFacts.getFact(application.callee.expression, sourceMarkerFactKey);
    if (layout !== null) {
      if (!admit(scope, "edges")) return null;
      const declaration = scope.tables.signatures[original]?.declaration;
      const callable = declaration === undefined || declaration === null ? undefined : admittedTypeUse(scope, declaration);
      if (declaration === undefined || declaration === null || scope.checked.ast.as.AsCallExpression(node)?.Expression !== application.callee.expression
        || callable === undefined || callable !== application.signatureShape.declaration)
        return throwInvariant(invariant("A layout operation must retain the actual applicable selected call declaration."));
      const provider = providerDeclaration(scope, callable, declaration);
      if (provider === null) return null;
      if (provider !== undefined && provider.identity.signatureId === null)
        return throwInvariant(invariant("A provider layout operation must retain its actual selected signature receipt."));
      if (!admit(scope, "facts", layout.kind === "construction" ? 3 : 2)) return null;
      if (layout.kind === "construction") {
        const capture = capturedLayoutConstruction(scope, rawApplication, declaration, layout.construction, sourceArguments);
        if (capture === null) return null;
        scope.tables.memoryDescriptors.push(capture);
        scope.callCore.set(invocation.node, { role: "layout-construction", capture, provider });
      } else {
        const capture = capturedLayoutQuery(scope, rawApplication, declaration, layout.operation, sourceArguments);
        if (capture === null) return null;
        scope.callCore.set(invocation.node, { role: "layout-query", capture, provider });
      }
    } else if (marker?.kind === "call-marker" && (marker.marker === "struct" || marker.marker === "field")) {
      if (!admit(scope, "edges")) return null;
      const declaration = scope.tables.signatures[original]?.declaration;
      if (declaration !== undefined && declaration !== null && scope.checked.ast.as.AsCallExpression(node)?.Expression === application.callee.expression
        && admittedTypeUse(scope, declaration) === application.signatureShape.declaration) {
        if (!admit(scope, "facts")) return null;
        scope.callCore.set(invocation.node, { role: marker.marker, declaration });
      }
    } else if (marker === undefined && application.kind === "call") {
      if (!admit(scope, "edges")) return null;
      const declaration = scope.tables.signatures[original]?.declaration;
      if (declaration !== undefined && declaration !== null) {
        const source = OpenedProgram.file(scope.program, declaration.module)?.origin;
        const native = source?.kind === "session-document" && source.document.artifact === "canonical-export-owner";
        const ordinary = scope.closedOrdinaryApplication && source?.kind === "snapshot";
        if (native || ordinary) {
          if (!admit(scope, "edges")) return null;
          const callable = admittedTypeUse(scope, declaration);
          if (callable !== undefined && callable === application.signatureShape.declaration) {
            if (native) {
              const receipt = providerDeclaration(scope, callable, declaration);
              if (receipt === null) return null;
              if (receipt !== undefined && receipt.identity.signatureId !== null) {
                if (!admit(scope, "facts")) return null;
                scope.callCore.set(invocation.node, { role: "provider", receipt });
              }
            } else if (scope.checked.ast.body(callable) !== undefined) {
              if (!admit(scope, "facts")) return null;
              scope.callCore.set(invocation.node, "ordinary");
            }
          }
        }
      }
    }
  }
  return { kind: "applicable", invocation, declarationOrder: available(declared.order),
    candidates, declarationOrdinal, result, parameters: completed.parameters };
}

interface OverloadBody {
  readonly container: Node;
  readonly body: RawCallableAssociation["body"];
  readonly parameters: RawCallableAssociation["bodyParameters"];
}

function captureOverloadBody(scope: CaptureScope, symbol: CheckerSymbol): OverloadBody | null {
  if (!admit(scope, "edges")) return null;
  const { ast } = scope.checked;
  const declarations = scope.checker.getSymbolDeclarations(symbol);
  let implementation: { readonly declaration: Node; readonly node: NodeId; readonly container: Node } | null = null;
  for (let index = 0; index < declarations.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const declaration = declarations[index];
    if (declaration === undefined || ast.kindName(declaration) !== "KindFunctionDeclaration") continue;
    const body = ast.body(declaration);
    if (body === undefined) continue;
    const node = scope.ownNodes.get(body);
    const container = ast.parent(declaration);
    if (implementation !== null || node === undefined || container === undefined) return null;
    implementation = { declaration, node, container };
  }
  if (implementation === null || !admit(scope, "facts")) return null;
  const source = ast.parameters(implementation.declaration);
  const parameters: RawNodeRef[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (!admit(scope, "edges") || !admit(scope, "facts")) return null;
    const parameter = source[index];
    const node = parameter === undefined ? undefined : scope.ownNodes.get(parameter);
    if (node === undefined) return null;
    parameters.push({ module: scope.module, node });
  }
  return { container: implementation.container,
    body: available({ module: scope.module, node: implementation.node }), parameters: available(parameters) };
}

/**
 * The raw capture of one module of the opened program: its syntax tree in HIR's syntax phase and the checker's
 * evidence about it. The categories of evidence written so far are those the checked annotations written so far
 * read: the views of expressions, the references of identifier uses, the symbols and signatures they name, the
 * callable associations, callable inventories and selected calls, and the module's export entries; remaining tables are empty, and
 * lowering refuses a module that holds a kind whose checked annotation is not written (one check, in lowerModule).
 */
function captureRawModule(deps: CaptureDeps, program: CheckedProgram, module: ModuleId,
  interfaceCapture: InterfaceCaptureSession): Result<RawModule> {
  if (OpenedProgram.table(program) !== deps.extensions) throw new TypeError("front: the extension table is not the one the program was opened with");
  const checked = OpenedProgram.checked(program);
  const ast = checked.ast;
  const input = OpenedProgram.file(program, module);
  if (input === undefined) throw new TypeError("front: the module is not a module of the opened program");
  const file = input.file;
  const path = ast.getFileName(file);
  const own = fileNumberingOf(deps, program, path, module);
  if (own.kind === "refused") return { kind: "refused", diagnostics: [own.diagnostic] };
  const { nodes, ids: ownNodes } = own.numbering;
  const displacement = input.displacement;
  const admission: CaptureAdmission = { deps, module, path, meter: { facts: 0, edges: 0, refusal: null } };
  const ranges = { ast, file, displacement };
  const pragmas = capturePragmas(ranges, () => admit(admission, "facts"));
  if (pragmas === null) return { kind: "refused", diagnostics: [admission.meter.refusal
    ?? throwInvariant(invariant("Directive capture must retain the first fact refusal."))] };
  // The syntax capture takes each node's identity from the numbering, and must reach the nodes in its order.
  const numericLiterals = new Map<Node, RawNumericLiteral>();
  const context: SyntaxCaptureContext = { ...ranges, ...pragmas, module, sourceText: input.text, numericLiterals, numbering: own.numbering };
  const syntax = captureNode(context, file, null);
  const { tree } = syntax;
  if (tree.kind !== "SourceFile") return throwInvariant(invariant("A module's captured tree is not a source file."));
  const queries = checked.getSourceFileQueries(file);
  const scope: CaptureScope = { ...admission, program, file, numericLiterals, syntaxOf: syntax.syntaxOf, checked, checker: queries.checker,
    shape: queries.typeShape, ownNodes, ...closedCoreInventory(program), diagnosticRoots: new Map(), callCore: new Map(),
    fieldSelectors: null, invalidLayout: null, rootAssignmentAnnotations: null,
    tables: { types: [], components: [], signatures: [], members: [], candidates: [], symbols: [], memoryDescriptors: [], completedSourceReferences: new Map(),
      authoredSourceTypes: null, tupleCalls: null, tupleArgumentContexts: null, tupleLiteralContexts: null, tupleLiteralReads: null,
      interfaceGroups: { byTarget: new Map(), rows: [] }, interfaceCapture,
      interfaceDescriptions: new Map(),
      symbolIds: new Map(), signatureIds: new Map(),
      qualifiedSignatures: new Map(), activeTypes: new Map(), activeQualifiedTypes: new Map(),
      activeIndexedAliases: new Set(),
      activeMergedInventories: new Map(), activeMergedArguments: new Set(),
      mergedParameterOwners: undefined,
      nextType: 0, nextSignature: 0, nextMember: 0, pending: [], globalEnvironment: null } };
  const checkerDiagnostics = captureFileDiagnostics(program, module, input, ownNodes, scope.diagnosticRoots, () => admit(scope, "facts"));
  if (scope.meter.refusal !== null) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal, checkerDiagnostics) };
  const annotations: RawModule["annotations"][number][] = [];
  const views: RawCheckerViews[] = [];
  const references: RawReference[] = [];
  const links: RawModuleLink[] = [];
  const associations: RawCallableAssociation[] = [];
  let implementedOverloads: Map<CheckerSymbol, OverloadBody | null> | null = null;
  const calls: RawCallSelection[] = [];
  const bindings: RawBinding[] = [];
  const propertyNames: RawPropertyName[] = [];
  const memberUses: RawMemberUse[] = [];
  let enumQualifiers: Set<NodeId> | null = null;
  const isEnumQualifier = (node: NodeId): boolean => enumQualifiers?.has(node) === true;
  const enums: RawEnum[] = [];
  const storage: RawStorageCapture[] = [];
  let executingPatterns: Set<Node> | null = null;
  let declarationNameRoot: NodeId | null = null;
  capture: for (const [index, node] of nodes.entries()) {
    if (own.numbering.excluded?.has(node) === true) continue;
    const reference: RawNodeRef = { module, node: nodeId(index) };
    const kind = ast.kindName(node);
    const parent = ast.parent(node);
    const parentId = own.numbering.parents.get(node);
    if (parent !== undefined && (kind === "KindArrayBindingPattern" || kind === "KindObjectBindingPattern")) {
      if (!admit(scope, "edges")) break;
      const parentKind = ast.kindName(parent);
      const variable = parentKind === "KindVariableDeclaration" ? ast.as.AsVariableDeclaration(parent) : undefined;
      const enclosing = parentKind === "KindBindingElement" ? ast.parent(parent) : undefined;
      const executing = variable !== undefined ? variable.name === node && variable.Initializer !== undefined
        : enclosing !== undefined && executingPatterns !== null && executingPatterns.has(enclosing) && ast.name(parent) === node;
      if (executing) {
        if (!admit(scope, "facts", executingPatterns === null ? 2 : 1)) break;
        (executingPatterns ??= new Set()).add(node);
      }
    }
    if (declarationNameRoot !== null && (parentId === null || parentId === undefined || parentId < declarationNameRoot)) declarationNameRoot = null;
    const declarationName = parent !== undefined && ast.name(parent) === node;
    const identifierParent = kind === "KindIdentifier" && parent !== undefined ? ast.kindName(parent) : null;
    const labelName = identifierParent === "KindLabeledStatement" || identifierParent === "KindBreakStatement" || identifierParent === "KindContinueStatement";
    if (declarationNameRoot === null && identifierParent !== null && !labelName && parent !== undefined) {
      let targetSyntax = node;
      let parentKind = identifierParent;
      let targetParent = parent;
      while (parentKind === "KindParenthesizedExpression") {
        if (!admit(scope, "edges")) break capture;
        if (ast.as.AsParenthesizedExpression(targetParent)?.Expression !== targetSyntax)
          return throwInvariant(invariant("A parenthesized target must retain its actual enclosed expression."));
        targetSyntax = targetParent;
        const enclosing = ast.parent(targetParent);
        if (enclosing === undefined)
          return throwInvariant(invariant("An expression in a captured file must have its actual parent."));
        targetParent = enclosing;
        parentKind = ast.kindName(targetParent);
      }
      const unary = parentKind === "KindPrefixUnaryExpression" || parentKind === "KindPostfixUnaryExpression";
      const operator = unary || parentKind === "KindBinaryExpression" ? ast.operatorKindName(targetParent) : undefined;
      const target = unary ? operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken"
        : operator === "KindEqualsToken" || operator !== undefined && operator.startsWith("Kind")
          && writtenCompoundAssignmentKinds.includes(operator.slice(4));
      if (target && ast.children(targetParent)[0] === targetSyntax) {
        const selected = capturedStorage(scope, node, reference, operator === "KindEqualsToken" ? targetParent : null);
        if (selected === null) break;
        storage.push(selected);
      }
    }
    if (kind === "KindComputedPropertyName") {
      if (parent !== undefined && (ast.kindName(parent) === "KindPropertySignature" || ast.kindName(parent) === "KindMethodSignature"))
        declarationNameRoot = reference.node;
      if (!admit(scope, "facts")) break;
      const selected = capturedPropertyKey(scope, node);
      let key: RawFact<RawComputedMemberKey | null> = { kind: "unavailable", reason: "missing-original-component", causes: [] };
      if (scope.meter.refusal !== null) break;
      if (selected !== null) key = available(selected);
      propertyNames.push({ node: reference, selected: key, numericIndex: selected?.kind === "numeric" });
    }
    const bindingSyntax = isModuleBindingKind(kind.replace(/^Kind/u, ""), kind !== "KindImportClause" || ast.name(node) !== undefined);
    if (bindingSyntax) {
      if (!admit(scope, "facts")) break;
      const name = ast.name(node);
      const target = kind === "KindNamespaceExportDeclaration" ? available<RawBindingTarget>({ kind: "module", module }) :
        bindingTarget(scope, name === undefined ? undefined : scope.checker.getSymbolAtLocation(name));
      if (target === null) break;
      bindings.push({ binding: reference, target });
    }
    const bindingName = parent !== undefined && isModuleBindingKind(ast.kindName(parent).replace(/^Kind/u, ""), ast.name(parent) !== undefined);
    if (kind === "KindEnumDeclaration") {
      const captured = captureEnum(scope, node, reference);
      if (captured === null) break;
      enums.push(captured);
    }
    let patternName: Node | undefined;
    if (kind === "KindBindingElement" && parent !== undefined && executingPatterns !== null) {
      if (!admit(scope, "edges")) break;
      if (executingPatterns.has(parent)) {
        const name = ast.name(node);
        if (name !== undefined && ast.kindName(name) === "KindIdentifier") patternName = name;
      }
    }
    if (kind === "KindVariableDeclaration" || kind === "KindEnumMember" || patternName !== undefined) {
      const position = component(scope, reference, null);
      if (position === null || !admit(scope, "facts")) break;
      const answer = sourceType(scope, { kind: "expression", node });
      if (scope.meter.refusal !== null) break;
      const selected = patternName === undefined || parent === undefined ? null : primitiveBindingSource(scope, node, parent, patternName, answer);
      const written = kind === "KindVariableDeclaration" ? qualifiedStorageAnnotation(scope, node, answer) : null;
      if (scope.meter.refusal !== null) break;
      const read = enqueueRawType(scope, answer, position, selected?.annotation ?? written, selected?.arm ?? null, null);
      const storageAlias = kind === "KindVariableDeclaration" ? inferredStorageAlias(scope, node, answer) : null;
      if (scope.meter.refusal !== null) break;
      const name = patternName ?? ast.name(node);
      const symbol = name === undefined ? undefined : scope.checker.getSymbolAtLocation(name);
      const symbolId = symbol === undefined ? null : rawSymbol(scope, symbol);
      if (symbol !== undefined && symbolId === null) break;
      if (!admit(scope, "facts")) break;
      views.push({ node: reference, read: available(read), declared: available(null), contextual: available(null), symbol: available(symbolId),
        inferredStorageAlias: storageAlias });
    }
    const moduleExpression = moduleSpecifier(ast, node, parent);
    if (moduleExpression && parent !== undefined) {
      const link = scope.checker.getResolvedSourceModuleLink(node);
      if (link === undefined) return throwInvariant(invariant("A static module specifier requires its actual checked evaluation and target."));
      const symbol = link.resolution.kind === "resolved" ? link.resolution.module : undefined;
      const id = symbol === undefined ? null : rawSymbol(scope, symbol);
      if (scope.meter.refusal !== null) break;
      const target = id === null ? undefined : scope.tables.symbols[id]?.target;
      const declaration = referenceTo(scope, program, parent);
      if (scope.meter.refusal !== null) break;
      if (declaration === null) return throwInvariant(invariant("A captured module link has no actual syntax statement."));
      if (!admit(scope, "edges")) break;
      const cause = link.resolution.kind === "unresolved" ? link.resolution.cause : undefined;
      const resolution: RawModuleLink["resolution"] | null = cause !== undefined ? originalFailure(scope, cause)
        : target?.kind === "available" && target.value.kind === "module" ? available({ kind: "project", module: target.value.module })
          : { kind: "unavailable", reason: "incomplete-association", causes: [] };
      if (resolution === null) break;
      links.push({ declaration, specifier: reference, kind: ast.kindName(parent) === "KindExportDeclaration" ? "export" : "import", evaluation: link.evaluation,
        resolution });
    }
    let failedSelection = false;
    const numericAnnotationLiteral = parent !== undefined && scope.numericLiterals.has(parent) && ast.kindName(parent) === "KindLiteralType";
    const heritage = interfaceHeritage(ast, node);
    const heritageName = kind === "KindIdentifier" && interfaceHeritage(ast, parent) &&
      ast.as.AsExpressionWithTypeArguments(parent)?.Expression === node;
    if (isEnumQualifier(reference.node)) {
      if (!admit(scope, "facts") || !admit(scope, "edges")) break;
      const symbol = scope.checker.getSymbolAtLocation(node);
      if (kind !== "KindIdentifier" || symbol === undefined)
        return throwInvariant(invariant("An enum qualifier must retain its actual checked declaration reference."));
      const symbolId = rawSymbol(scope, symbol);
      if (symbolId === null) break;
      const captured = scope.tables.symbols[symbolId];
      if (captured === undefined) return throwInvariant(invariant("An enum qualifier requires its captured symbol."));
      references.push({ occurrence: reference, meaning: "value", target: captured.target });
    } else if (heritageName || annotationName(ast, node, parent)) {
      if (!admit(scope, "edges")) break;
      const selected = scope.checker.getSymbolAtLocation(node);
      if (selected !== undefined) {
        if (!admit(scope, "facts")) break;
        const id = rawSymbol(scope, selected);
        if (id === null) break;
        const proof = scope.tables.symbols[id];
        if (proof === undefined) return throwInvariant(invariant("An annotation name must retain its actual checked symbol."));
        references.push({ occurrence: reference, meaning: "type", target: proof.target });
      }
    } else if (expressionKinds.includes(kind.replace(/^Kind/u, "")) && !declarationName && !bindingName && !moduleExpression && !labelName
      && !numericAnnotationLiteral && !heritage) {
      const readPosition = component(scope, reference, null);
      if (readPosition === null || !admit(scope, "facts")) break;
      const answer = sourceType(scope, { kind: "expression", node });
      if (scope.meter.refusal !== null) break;
      if (answer === undefined) return throwInvariant(invariant("The checker returned no type at a position that has one."));
      failedSelection = answer.causes.length !== 0 && (kind === "KindPropertyAccessExpression" || kind === "KindElementAccessExpression" || kind === "KindCallExpression")
        && scope.shape.isError(answer.type);
      const contextual = sourceType(scope, { kind: "contextual", node });
      if (scope.meter.refusal !== null) break;
      const tupleContext = kind === "KindArrayLiteralExpression" || kind === "KindParenthesizedExpression"
        ? contextualTupleUse(scope, node, parent, contextual) : null;
      if (scope.meter.refusal !== null) break;
      const tupleValue = (kind === "KindArrayLiteralExpression" || kind === "KindParenthesizedExpression")
        && answer.causes.length === 0 && scope.shape.isTuple(answer.type)
        ? tupleLiteralRead(scope, node, answer.type, parent) ?? (tupleContext === null
          ? null : retainTupleLiteral(scope, node, tupleContext.expression, answer.type)) : null;
      if (scope.meter.refusal !== null) break;
      const declaredRead = isDeclaredTupleRead(scope, node, answer);
      const declarationSymbol = declaredRead ? scope.checker.getSymbolAtLocation(node) : undefined;
      let authoredRead: Node | null = null;
      if (kind === "KindSpreadElement") authoredRead = valueTupleAnnotation(scope, ast.as.AsSpreadElement(node)?.Expression, answer);
      else if (kind === "KindCallExpression" && !failedSelection && scope.shape.isTuple(answer.type))
        authoredRead = callTupleAnnotation(scope, node, answer.type);
      else if (tupleValue === null && answer.causes.length === 0 && scope.shape.isTuple(answer.type)
        && (kind === "KindAsExpression" || kind === "KindTypeAssertionExpression" || kind === "KindParenthesizedExpression"))
        authoredRead = valueTupleAnnotation(scope, unparenthesizedTupleValue(scope, node), answer);
      else if (declarationSymbol !== undefined && admit(scope, "edges"))
        authoredRead = declaredTupleRead(scope, answer.type, scope.checker.getSymbolValueDeclaration(declarationSymbol));
      if (scope.meter.refusal !== null) break;
      let sharedRead: RawTypeId | null = null;
      if (kind === "KindPropertyAccessExpression" && declarationNameRoot === null && !failedSelection) {
        const selected = selectedMemberOf(scope, node, reference);
        if (selected === null) break;
        const sameRead = answer.causes.length === 0 && selected.sourceReadType === answer.type;
        const use = capturedMemberUse(scope, reference, selected, sameRead ? { position: readPosition, answer } : null);
        if (use === null) break;
        if (use.kind === "enum") {
          if (!admit(scope, "facts")) break;
          if (enumQualifiers === null && !admit(scope, "facts")) break;
          (enumQualifiers ??= new Set()).add(use.receiver.node);
        } else if (sameRead) sharedRead = use.read;
        memberUses.push(use);
      } else if (kind === "KindElementAccessExpression" && declarationNameRoot === null && !failedSelection) {
        const acquired = scope.checker.acquireResolvedElementAccess(node, nativeCaptureAdmission(scope));
        if (acquired.kind === "refused") {
          if (acquired.stop !== scope.meter.refusal)
            return throwInvariant(invariant("An indexed access acquisition must retain its actual first refusal."));
          break;
        }
        if (acquired.kind === "complete") {
          const selected = acquired.value;
          if (selected.expression !== node)
            return throwInvariant(invariant("An indexed access acquisition must retain its actual expression."));
          const declaration = selected.selectedDeclaration;
          if (selected.sourceSymbol === undefined && !selected.optionalChain && declaration !== undefined
            && scope.checked.ast.kindName(declaration) === "KindIndexSignature") {
            const sameRead = answer.causes.length === 0 && selected.sourceReadType === answer.type;
            const use = capturedIndexUse(scope, reference, selected, declaration, sameRead ? { position: readPosition, answer } : null);
            if (use === null) break;
            if (sameRead) sharedRead = use.read;
            memberUses.push(use);
          }
        }
      }
      const read = sharedRead ?? enqueueRawType(scope, answer, readPosition, authoredRead, tupleValue,
        kind === "KindNumericLiteral" || kind === "KindBigIntLiteral" ? node : null);
      let contextualSource: Node | null = null;
      if (tupleContext === null && contextual !== undefined && contextual.causes.length === 0) {
        if (scope.shape.isTuple(contextual.type)) {
          const contexts = scope.tables.tupleArgumentContexts;
          if (contexts !== null && !admit(scope, "edges")) break;
          const formal = contexts?.get(node);
          const variable = ast.kindName(parent) === "KindVariableDeclaration" ? ast.as.AsVariableDeclaration(parent) : undefined;
          const written = variable?.Initializer === node && ast.kindName(variable.name) === "KindArrayBindingPattern"
            ? tupleAnnotationOf(scope, contextual.type, variable.Type) : undefined;
          contextualSource = formal === undefined ? written ?? contextual.typeSource ?? null
            : formal.type === contextual.type ? formal.annotation : null;
        } else if (scope.sourcePrimitiveFacts && kind === "KindArrayLiteralExpression" && parent !== undefined) {
          contextualSource = contextualNativeArrayAnnotation(scope, node, parent, contextual);
        }
        if (scope.meter.refusal !== null) break;
      }
      const contextualType = contextual === undefined ? null
        : rawType(scope, () => contextual, component(scope, reference, null), contextualSource, tupleContext);
      if (contextual !== undefined && contextualType === null) break;
      const symbol = declaredRead ? declarationSymbol : scope.checker.getSymbolAtLocation(node);
      const symbolId = symbol === undefined ? null : rawSymbol(scope, symbol);
      if (symbol !== undefined && symbolId === null) break;
      if (!admit(scope, "facts")) break;
      views.push({ node: reference, read: available(read), declared: available(null), contextual: available(contextualType), symbol: available(symbolId),
        inferredStorageAlias: null });
      if (kind === "KindIdentifier" && symbolId !== null) {
        const captured = scope.tables.symbols[symbolId];
        if (captured === undefined) return throwInvariant(invariant("A reference has no actual captured symbol target."));
        if (!admit(scope, "edges")) break capture;
        const target = captured.target;
        const intrinsic = target.kind === "unavailable" && target.reason === "incomplete-association"
          ? scope.checker.getResolvedIntrinsicValueInfo(node) : undefined;
        if (intrinsic !== undefined && intrinsic.symbol !== symbol)
          return throwInvariant(invariant("An intrinsic value reference must retain the same actual checked symbol."));
        references.push({ occurrence: reference, meaning: "value", target: intrinsic === undefined ? target
          : { kind: "available", value: { kind: "intrinsic-value", intrinsic: intrinsic.kind } } });
      }
    }
    // An authored type annotation (the type child of its declaration): the type the checker gives that type node.
    if (heritage || kind !== "KindTemplateLiteralTypeSpan" && typeNodeKinds.includes(kind.replace(/^Kind/u, ""))) {
      const type = captureAuthoredAnnotation(scope, node, reference);
      if (type === null || !admit(scope, "facts")) break;
      annotations.push({ node: reference.node, type });
    }
    if (callableKinds.includes(kind)) {
      const signature = scope.checker.getSignatureFromDeclaration(node);
      if (signature === undefined) return throwInvariant(invariant("The checker gave no signature for a callable declaration."));
      const advertised = rawSignature(scope, signature, reference, kind === "KindConstructSignature" ? "construct" : "call");
      if (advertised === null) break;
      captureFacts(scope);
      if (scope.meter.refusal !== null) break;
      const body = ast.body(node);
      const parameters = ast.parameters(node).flatMap(parameter => {
        const id = parameter === undefined ? undefined : ownNodes.get(parameter);
        return id === undefined ? [] : [{ module, node: id }];
      });
      const bodyReference = body === undefined ? undefined : ownNodes.get(body);
      let implementation: OverloadBody | null = null;
      const declaration = body === undefined && kind === "KindFunctionDeclaration" ? scope.syntaxOf(reference.node) : undefined;
      if (declaration?.kind === "FunctionDeclaration" && !declaration.flags.includes("Ambient")
        && declaration.modifiers?.nodes.some(modifier => modifier.kind === "DeclareKeyword") !== true) {
        if (!admit(scope, "edges")) break;
        const name = ast.name(node);
        const symbol = name === undefined ? undefined : scope.checker.getSymbolAtLocation(name);
        if (symbol !== undefined) {
          let admitted = implementedOverloads?.get(symbol);
          if (admitted === undefined) {
            admitted = captureOverloadBody(scope, symbol);
            if (scope.meter.refusal !== null || !admit(scope, "facts")) break;
            (implementedOverloads ??= new Map()).set(symbol, admitted);
          }
          if (admitted !== null && admitted.container === parent) implementation = admitted;
        }
      }
      if (!admit(scope, "facts")) break;
      associations.push({
        declaration: reference, advertised: [advertised],
        body: bodyReference === undefined ? implementation?.body ?? notProvided() : available({ module, node: bodyReference }),
        classParameters: available([]), advertisedParameters: [{ signature: advertised, parameters: available(parameters) }],
        bodyParameters: bodyReference === undefined ? implementation?.parameters ?? notProvided() : available(parameters), captures: available([]),
      });
    }
    captureFacts(scope);
    if (scope.meter.refusal !== null) break;
    const invalidSelector = failedSelection ? scope.fieldSelectors?.get(reference.node) : undefined;
    if (invalidSelector !== undefined) {
      unavailableLayoutSelector(scope, invalidSelector);
      break;
    }
    if (kind === "KindCallExpression" && declarationNameRoot === null && !failedSelection) {
      const call = captureCall(scope, node, reference);
      if (call === null) break;
      calls.push(call);
    }
  }
  if (scope.invalidLayout !== null) return { kind: "refused", diagnostics: captureRefusal(scope.invalidLayout, checkerDiagnostics) };
  if (scope.meter.refusal === null && (scope.fieldSelectors?.size ?? 0) !== 0)
    return throwInvariant(invariant("Every captured field selector completes its actual property selection."));
  const core: RawCoreCapture[] = [];
  const providerDeclarations: RawProviderDeclaration[] = [];
  const dataLayouts: RawDataLayout[] = [];
  for (const [node, id] of ownNodes) {
    if (own.numbering.excluded?.has(node) === true) continue;
    if (!admit(scope, "facts")) break;
    const reference = { module, node: id };
    const kind = ast.kindName(node);
    if (kind === "KindInterfaceDeclaration" && !captureDeclaredInterfaceGroup(scope, node)) break;
    const provider = providerDeclaration(scope, node, reference);
    if (provider === null) break;
    if (provider !== undefined) {
      providerDeclarations.push(provider);
    }
    const markers = capturedMarkers(scope, node, id);
    if (markers === null) break;
    const application = kind === "KindCallExpression" ? scope.callCore.get(id) : undefined;
    const noObservation = kind !== "KindCallExpression" || application !== "ordinary" && application?.role === "layout-construction"
      || scope.emptyObservationInventory;
    const empty = coreFacts(reference, scope.emptyCoreInventory, noObservation);
    const base = markers === undefined ? empty : { ...empty, markers: available(markers) };
    const row = provider !== undefined ? { ...base, provider: available(provider) }
      : application === "ordinary" ? { ...base, provider: available(null) }
        : application?.role === "provider" ? { ...base, provider: available(application.receipt) } : base;
    if (input.platformLayouts !== null && kind === "KindVariableDeclaration" && provider !== undefined &&
      provider.identity.memberId === null && provider.identity.signatureId === null) {
      if (!admit(scope, "edges")) break;
      const selected = input.platformLayouts.get(provider.identity.exportId);
      if (selected !== undefined) {
        if (!admit(scope, "facts", 2)) break;
        const dataLayout = rawDataLayoutId(dataLayouts.length);
        dataLayouts.push({ id: dataLayout, identity: provider.identity, fingerprint: selected.fingerprint,
          byteOrder: selected.byteOrder, addressWidth: selected.addressWidth });
        core.push({ ...row, metadata: available({ kind: "data-layout", occurrence: reference, dataLayout }) });
        continue;
      }
    }
    const passing = kind === "KindParameter" ? declarationPassing(scope, node) : undefined;
    core.push(application !== undefined && application !== "ordinary"
      ? application.role === "layout-construction" || application.role === "layout-query"
        ? { ...row, provider: application.provider === undefined ? row.provider : available(application.provider),
          ...(application.role === "layout-construction" ? { metadata: available(application.capture) } : { layoutQuery: available(application.capture) }) }
        : row
      : passing === undefined ? row : { ...row, argumentPassing: available(passing) });
  }
  const exports: RawModuleExport[] = [];
  const moduleSymbol = scope.meter.refusal === null ? scope.checker.getSymbolAtLocation(file) : undefined;
  exported: for (const exported of moduleSymbol === undefined ? [] : scope.checker.getExportsOfModule(moduleSymbol)) {
    let declarations: [RawNodeRef, ...RawNodeRef[]] | null = null;
    for (const declaration of scope.checker.getSymbolDeclarations(exported.symbol)) {
      const target = declaration === undefined ? null : referenceTo(scope, program, declaration);
      if (scope.meter.refusal !== null) break exported;
      if (target === null) continue;
      if (!admit(scope, "edges")) break exported;
      if (declarations === null) declarations = [target];
      else declarations.push(target);
    }
    if (declarations === null) continue;
    let typeOnlyStar: RawNodeRef | null = null;
    if (exported.typeOnlyStar !== null) {
      if (!admit(scope, "edges")) break;
      typeOnlyStar = referenceTo(scope, program, exported.typeOnlyStar);
      if (scope.meter.refusal !== null) break;
      if (typeOnlyStar === null)
        return throwInvariant(invariant("A type-only export star must retain its actual admitted syntax occurrence."));
    }
    exports.push({ name: exported.name, declarations, typeOnlyStar });
  }
  // A capture that met a limit returns its refusal and nothing of what it read.
  if (scope.meter.refusal !== null) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal, checkerDiagnostics) };
  const diagnosticCoverage = captureDiagnosticCoverage(scope, checkerDiagnostics);
  if (diagnosticCoverage === null) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal
    ?? throwInvariant(invariant("Backing evidence capture must retain its first resource refusal.")), checkerDiagnostics) };
  let publicLibraryModule: RawModule["publicLibraryModule"] = null;
  if (input.origin.kind === "session-document" && input.origin.document.artifact === "public") {
    if (!admit(scope, "edges")) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal
      ?? throwInvariant(invariant("Provider model admission must retain its first resource refusal.")), checkerDiagnostics) };
    const model = input.providerModel;
    if (model === null) return throwInvariant(invariant("A public provider document must retain its actual admitted model."));
    const projected = projectProviderModel({ admit: kind => admit(scope, kind), literals: deps.literalCapture }, input.origin.document, model, tree.origin);
    if (projected.kind === "refused") return { kind: "refused", diagnostics: captureRefusal(projected.diagnostic ?? scope.meter.refusal
      ?? throwInvariant(invariant("Provider model projection must retain its first resource refusal.")), checkerDiagnostics) };
    publicLibraryModule = projected.module;
  }
  if (scope.tables.interfaceDescriptions.size !== 0) {
    const retained = scope.tables.interfaceDescriptions.size + (interfaceCapture.descriptions === null ? 1 : 0);
    if (!admit(scope, "facts", retained)) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal
      ?? throwInvariant(invariant("Retaining complete interface descriptions must preserve its actual first refusal.")), checkerDiagnostics) };
    const descriptions = interfaceCapture.descriptions ??= new Set();
    for (const target of scope.tables.interfaceDescriptions.keys()) descriptions.add(target);
  }
  const raw: RawModule = {
    module, tree,
    types: { types: scope.tables.types, components: scope.tables.components, signatures: scope.tables.signatures, members: scope.tables.members,
      symbols: scope.tables.symbols, candidates: scope.tables.candidates, dataLayouts, memoryDescriptors: scope.tables.memoryDescriptors,
      interfaceGroups: scope.tables.interfaceGroups.rows, interfaceDescriptions: [...scope.tables.interfaceDescriptions.values()] },
    annotations, checkerViews: views, calls, callableAssociations: associations, providerDeclarations, publicLibraryModule, references, links, exports, bindings,
    implementations: [], heritage: [], constructors: [], enums, propertyNames, memberUses, protocols: [], storage, core,
    checkerDiagnostics, diagnosticCoverage,
  };
  return { kind: "ok", value: raw, diagnostics: checkerDiagnostics };
}

export function captureRawModules(deps: CaptureDeps, program: CheckedProgram, modules: readonly ModuleId[]): Result<readonly RawModule[]> {
  const prepared: RawModule[] = [];
  let soleDiagnostics: readonly Diagnostic[] = [];
  let combined: Diagnostic[] | null = null;
  const interfaceCapture: InterfaceCaptureSession = { descriptions: null, declarations: null, applications: null, groups: null };
  for (const module of modules) {
    const captured = captureRawModule(deps, program, module, interfaceCapture);
    if (captured.kind === "refused") return captured;
    prepared.push(captured.value);
    if (captured.diagnostics.length === 0) continue;
    if (soleDiagnostics.length === 0) soleDiagnostics = captured.diagnostics;
    else {
      const output = combined ??= [...soleDiagnostics];
      for (const diagnostic of captured.diagnostics) output.push(diagnostic);
    }
  }
  return { kind: "ok", value: prepared, diagnostics: combined ?? soleDiagnostics };
}

function captureRefusal(refusal: Diagnostic, earned: readonly Diagnostic[]): readonly [Diagnostic, ...Diagnostic[]] {
  const first = earned[0];
  if (first === undefined) return [refusal];
  const diagnostics: [Diagnostic, ...Diagnostic[]] = [first];
  for (let index = 1; index < earned.length; index += 1) {
    diagnostics.push(earned[index] ?? throwInvariant(invariant("An earned checker diagnostic cannot disappear from its capture.")));
  }
  diagnostics.push(refusal);
  return diagnostics;
}

/** The tree's kinds, for the one check of lowering (re-exported so lowering and capture name one source). */
export type CapturedTree = Hir.SourceFile<Hir.SyntaxPhase>;
