import type { ArgumentPassingFact, Node, Signature, SourceFile, Symbol as CheckerSymbol, Type, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
import { argumentPassingFactKey } from "@tsonic/tsts";
import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { ModuleId, NodeId } from "../ids/contract.js";
import { nodeId, rawCandidateListId, rawComponentId, rawMemberTableId, rawSignatureId, rawSymbolId, rawTypeId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import type { RawComponentId, RawSignatureId, RawSymbolId, RawTypeId } from "../ids/contract.js";
import type {
  CaptureDeps, CheckedProgram, RawArgumentBinding, RawAuthoredArgument, RawBinding, RawBindingTarget, RawCallSelection, RawCallableAssociation, RawCandidateList, RawCoreCapture, RawCheckedType, RawCheckerViews, RawComponent, RawComponentStep, RawDiagnosticCoverage, RawFact, RawMemberTable, RawModule, RawModuleExport, RawModuleLink, RawNodeRef, RawParameter, RawReference, RawSignature, RawSymbol, RawTypeForm,
} from "./contract.js";
import { ExtensionTable, OpenedProgram } from "./handles.js";
import type { FileNumbering, FileSyntaxEntry } from "./handles.js";
import { captureNode, expressionKinds } from "./syntax-capture.js";
import type { SyntaxCaptureContext } from "./syntax-support.js";
import { isModuleBindingKind } from "../ir-hir/index.js";
import { captureCheckerDiagnostic } from "./diagnostics.js";

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });
const available = <Value>(value: Value): RawFact<Value> => ({ kind: "available", value });
const notProvided = <Value>(): RawFact<Value> => ({ kind: "unavailable", reason: "not-provided", diagnostics: [] });

/** The declaration kinds whose node is the declaration of a callable with a signature and possibly a body. */
const callableKinds: readonly string[] = ["KindFunctionDeclaration"];

/**
 * The tables of one capture, built while the module's nodes are read. Each table's identities are positions in it,
 * assigned in the order the module's nodes are visited, so that a capture of equal inputs gives equal tables.
 */
interface CaptureTables {
  readonly types: RawCheckedType[];
  readonly components: RawComponent[];
  readonly signatures: RawSignature[];
  readonly members: RawMemberTable[];
  readonly candidates: RawCandidateList[];
  readonly symbols: RawSymbol[];
  readonly symbolIds: Map<CheckerSymbol, RawSymbolId>;
  readonly signatureIds: Map<Signature, RawSignatureId>;
  nextType: number;
  nextMember: number;
  readonly pending: CaptureTask[];
}

type CaptureTask =
  | { readonly kind: "type"; readonly id: RawTypeId; readonly type: Type; readonly position: RawComponentId; readonly authoredTypeNode: RawNodeRef | null }
  | { readonly kind: "signature"; readonly id: RawSignatureId; readonly signature: Signature; readonly owner: RawNodeRef; readonly signatureKind: "call" | "construct" }
  | { readonly kind: "signature-parameter"; readonly draft: SignatureDraft; readonly index: number };

interface SignatureDraft {
  readonly id: RawSignatureId;
  readonly signature: Signature;
  readonly owner: RawNodeRef;
  readonly kind: "call" | "construct";
  readonly declarationNode: Node | undefined;
  readonly declaration: RawNodeRef | null;
  readonly parameterInfos: ReturnType<TypeShapeQueries["getSignatureParameterInfos"]>;
  readonly parameters: RawParameter[];
}

/** The facts and edges a capture has admitted, and the first limit it met. */
interface CaptureMeter {
  facts: number;
  edges: number;
  refusal: Diagnostic | null;
}

interface CaptureScope {
  readonly deps: CaptureDeps;
  readonly program: CheckedProgram;
  readonly path: string;
  readonly meter: CaptureMeter;
  readonly module: ModuleId;
  readonly file: SourceFile;
  readonly checked: OpenedProgramView;
  readonly checker: TypeCheckerQueries;
  readonly shape: TypeShapeQueries;
  readonly ownNodes: ReadonlyMap<Node, NodeId>;
  readonly emptyCoreInventory: boolean;
  readonly tables: CaptureTables;
}

type OpenedProgramView = ReturnType<typeof OpenedProgram.checked>;

const limitRefusal = (module: ModuleId, path: string, limit: string, maximum: number): Diagnostic =>
  resourceLimitDiagnostic({ owner: "front", limit, maximum, site: { kind: "file", path }, unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } });

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
  const pending: { readonly node: Node; readonly depth: number }[] = [{ node: file, depth: 1 }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next.depth > limits.maximumSyntaxDepth) return keep({ kind: "refused", diagnostic: limitRefusal(module, path, "front.maximumSyntaxDepth", limits.maximumSyntaxDepth) });
    if (nodes.length + 1 > limits.maximumCapturedNodesPerModule)
      return keep({ kind: "refused", diagnostic: limitRefusal(module, path, "front.maximumCapturedNodesPerModule", limits.maximumCapturedNodesPerModule) });
    nodes.push(next.node);
    const children: Node[] = [];
    ast.forEachChild(next.node, child => { if (child !== undefined) children.push(child); });
    const depth = next.depth + 1;
    for (let position = children.length - 1; position >= 0; position -= 1) {
      const child = children[position];
      if (child !== undefined) pending.push({ node: child, depth });
    }
  }
  const numbering: FileNumbering = { nodes, ids: new Map(nodes.map((node, index) => [node, nodeId(index)])) };
  return keep({ kind: "numbered", numbering });
}

/** Admits one more fact or edge, before it is added; the first one over its limit stops the capture with a refusal. */
function admit(scope: CaptureScope, dimension: "facts" | "edges"): boolean {
  if (scope.meter.refusal !== null) return false;
  const maximum = dimension === "facts" ? scope.deps.navigationCapture.maximumCapturedFactsPerModule : scope.deps.navigationCapture.maximumCapturedEdgesPerModule;
  if (scope.meter[dimension] + 1 > maximum) {
    scope.meter.refusal = limitRefusal(scope.module, scope.path, dimension === "facts" ? "front.maximumCapturedFactsPerModule" : "front.maximumCapturedEdgesPerModule", maximum);
    return false;
  }
  scope.meter[dimension] += 1;
  return true;
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

function referenceTo(scope: CaptureScope, program: CheckedProgram, declaration: Node): RawNodeRef | null {
  const ast = scope.checked.ast;
  const file = ast.getSourceFile(declaration);
  if (file === undefined) return null;
  const module = moduleOfFile(program, file, ast);
  if (module === undefined) return null;
  if (file === scope.file) {
    const own = scope.ownNodes.get(declaration);
    return own === undefined ? null : { module, node: own };
  }
  const other = fileNumberingOf(scope.deps, program, ast.getFileName(file), module);
  if (other.kind === "refused") {
    if (scope.meter.refusal === null) scope.meter.refusal = other.diagnostic;
    return null;
  }
  const node = other.numbering.ids.get(declaration);
  return node === undefined ? null : { module, node };
}

/**
 * Every growth below is admitted before anything is read for it, and returns null once the capture has met a limit:
 * the first refusal stops all further checker reads and rows (K-3341); the callers stop at the null.
 */
function component(scope: CaptureScope, root: RawNodeRef, path: readonly RawComponentStep[]): RawComponentId | null {
  if (!admit(scope, "facts")) return null;
  const id = rawComponentId(scope.tables.components.length);
  scope.tables.components.push({ id, root, path });
  return id;
}

/**
 * The captured form of a checker type. Scalars and memberless callable inventories retain the SDK's actual forms; any other form is a defect of
 * this capture's development frontier (a compiler defect, never a user diagnostic), named with the checker's own
 * text of the type.
 */
function typeForm(scope: CaptureScope, type: Type, position: RawComponentId): RawTypeForm | null {
  const shape = scope.shape;
  const literal = shape.getNumericLiteralTypeValue(type) !== undefined || shape.getStringLiteralTypeValue(type) !== undefined ||
    shape.getBooleanLiteralTypeValue(type) !== undefined;
  // The checker's `boolean` is a union of its two literal types and is boolean-like as a whole; any other union is not a scalar.
  if (!literal && !shape.isIntersection(type) && shape.isBooleanLike(type)) return { kind: "scalar", scalar: "boolean" };
  if (!literal && !shape.isUnion(type) && !shape.isIntersection(type)) {
    if (shape.isNumberLike(type)) return { kind: "scalar", scalar: "number" };
    if (shape.isStringLike(type)) return { kind: "scalar", scalar: "string" };
    if (shape.isBigIntLike(type)) return { kind: "scalar", scalar: "bigint" };
    if (shape.isAny(type)) return { kind: "scalar", scalar: "any" };
    if (shape.isUnknown(type)) return { kind: "scalar", scalar: "unknown" };
    if (shape.isNever(type)) return { kind: "scalar", scalar: "never" };
  }
  const calls = shape.getCallSignatures(type);
  const constructs = shape.getConstructSignatures(type);
  if (calls.length !== 0 || constructs.length !== 0) {
    if (shape.getPropertyInfos(type).length !== 0 || shape.getIndexInfos(type).length !== 0)
      throw new TypeError("front: the captured members of a callable checker type are not implemented");
    if (!admit(scope, "facts")) return null;
    const inventory = rawMemberTableId(scope.tables.nextMember++);
    const root = scope.tables.components[position]?.root;
    if (root === undefined) return throwInvariant(invariant("A callable type has no captured component root."));
    const captureSignatures = (signatures: readonly (Signature | undefined)[], kind: "call" | "construct"): RawSignatureId[] | null => {
      const captured: RawSignatureId[] = [];
      for (const signature of signatures) {
        if (!admit(scope, "edges")) return null;
        if (signature === undefined) return throwInvariant(invariant("A callable inventory contains an absent signature."));
        const id = rawSignature(scope, signature, root, kind);
        if (id === null) return null;
        captured.push(id);
      }
      return captured;
    };
    const callSignatures = captureSignatures(calls, "call");
    if (callSignatures === null) return null;
    const constructSignatures = captureSignatures(constructs, "construct");
    if (constructSignatures === null) return null;
    scope.tables.members[inventory] = { id: inventory, component: position, members: [], indexes: [], elementBinders: available([]),
      calls: callSignatures, constructs: constructSignatures };
    return { kind: "structure", inventory };
  }
  throw new TypeError(`front: the captured form of the checker type ${scope.checker.typeToString(type)} is not implemented`);
}

function closedInventoryEmpty(program: CheckedProgram): boolean {
  const contributions = OpenedProgram.contributions(program);
  return OpenedProgram.libraryData(program).every(entry => entry.roles.length === 0) &&
    ExtensionTable.semantics(OpenedProgram.table(program)).every(module => module.exports.length === 0) && contributions.safetyProviders.length === 0 &&
    contributions.declarationProviders.length === 0 && contributions.compilerExtensions.length === 0;
}

function declarationPassing(scope: CaptureScope, node: Node | undefined): Extract<ArgumentPassingFact, { readonly role: "declaration" }> | undefined {
  const fact = scope.checked.sourceFacts.getFact(node, argumentPassingFactKey);
  if (fact !== undefined && fact.role !== "declaration")
    return throwInvariant(invariant("A signature parameter's passing fact must belong to its actual declaration."));
  return fact;
}

function coreFacts(node: RawNodeRef, empty: boolean): RawCoreCapture {
  const proven = <Value>(value: Value): RawFact<Value> => empty ? available(value) : notProvided();
  return {
    node, provider: proven(null), markers: proven({ struct: null, field: null, defaultValue: null, jsString: false }), pointerType: proven(null),
    pointerOperation: proven(null), metadata: proven(null), layout: proven(null), field: proven(null), fieldBinding: proven(null),
    recordBinding: proven(null), layoutQuery: proven(null), attribute: proven(null), safety: proven(null), argumentPassing: proven(null), flowState: proven(null),
  };
}

/** The type at one position (component); each position has its own row, so a row's component is where it was read. */
function rawType(scope: CaptureScope, read: () => Type | undefined, position: RawComponentId | null, authoredTypeNode: RawNodeRef | null): RawTypeId | null {
  if (position === null || !admit(scope, "facts")) return null;
  const type = read();
  if (type === undefined) return throwInvariant(invariant("The checker returned no type at a position that has one."));
  const id = rawTypeId(scope.tables.nextType++);
  scope.tables.pending.push({ kind: "type", id, type, position, authoredTypeNode });
  return id;
}

function captureFacts(scope: CaptureScope): void {
  while (scope.meter.refusal === null) {
    const next = scope.tables.pending.pop();
    if (next === undefined) return;
    if (next.kind === "signature") captureSignature(scope, next.id, next.signature, next.owner, next.signatureKind);
    else if (next.kind === "signature-parameter") captureSignatureParameter(scope, next.draft, next.index);
    else {
      let form: RawFact<RawTypeForm>;
      if (scope.shape.isError(next.type)) form = { kind: "unavailable", reason: "missing-original-component", diagnostics: [] };
      else {
        const captured = typeForm(scope, next.type, next.position);
        if (captured === null) return;
        form = available(captured);
      }
      scope.tables.types[next.id] = {
        id: next.id, component: next.position, authoredTypeNode: next.authoredTypeNode, declaration: null, definitionOwner: null, definitionFacet: null,
        definitionParameters: available([]), alias: available(null), instantiatedBases: available([]), literal: available(null),
        primitive: notProvided(), form,
      };
    }
  }
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
  if (symbol === undefined) return { kind: "unavailable", reason: "incomplete-association", diagnostics: [] };
  const step = scope.checker.getAliasStep(symbol);
  if (step === undefined) return { kind: "unavailable", reason: "incomplete-association", diagnostics: [] };
  const targetSymbol = step.kind === "symbol" ? step.symbol : step.exportAssignment;
  return symbolTarget(scope, targetSymbol, step.kind === "exported-value-member" ? step.member : null);
}

function symbolTarget(scope: CaptureScope, targetSymbol: CheckerSymbol, memberSymbol: CheckerSymbol | undefined | null): RawFact<RawBindingTarget> | null {
  const declarations: RawNodeRef[] = [];
  let targetBinding = false;
  let targetModule: ModuleId | null = null;
  for (const declaration of scope.checker.getSymbolDeclarations(targetSymbol)) {
    if (!admit(scope, "edges")) return null;
    if (declaration === undefined) return throwInvariant(invariant("An alias target declaration inventory contains an absent row."));
    const reference = referenceTo(scope, scope.program, declaration);
    if (scope.meter.refusal !== null) return null;
    if (reference === null) return { kind: "unavailable", reason: "incomplete-association", diagnostics: [] };
    const kind = scope.checked.ast.kindName(declaration);
    if (memberSymbol === null && kind === "KindSourceFile") {
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
  if (first === undefined) return { kind: "unavailable", reason: "incomplete-association", diagnostics: [] };
  if (memberSymbol !== null) {
    const member = memberSymbol === undefined ? null : rawSymbol(scope, memberSymbol);
    if (scope.meter.refusal !== null) return null;
    return available({ kind: "member", through: [first, ...declarations.slice(1)],
      member: member === null ? { kind: "unavailable", reason: "incomplete-association", diagnostics: [] } : available(member),
      key: { kind: "unavailable", reason: "incomplete-association", diagnostics: [] },
      origins: { kind: "unavailable", reason: "incomplete-association", diagnostics: [] } });
  }
  if (targetBinding) {
    if (declarations.length !== 1) return throwInvariant(invariant("A nearest alias binding must identify its actual single syntax occurrence."));
    return available({ kind: "binding", occurrence: first });
  }
  return available({ kind: "declarations", declarations: [first, ...declarations.slice(1)] });
}

function rawSignature(scope: CaptureScope, signature: Signature, owner: RawNodeRef, kind: "call" | "construct"): RawSignatureId | null {
  const known = scope.tables.signatureIds.get(signature);
  if (known !== undefined) return known;
  if (!admit(scope, "facts")) return null;
  const id = rawSignatureId(scope.tables.signatureIds.size);
  scope.tables.signatureIds.set(signature, id);
  scope.tables.pending.push({ kind: "signature", id, signature, owner, signatureKind: kind });
  return id;
}

function captureSignature(scope: CaptureScope, id: RawSignatureId, signature: Signature, owner: RawNodeRef, kind: "call" | "construct"): void {
  const program = scope.program;
  const declarationNode = scope.checker.getSignatureDeclaration(signature);
  const declaration = declarationNode === undefined ? null : referenceTo(scope, program, declarationNode);
  if (scope.meter.refusal !== null) return;
  scope.tables.pending.push({ kind: "signature-parameter", index: 0, draft: { id, signature, owner, kind, declarationNode, declaration,
    parameterInfos: scope.shape.getSignatureParameterInfos(signature), parameters: [] } });
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
    const position = component(scope, owner, [{ kind: "parameter", signature: id, index }]);
    if (position === null) return;
    const parameterSymbol = rawSymbol(scope, symbol);
    if (parameterSymbol === null) return;
    scope.tables.pending.push({ kind: "signature-parameter", draft, index: index + 1 });
    const type = rawType(scope, () => parameter.type, position, null);
    if (type === null) return;
    const parameterSyntax = parameterNode === undefined || scope.checked.ast.kindName(parameterNode) !== "KindParameter"
      ? undefined : scope.checked.ast.as.AsParameterDeclaration(parameterNode);
    if (parameterNode !== undefined && scope.checked.ast.kindName(parameterNode) === "KindParameter" && parameterSyntax === undefined)
      return throwInvariant(invariant("The checker gave no parameter syntax for its parameter declaration."));
    const initializerNode = parameterSyntax?.Initializer;
    const initializer = initializerNode === undefined ? null : referenceTo(scope, program, initializerNode);
    if (scope.meter.refusal !== null) return;
    if (!admit(scope, "facts")) return;
    const passingFact = declarationPassing(scope, parameterNode);
    const passing: RawParameter["passing"] = passingFact === undefined
      ? parameterNode !== undefined && scope.emptyCoreInventory ? available("by-value") : notProvided()
      : available(passingFact.mode);
    parameters.push({ declaration: parameterReference, symbol: parameterSymbol, kind: parameter.parameterKind, component: position, type, acceptsOmission: parameter.acceptsOmission,
      initializer, passing });
    return;
  }
  captureSignatureTail(scope, draft);
}

function captureSignatureTail(scope: CaptureScope, draft: SignatureDraft): void {
  const { id, signature, owner, kind, declarationNode, declaration, parameters } = draft;
  const program = scope.program;
  // The explicit this receiver (K-3361), which the checker keeps apart from the ordinary parameters: the SDK's own
  // query answers it, so its absence is the checker's, not assumed.
  const thisSymbol = scope.checker.getSignatureThisParameter(signature);
  let receiver: RawParameter | null = null;
  if (thisSymbol !== undefined) {
    const receiverNode = scope.checker.getSymbolDeclarations(thisSymbol)[0];
    const receiverReference = receiverNode === undefined ? null : referenceTo(scope, program, receiverNode);
    if (scope.meter.refusal !== null) return;
    const position = component(scope, owner, [{ kind: "receiver", signature: id }]);
    if (position === null) return;
    const receiverSymbol = rawSymbol(scope, thisSymbol);
    if (receiverSymbol === null) return;
    const type = rawType(scope, () => scope.checker.getTypeOfSymbol(thisSymbol), position, null);
    if (type === null) return;
    receiver = { declaration: receiverReference, symbol: receiverSymbol, kind: "required", component: position, type, acceptsOmission: false, initializer: null,
      passing: notProvided() };
  }
  // The type parameters of the declaration, used or not (K-3361): each declaration node, as the syntax holds it.
  const typeParameters: RawNodeRef[] = [];
  for (const parameter of declarationNode === undefined ? [] : scope.checked.ast.typeParameters(declarationNode)) {
    const reference = parameter === undefined ? null : referenceTo(scope, program, parameter);
    if (scope.meter.refusal !== null) return;
    if (reference === null) return throwInvariant(invariant("A type parameter of a captured signature's declaration has no node identity."));
    typeParameters.push(reference);
  }
  const result = rawType(scope, () => scope.checker.getReturnTypeOfSignature(signature), component(scope, owner, [{ kind: "result", signature: id }]), null);
  if (result === null) return;
  scope.tables.signatures[id] = {
    id, target: null, owner, declaration, kind, typeParameters: available(typeParameters), receiver: available(receiver), parameters,
    result: available(result), composition: null,
  };
}

function captureCall(scope: CaptureScope, node: Node, invocation: RawNodeRef): RawCallSelection | null {
  const info = scope.checker.getResolvedCallInfo(node);
  if (info === undefined) return throwInvariant(invariant("The checker gave no call evidence for a captured call."));
  if (info.kind !== "applicable") throw new TypeError("front: conditional or untyped call capture is not implemented");
  const selected = info.selection;
  const application = selected.application;
  if (info.declarationOrder.kind !== "available" || info.declarationOrder.signatures.length !== 1)
    throw new TypeError("front: complete applicable candidate capture is not implemented without a proven singleton declaration order");
  if (info.declarationOrder.signatures[0] !== application.signature || application.instantiatedSignature !== application.signature)
    throw new TypeError("front: nonidentical selected and declared singleton signature capture is not implemented");
  if (application.class !== undefined || application.signatureTypeArguments.length !== 0 || application.receiver !== undefined || application.signatureShape.composite !== undefined)
    throw new TypeError("front: generic, receiver-bearing or composed call capture is not implemented");
  if (selected.constraints.length !== 0 || selected.diagnostics.length !== 0 || selected.diagnosticCoverage.length !== 0)
    throw new TypeError("front: call diagnostic obligations capture is not implemented");
  if (selected.inferenceContributions.kind === "available" && selected.inferenceContributions.contributions.length !== 0)
    throw new TypeError("front: call inference contribution capture is not implemented");
  const signature = rawSignature(scope, application.instantiatedSignature, invocation, application.kind);
  if (signature === null) return null;
  const callee = referenceTo(scope, scope.program, application.callee.expression);
  if (callee === null) return scope.meter.refusal !== null ? null : throwInvariant(invariant("The selected callee has no source identity."));
  const sourceArguments: RawAuthoredArgument[] = [];
  for (const [index, argument] of selected.sourceArguments.entries()) {
    if (!admit(scope, "edges")) return null;
    if (scope.checked.ast.kindName(argument) === "KindSpreadElement") throw new TypeError("front: spread call argument capture is not implemented");
    const occurrence = referenceTo(scope, scope.program, argument);
    if (occurrence === null) return scope.meter.refusal !== null ? null : throwInvariant(invariant("A call argument has no source identity."));
    const position = component(scope, invocation, [{ kind: "argument-place", index }]);
    if (position === null || rawType(scope, () => scope.checker.getTypeAtLocation(argument), position, null) === null) return null;
    sourceArguments.push({ occurrence, expression: occurrence, kind: "value", component: available(position) });
  }
  const bindings: RawArgumentBinding[] = [];
  for (const argument of selected.arguments.values) {
    if (!admit(scope, "edges")) return null;
    const sourceArgument = referenceTo(scope, scope.program, argument.sourceArgument);
    const effectiveArgument = referenceTo(scope, scope.program, argument.effectiveArgument);
    if (sourceArgument === null || effectiveArgument === null)
      return scope.meter.refusal !== null ? null : throwInvariant(invariant("A selected call argument has no source identity."));
    const source = component(scope, invocation, [{ kind: "argument-place", index: argument.effectiveArgumentIndex }]);
    if (source === null) return null;
    const destination = component(scope, invocation, [{ kind: "parameter", signature, index: argument.parameterIndex }]);
    if (destination === null) return null;
    if (argument.selectedArgumentType === undefined || argument.selectedParameterType === undefined)
      throw new TypeError("front: incomplete selected call argument types capture is not implemented");
    if (rawType(scope, () => argument.selectedArgumentType, source, null) === null || rawType(scope, () => argument.selectedParameterType, destination, null) === null) return null;
    bindings.push({ sourceArgument, sourceArgumentIndex: argument.sourceArgumentIndex, effectiveArgument,
      effectiveArgumentIndex: argument.effectiveArgumentIndex, sourceForm: argument.sourceForm, spreadElementIndex: argument.spreadElementIndex ?? null,
      parameterIndex: argument.parameterIndex, parameterForm: argument.parameterForm, source: available(source), destination: available(destination) });
  }
  const declarationOrder: RawSignatureId[] = [];
  if (info.declarationOrder.kind === "available") {
    for (const declared of info.declarationOrder.signatures) {
      if (!admit(scope, "edges")) return null;
      const id = rawSignature(scope, declared, invocation, application.kind);
      if (id === null) return null;
      declarationOrder.push(id);
    }
  }
  const result = rawType(scope, () => info.resultType, component(scope, invocation, []), null);
  if (result === null || !admit(scope, "facts")) return null;
  const candidates = rawCandidateListId(scope.tables.candidates.length);
  if (!admit(scope, "facts") || !admit(scope, "facts")) return null;
  scope.tables.candidates.push({ id: candidates, candidates: [{ ordinal: 0,
    application: { invocation, kind: application.kind, signature, callee, receiver: null, classArguments: [], signatureArguments: [] }, sourceArguments,
    arguments: available(bindings), inferenceContributions: selected.inferenceContributions.kind === "available" ? available([]) : notProvided(),
    constraints: [], diagnostics: [], diagnosticCoverage: [] }] });
  captureFacts(scope);
  if (scope.meter.refusal !== null) return null;
  const completed = scope.tables.signatures[signature];
  if (completed === undefined) return throwInvariant(invariant("A selected call has no completed captured signature."));
  return { kind: "applicable", invocation, declarationOrder: info.declarationOrder.kind === "available" ? available(declarationOrder) : notProvided(),
    candidates, selectedOrdinal: 0, result, parameters: completed.parameters };
}

/**
 * The raw capture of one module of the opened program: its syntax tree in HIR's syntax phase and the checker's
 * evidence about it. The categories of evidence written so far are those the checked annotations written so far
 * read: the views of expressions, the references of identifier uses, the symbols and signatures they name, the
 * callable associations, callable inventories and selected calls, and the module's export entries; remaining tables are empty, and
 * lowering refuses a module that holds a kind whose checked annotation is not written (one check, in lowerModule).
 */
export function captureRawModule(deps: CaptureDeps, program: CheckedProgram, module: ModuleId): Result<RawModule> {
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
  const original = input.text;
  const delivered = ast.getSourceText(file);
  const displacement = original.length - delivered.length;
  if (displacement < 0 || original.slice(displacement) !== delivered) return throwInvariant(invariant("The checker's text of a module does not join its captured text."));
  // The syntax capture takes each node's identity from the numbering, and must reach the nodes in its order.
  let visited = 0;
  const context: SyntaxCaptureContext = { ast, file, module, displacement, next: node => {
    const id = ownNodes.get(node);
    if (id === undefined || id !== nodeId(visited)) return throwInvariant(invariant("The syntax capture visits a module's nodes in another order than its numbering."));
    visited += 1;
    return id;
  } };
  const tree = captureNode(context, file, null);
  if (tree.kind !== "SourceFile") return throwInvariant(invariant("A module's captured tree is not a source file."));
  if (visited !== nodes.length) return throwInvariant(invariant("The syntax capture reaches fewer nodes than the module's numbering."));
  const queries = checked.getSourceFileQueries(file);
  const scope: CaptureScope = { deps, program, path, meter: { facts: 0, edges: 0, refusal: null }, module, file, checked, checker: queries.checker,
    shape: queries.typeShape, ownNodes, emptyCoreInventory: closedInventoryEmpty(program),
    tables: { types: [], components: [], signatures: [], members: [], candidates: [], symbols: [], symbolIds: new Map(), signatureIds: new Map(), nextType: 0, nextMember: 0, pending: [] } };
  const checkerDiagnostics: Diagnostic[] = [];
  const diagnosticCoverage: RawDiagnosticCoverage[] = [];
  for (const diagnostic of checked.diagnostics) {
    if (diagnostic === undefined) return throwInvariant(invariant("The checker returned an absent published diagnostic."));
    if (diagnostic.file !== file) continue;
    const captured = captureCheckerDiagnostic(program, diagnostic, () => admit(scope, "facts"));
    if (captured === null) break;
    const index = checkerDiagnostics.length;
    checkerDiagnostics.push(captured);
    if (!admit(scope, "facts")) break;
    diagnosticCoverage.push({ kind: "unavailable", root: { module, index } });
  }
  if (scope.meter.refusal !== null) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal, checkerDiagnostics) };
  const views: RawCheckerViews[] = [];
  const references: RawReference[] = [];
  const links: RawModuleLink[] = [];
  const associations: RawCallableAssociation[] = [];
  const calls: RawCallSelection[] = [];
  const bindings: RawBinding[] = [];
  capture: for (const [index, node] of nodes.entries()) {
    const reference: RawNodeRef = { module, node: nodeId(index) };
    const kind = ast.kindName(node);
    const parent = ast.parent(node);
    const declarationName = parent !== undefined && ast.name(parent) === node;
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
    const moduleExpression = moduleSpecifier(ast, node, parent);
    if (moduleExpression && parent !== undefined) {
      const symbol = scope.checker.getSymbolAtLocation(node);
      const id = symbol === undefined ? null : rawSymbol(scope, symbol);
      if (scope.meter.refusal !== null) break;
      const target = id === null ? undefined : scope.tables.symbols[id]?.target;
      const declaration = referenceTo(scope, program, parent);
      if (scope.meter.refusal !== null) break;
      if (declaration === null) return throwInvariant(invariant("A captured module link has no actual syntax statement."));
      if (!admit(scope, "edges")) break;
      links.push({ declaration, specifier: reference, kind: ast.kindName(parent) === "KindExportDeclaration" ? "export" : "import",
        resolution: target?.kind === "available" && target.value.kind === "module" ? { kind: "project", module: target.value.module } : { kind: "unresolved" } });
    }
    if (expressionKinds.includes(kind.replace(/^Kind/u, "")) && !declarationName && !bindingName && !moduleExpression) {
      const read = rawType(scope, () => scope.checker.getTypeAtLocation(node), component(scope, reference, []), null);
      if (read === null) break;
      const contextual = scope.checker.getContextualType(node);
      const contextualType = contextual === undefined ? null : rawType(scope, () => contextual, component(scope, reference, []), null);
      if (contextual !== undefined && contextualType === null) break;
      const symbol = scope.checker.getSymbolAtLocation(node);
      const symbolId = symbol === undefined ? null : rawSymbol(scope, symbol);
      if (symbol !== undefined && symbolId === null) break;
      if (!admit(scope, "facts")) break;
      views.push({ node: reference, read: available(read), declared: available(null), contextual: available(contextualType), symbol: available(symbolId) });
      if (kind === "KindIdentifier" && symbolId !== null) {
        const captured = scope.tables.symbols[symbolId];
        if (captured === undefined) return throwInvariant(invariant("A reference has no actual captured symbol target."));
        if (!admit(scope, "edges")) break capture;
        references.push({ occurrence: reference, meaning: "value", target: captured.target });
      }
    }
    // An authored type annotation (the type child of its declaration): the type the checker gives that type node.
    if (parent !== undefined && ast.typeNode(parent) === node &&
      rawType(scope, () => scope.checker.getTypeFromTypeNode(node), component(scope, reference, []), reference) === null) break;
    if (callableKinds.includes(kind)) {
      const signature = scope.checker.getSignatureFromDeclaration(node);
      if (signature === undefined) return throwInvariant(invariant("The checker gave no signature for a callable declaration."));
      const advertised = rawSignature(scope, signature, reference, "call");
      if (advertised === null) break;
      captureFacts(scope);
      if (scope.meter.refusal !== null) break;
      const body = ast.body(node);
      const parameters = ast.parameters(node).flatMap(parameter => {
        const id = parameter === undefined ? undefined : ownNodes.get(parameter);
        return id === undefined ? [] : [{ module, node: id }];
      });
      const bodyReference = body === undefined ? undefined : ownNodes.get(body);
      if (!admit(scope, "facts")) break;
      associations.push({
        declaration: reference, advertised: [advertised],
        body: bodyReference === undefined ? notProvided() : available({ module, node: bodyReference }),
        classParameters: available([]), advertisedParameters: [{ signature: advertised, parameters: available(parameters) }],
        bodyParameters: available(parameters), captures: available([]),
      });
    }
    captureFacts(scope);
    if (scope.meter.refusal !== null) break;
    if (kind === "KindCallExpression") {
      const call = captureCall(scope, node, reference);
      if (call === null) break;
      calls.push(call);
    }
  }
  const core: RawCoreCapture[] = [];
  for (const [node, id] of ownNodes) {
    if (!admit(scope, "facts")) break;
    const row = coreFacts({ module, node: id }, scope.emptyCoreInventory);
    const passing = ast.kindName(node) === "KindParameter" ? declarationPassing(scope, node) : undefined;
    core.push(passing === undefined ? row : { ...row, argumentPassing: available(passing) });
  }
  const exports: RawModuleExport[] = [];
  const moduleSymbol = scope.meter.refusal === null ? scope.checker.getSymbolAtLocation(file) : undefined;
  exported: for (const exported of moduleSymbol === undefined ? [] : scope.checker.getExportsOfModule(moduleSymbol)) {
    if (exported === undefined) continue;
    for (const declaration of scope.checker.getSymbolDeclarations(exported)) {
      const target = declaration === undefined ? null : referenceTo(scope, program, declaration);
      if (scope.meter.refusal !== null) break exported;
      if (target === null) continue;
      if (!admit(scope, "edges")) break exported;
      exports.push({ name: scope.checker.getSymbolName(exported), declaration: target, module: target.module });
    }
  }
  // A capture that met a limit returns its refusal and nothing of what it read.
  if (scope.meter.refusal !== null) return { kind: "refused", diagnostics: captureRefusal(scope.meter.refusal, checkerDiagnostics) };
  const raw: RawModule = {
    module, tree,
    types: { types: scope.tables.types, components: scope.tables.components, signatures: scope.tables.signatures, members: scope.tables.members,
      symbols: scope.tables.symbols, candidates: scope.tables.candidates, dataLayouts: [], memoryLayouts: [], memoryFields: [] },
    checkerViews: views, calls, callableAssociations: associations, providerDeclarations: [], references, links, exports, bindings,
    implementations: [], heritage: [], constructors: [], enums: [], propertyNames: [], memberUses: [], protocols: [], storage: [], core,
    checkerDiagnostics, diagnosticCoverage,
  };
  return { kind: "ok", value: raw, diagnostics: checkerDiagnostics };
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
