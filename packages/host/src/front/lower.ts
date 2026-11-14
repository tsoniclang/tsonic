import type { InvariantFailure, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, NodeId, RawSignatureId, RawTypeId, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import { candidateListId, encodeBodyId, localId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { SignatureParameter, TypeTerm } from "../ir-types/contract.js";
import { internSignature, internType } from "../ir-types/index.js";
import type { PassingMode } from "../ir-types/contract.js";
import type { ConvertedCheckedType, LowerDeps, ModuleDefinitions, ModuleExports, RawBindingTarget, RawCallSelection, RawCallableAssociation, RawCheckerViews, RawCoreCapture, RawFact, RawModule, RawModuleLink, RawStorageCapture } from "./contract.js";
import { moduleIdentities } from "./identities.js";
import { lowerBindingFact, lowerBindings } from "./bindings.js";
import { lowerExportDeclaration } from "./lower-exports.js";

type Syntax = Hir.SyntaxPhase;
type Checked = Hir.CheckedPhase;

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });

/**
 * The syntax kinds whose checked annotation is written, and the forms of them it covers: the development frontier
 * of lowering, in one place. A module holding any other kind, or a written kind in another form, is refused by the
 * one check below with a compiler-defect TypeError; no partial HIR is returned.
 */
const writtenKinds: readonly string[] = ["SourceFile", "EndOfFile", "ExportKeyword", "FunctionDeclaration", "Parameter",
  "Identifier", "NumberKeyword", "StringKeyword", "BooleanKeyword", "Block", "ReturnStatement", "BinaryExpression", "PlusToken", "CallExpression", "ExpressionStatement", "ParenthesizedExpression",
  "ExportDeclaration", "NamedExports", "ExportSpecifier", "NamespaceExport", "StringLiteral"];

function unwrittenForm(node: Hir.SyntaxNode<Syntax>): string | null {
  if (!writtenKinds.includes(node.kind)) return node.kind;
  switch (node.kind) {
    case "FunctionDeclaration":
      return node.body === null ? "FunctionDeclaration without a body" : node.typeParameters !== null ? "FunctionDeclaration with type parameters" : null;
    case "Parameter":
      return node.questionToken !== null ? "optional Parameter"
        : node.dotDotDotToken !== null ? "rest Parameter" : null;
    case "CallExpression":
      return node.typeArguments !== null ? "CallExpression with type arguments" : node.questionDotToken !== null ? "optional CallExpression" : null;
    case "ExportDeclaration": return node.attributes !== null ? "ExportDeclaration with attributes"
      : node.moduleSpecifier !== null && node.moduleSpecifier.kind !== "StringLiteral" ? "ExportDeclaration with nonliteral module specifier" : null;
    default: return null;
  }
}

/** The one check of lowering's development frontier; it names the first unwritten form in preorder. */
function refuseUnwritten(tree: Hir.SyntaxNode<Syntax>): void {
  const pending: Hir.SyntaxNode<Syntax>[] = [tree];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const form = unwrittenForm(next);
    if (form !== null) throw new TypeError(`front: checked annotation not implemented: ${form}`);
    pending.push(...[...childrenOfSyntax(next)].reverse());
  }
}

/**
 * One raw fact as HIR's captured fact (K-3340): availability and the reason are kept as captured, each of capture's
 * reasons having its own arm in HIR's captured fact (missing evidence included), never turned into another reason.
 */
function capturedFact<Raw, Value>(raw: RawFact<Raw>, convert: (value: Raw) => Value): Hir.CapturedFact<Value> {
  return raw.kind === "available" ? { kind: "available", value: convert(raw.value) } : { kind: "unavailable", reason: raw.reason };
}

/** A fact whose present value this lowering does not convert yet: a proven absence is kept, a present value is a named frontier. */
function absenceOnly<Value>(name: string): (value: Value | null) => null {
  return value => {
    if (value !== null) throw new TypeError(`front: the lowering of a present fact (${name}) is not implemented`);
    return null;
  };
}

/**
 * A node's core facts as capture supplied them (K-3313.2, K-3340): a proven absence stays a proven absence, an
 * unavailable fact keeps its reason. A present fact is a development frontier of this lowering, refused by name.
 */
function coreOf(lowering: Lowering, node: NodeId): Hir.HirCoreCapture {
  const raw = lowering.core.get(node);
  if (raw === undefined) return throwInvariant(invariant("A node of a lowered module has no captured core facts."));
  const markers = capturedFact(raw.markers, (value): Hir.HirMarkersCapture => {
    if (value.struct !== null || value.field !== null || value.defaultValue !== null || value.jsString) throw new TypeError("front: the lowering of a present fact (markers) is not implemented");
    return { struct: null, field: null, defaultValue: null, jsString: false };
  });
  const argumentPassing = capturedFact(raw.argumentPassing, (value): Hir.HirArgumentPassingCapture | null => {
    if (value === null) return null;
    if (value.role !== "declaration") throw new TypeError("front: the lowering of a present fact (argument passing of an argument) is not implemented");
    return { role: "declaration", mode: value.mode };
  });
  return {
    provider: capturedFact(raw.provider, absenceOnly("provider")), markers,
    pointerType: capturedFact(raw.pointerType, absenceOnly("pointer type")),
    pointerOperation: capturedFact(raw.pointerOperation, absenceOnly("pointer operation")),
    fieldBinding: capturedFact(raw.fieldBinding, absenceOnly("field binding")),
    recordBinding: capturedFact(raw.recordBinding, absenceOnly("record binding")),
    attribute: capturedFact(raw.attribute, absenceOnly("attribute")), safety: capturedFact(raw.safety, absenceOnly("safety")),
    argumentPassing, flowState: capturedFact(raw.flowState, absenceOnly("flow state")),
  };
}

/** A node's memory fact: its captured memory metadata (K-3340), joined once per node with the core facts. */
function memoryOf(lowering: Lowering, node: NodeId): Hir.CapturedFact<Hir.HirMemoryLayoutCapture | Hir.HirMemoryFieldCapture | null> {
  const raw = lowering.core.get(node);
  if (raw === undefined) return throwInvariant(invariant("A node of a lowered module has no captured core facts."));
  return capturedFact(raw.metadata, absenceOnly("memory metadata"));
}

/**
 * A parameter's passing mode, from its captured declaration fact: a declared mode is used as captured; a proven absence
 * of any passing marker selects native by-value, once, here; a fact not provided is refused by name, never defaulted.
 */
function passingOf(lowering: Lowering, parameter: NodeId): PassingMode {
  const fact = coreOf(lowering, parameter).argumentPassing;
  if (fact.kind === "unavailable") throw new TypeError("front: a parameter whose passing mode is not proven is not implemented (the selected inventory offers core facts that capture does not answer yet)");
  return fact.value === null ? "by-value" : fact.value.mode;
}

/**
 * A checker type as a canonical type. The forms converted so far are the scalar ones: \`number\` is the native
 * \`float64\` with the source category \`number\` kept in its evidence; \`string\`; \`boolean\` as \`bool\`; \`bigint\`,
 * \`any\`, \`unknown\` and \`never\` as intrinsics. Memberless callable inventories retain their actual signatures.
 */
function convertRawType(lowering: Lowering, type: RawTypeId): ConvertedCheckedType {
  const known = lowering.convertedTypes.get(type);
  if (known !== undefined) return known;
  convertDependencies(lowering, { kind: "type", id: type, ready: false });
  return lowering.convertedTypes.get(type) ?? throwInvariant(invariant("A type conversion produced no converted type."));
}

function signatureOf(lowering: Lowering, id: RawSignatureId): SigId {
  const known = lowering.convertedSignatures.get(id);
  if (known !== undefined) return known;
  convertDependencies(lowering, { kind: "signature", id, ready: false });
  return lowering.convertedSignatures.get(id) ?? throwInvariant(invariant("A signature conversion produced no converted signature."));
}

function convertDependencies(lowering: Lowering, first: ConversionTask): void {
  const pending: ConversionTask[] = [first];
  const activeTypes = new Set<RawTypeId>();
  const activeSignatures = new Set<RawSignatureId>();
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next.kind === "type") {
      if (lowering.convertedTypes.has(next.id)) continue;
      if (next.ready) {
        finishType(lowering, next.id);
        activeTypes.delete(next.id);
        continue;
      }
      if (activeTypes.has(next.id)) throw new TypeError("front: recursive callable type conversion is not implemented");
      activeTypes.add(next.id);
      const row = lowering.raw.types.types[next.id];
      if (row === undefined || row.form.kind !== "available") return throwInvariant(invariant("A raw type has no captured form."));
      pending.push({ ...next, ready: true });
      if (row.form.value.kind === "structure") {
        const inventory = lowering.raw.types.members[row.form.value.inventory];
        if (inventory === undefined) return throwInvariant(invariant("A callable type has no captured member inventory."));
        for (const id of [...inventory.calls, ...inventory.constructs].reverse()) pending.push({ kind: "signature", id, ready: false });
      }
    } else {
      if (lowering.convertedSignatures.has(next.id)) continue;
      if (next.ready) {
        finishSignature(lowering, next.id);
        activeSignatures.delete(next.id);
        continue;
      }
      if (activeSignatures.has(next.id)) throw new TypeError("front: recursive callable signature conversion is not implemented");
      activeSignatures.add(next.id);
      const signature = lowering.raw.types.signatures[next.id];
      if (signature === undefined) return throwInvariant(invariant("A callable inventory names no captured signature."));
      if (signature.result.kind !== "available") throw new TypeError("front: unavailable callable result conversion is not implemented");
      pending.push({ ...next, ready: true });
      pending.push({ kind: "type", id: signature.result.value, ready: false });
      for (const parameter of [...signature.parameters].reverse()) pending.push({ kind: "type", id: parameter.type, ready: false });
    }
  }
}

type ConversionTask =
  | { readonly kind: "type"; readonly id: RawTypeId; readonly ready: boolean }
  | { readonly kind: "signature"; readonly id: RawSignatureId; readonly ready: boolean };

function finishType(lowering: Lowering, type: RawTypeId): void {
  const { deps, raw } = lowering;
  const row = raw.types.types[type];
  if (row === undefined) return throwInvariant(invariant("A raw type identity names no row of its module's type table."));
  const component = raw.types.components[row.component];
  if (component === undefined || row.form.kind !== "available")
    return throwInvariant(invariant("A raw type row lacks the form or position capture gave it."));
  const form = row.form.value;
  const scalar = form.kind === "scalar" ? form.scalar : null;
  let term: TypeTerm;
  if (form.kind === "structure") {
    const inventory = raw.types.members[form.inventory];
    if (inventory === undefined) return throwInvariant(invariant("A callable type has no captured member inventory."));
    if (inventory.members.length !== 0 || inventory.indexes.length !== 0)
      throw new TypeError("front: the conversion of callable members is not implemented");
    const signatureOf = (signature: RawSignatureId): SigId => lowering.convertedSignatures.get(signature)
      ?? throwInvariant(invariant("A callable dependency has not been converted."));
    term = { kind: "callable", calls: inventory.calls.map(signatureOf), constructs: inventory.constructs.map(signatureOf) };
  } else if (scalar === "number") term = { kind: "primitive", primitive: "float64" };
  else if (scalar === "string") term = { kind: "string" };
  else if (scalar === "boolean") term = { kind: "primitive", primitive: "bool" };
  else if (scalar === "bigint" || scalar === "any" || scalar === "unknown" || scalar === "never") term = { kind: "intrinsic", intrinsic: scalar };
  else throw new TypeError(`front: the conversion of the checker type form ${form.kind} is not implemented`);
  const category = scalar === "number" ? "number" : scalar === "string" ? "string" : scalar === "boolean" ? "boolean" : scalar === "bigint" ? "bigint" : null;
  const id = internType(deps.types, term);
  const converted: ConvertedCheckedType = { type: id, evidence: {
    type: id, component: { kind: "body", value: {
      body: lowering.bodyOf.get(component.root.node) ?? throwInvariant(invariant("A type component lies in no body.")), node: component.root.node } },
    category: category === null ? { kind: "dynamic" } : { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null } };
  lowering.convertedTypes.set(type, converted);
}

function finishSignature(lowering: Lowering, id: RawSignatureId): void {
  const signature = lowering.raw.types.signatures[id];
  if (signature === undefined) return throwInvariant(invariant("A callable inventory names no captured signature."));
  if (signature.typeParameters.kind !== "available" || signature.typeParameters.value.length !== 0 || signature.receiver.kind !== "available" || signature.receiver.value !== null)
    throw new TypeError("front: generic or receiver-bearing callable type conversion is not implemented");
  if (signature.composition !== null) throw new TypeError("front: composed callable signature conversion is not implemented");
  if (signature.result.kind !== "available") throw new TypeError("front: unavailable callable result conversion is not implemented");
  const declaration = signature.declaration;
  if (declaration === null) throw new TypeError("front: declarationless callable signature conversion is not implemented");
  const definition = lowering.deps.definitionOf(declaration);
  const convertedType = (type: RawTypeId): TyId => lowering.convertedTypes.get(type)?.type
    ?? throwInvariant(invariant("A signature dependency has not been converted."));
  const parameters = signature.parameters.map((parameter): SignatureParameter => {
    const declared = parameter.declaration;
    if (declared === null || declared.module !== lowering.raw.module)
      throw new TypeError("front: external or declarationless callable parameter conversion is not implemented");
    if (parameter.initializer !== null && parameter.initializer.module !== lowering.raw.module)
      throw new TypeError("front: an external callable default initializer conversion is not implemented");
    if (parameter.initializer === null && (parameter.kind !== "required" || parameter.acceptsOmission))
      throw new TypeError("front: non-required callable parameter conversion is not implemented");
    const parameterDefinition = lowering.deps.definitionOf(declared);
    return { declaration: parameterDefinition, kind: parameter.initializer === null ? "required" : "default",
      type: convertedType(parameter.type), passing: passingOf(lowering, declared.node),
      initializer: parameter.initializer === null ? null : encodeBodyId({ owner: parameterDefinition, role: "default-argument", ordinal: 0 }) };
  });
  const converted = internSignature(lowering.deps.types, { declaration: definition,
    owner: { kind: "item", value: { owner: definition, node: declaration.node } }, composition: null,
    kind: signature.kind, typeParameters: [], receiver: null, parameters, result: convertedType(signature.result.value) });
  lowering.convertedSignatures.set(id, converted);
}

/** The definition identities of one module, read from its raw tree alone. */
export function lowerDefinitions(raw: RawModule): Result<ModuleDefinitions> {
  return { kind: "ok", diagnostics: [], value: moduleIdentities(raw.module, raw.tree) };
}

/** The export entries of one module: per exported name its declaration group, in canonical declaration order. */
export function lowerExports(deps: LowerDeps, raw: RawModule): Result<ModuleExports> {
  return { kind: "ok", diagnostics: [], value: lowerBindings(deps, raw) };
}

interface Lowering {
  readonly deps: LowerDeps;
  readonly raw: RawModule;
  readonly definitionAt: ReadonlyMap<NodeId, DefId>;
  readonly views: ReadonlyMap<NodeId, RawCheckerViews>;
  readonly references: ReadonlyMap<NodeId, RawFact<RawBindingTarget>>;
  readonly links: ReadonlyMap<NodeId, RawModuleLink>;
  readonly locals: Map<NodeId, LocalRef>;
  readonly associations: ReadonlyMap<NodeId, RawCallableAssociation>;
  readonly authoredTypes: ReadonlyMap<NodeId, RawTypeId>;
  readonly bodies: Hir.HirBody[];
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly captureParent: ReadonlyMap<BodyId, BodyId>;
  readonly captures: Map<BodyId, LocalRef[]>;
  readonly core: ReadonlyMap<NodeId, RawCoreCapture>;
  readonly storage: ReadonlyMap<NodeId, RawStorageCapture>;
  readonly convertedTypes: Map<RawTypeId, ConvertedCheckedType>;
  readonly convertedSignatures: Map<RawSignatureId, SigId>;
  readonly calls: ReadonlyMap<NodeId, RawCallSelection>;
  readonly candidateLists: Map<BodyId, Hir.HirCandidateList[]>;
}

interface NodeBodies {
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly captureParent: ReadonlyMap<BodyId, BodyId>;
  /** The bodies each body directly encloses, in preorder of their roots. */
  readonly children: ReadonlyMap<BodyId, readonly BodyId[]>;
}

function nodeBodies(tree: Hir.SourceFile<Syntax>, moduleBody: BodyId, definitionAt: ReadonlyMap<NodeId, DefId>): NodeBodies {
  const bodies = new Map<NodeId, BodyId>();
  const captureParent = new Map<BodyId, BodyId>();
  const children = new Map<BodyId, BodyId[]>();
  const visit = (node: Hir.SyntaxNode<Syntax>, body: BodyId, callableBody: BodyId | null): void => {
    bodies.set(node.id, body);
    const register = (inner: BodyId, captureOwner: BodyId, syntaxOwner: BodyId): void => {
      captureParent.set(inner, captureOwner);
      const siblings = children.get(syntaxOwner) ?? [];
      siblings.push(inner);
      children.set(syntaxOwner, siblings);
    };
    if (node.kind === "FunctionDeclaration") {
      const definition = definitionAt.get(node.id) ?? throwInvariant(invariant("A function has no checked definition identity."));
      const inner = encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
      for (const child of childrenOfSyntax(node)) {
        if (child === node.body) register(inner, body, body);
        visit(child, child === node.body ? inner : body, inner);
      }
    } else if (node.kind === "Parameter" && node.initializer !== null) {
      const definition = definitionAt.get(node.id) ?? throwInvariant(invariant("A default parameter has no checked definition identity."));
      if (callableBody === null) return throwInvariant(invariant("A default parameter has no enclosing callable execution."));
      const inner = encodeBodyId({ owner: definition, role: "default-argument", ordinal: 0 });
      register(inner, callableBody, body);
      for (const child of childrenOfSyntax(node)) visit(child, child === node.initializer ? inner : body, callableBody);
    } else for (const child of childrenOfSyntax(node)) visit(child, body, callableBody);
  };
  visit(tree, moduleBody, null);
  return { bodyOf: bodies, captureParent, children };
}

function headerOf<P extends Hir.Phase>(node: Hir.NodeHeader): Hir.NodeHeader & Record<never, P> {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

function typeOf(lowering: Lowering, type: RawTypeId): TyId {
  return convertRawType(lowering, type).type;
}

/**
 * K-3313.1, the one declaration-target law: a parameter, a local variable or a binding element of a function body
 * targets its body-local slot (registered in `locals` by its body); every other declaration (module and static
 * declarations, nested functions) targets its definition. The qualified definition identity of a body-local
 * declaration stays its item identity, separate from its target.
 */
function targetOf(lowering: Lowering, declaration: NodeId): { readonly kind: "local"; readonly local: LocalRef } | { readonly kind: "definition"; readonly definition: DefId } {
  const local = lowering.locals.get(declaration);
  return local !== undefined ? { kind: "local", local } : { kind: "definition", definition: definitionOf(lowering, declaration) };
}

/**
 * A use resolves to the target of the declaration it names. A use of an outer body's local is a capture: it resolves
 * to the owner's local, and every body between the use and the owner records it once, in order of first use.
 */
function resolutionOf(lowering: Lowering, use: NodeId, raw: RawFact<RawBindingTarget> | undefined): Hir.HirResolution {
  if (raw === undefined) return { kind: "unavailable", reason: "incomplete-association" };
  const first = raw.kind === "available" && raw.value.kind === "declarations" && raw.value.declarations.length === 1 ? raw.value.declarations[0] : undefined;
  const local = first !== undefined && first.module === lowering.raw.module ? lowering.locals.get(first.node) : undefined;
  if (local === undefined) {
    const target = lowerBindingFact(lowering.deps, raw);
    return target.kind === "available" ? target.value : target;
  }
  for (let body = lowering.bodyOf.get(use); body !== undefined && body !== local.body; body = lowering.captureParent.get(body)) {
    const recorded = lowering.captures.get(body) ?? [];
    if (!recorded.some(entry => entry.body === local.body && entry.local === local.local)) recorded.push(local);
    lowering.captures.set(body, recorded);
  }
  return { kind: "local", local };
}

function definitionOf(lowering: Lowering, node: NodeId): DefId {
  const definition = lowering.definitionAt.get(node);
  return definition ?? throwInvariant(invariant("A declaration node of a written kind has no definition identity."));
}

/**
 * An expression's checked value (K-3340): each view as captured (availability and reason kept), its storage place from
 * its storage row (no row: not provided, never a proven absence), its memory and layout observation from its core facts.
 */
function valueOf(lowering: Lowering, node: NodeId): Hir.CheckedValue {
  const views = lowering.views.get(node);
  const core = lowering.core.get(node);
  if (views === undefined || core === undefined) return throwInvariant(invariant("An expression of a written kind has no checker views or core facts."));
  const optionalType = (type: RawTypeId | null): TyId | null => type === null ? null : typeOf(lowering, type);
  const storage = lowering.storage.get(node);
  return {
    views: { read: capturedFact(views.read, type => typeOf(lowering, type)), declared: capturedFact(views.declared, optionalType),
      contextual: capturedFact(views.contextual, optionalType) },
    place: storage === undefined ? { kind: "unavailable", reason: "not-provided" } : capturedFact(storage.fact, absenceOnly("storage place")),
    memory: memoryOf(lowering, node), observation: capturedFact(core.layoutQuery, absenceOnly("layout query")),
  };
}

function token<K extends Hir.TokenSyntaxKind>(node: Hir.Token<Syntax, K>): Hir.Token<Checked, K> {
  return { ...headerOf(node), kind: node.kind, tsonic: null };
}

/** An authored annotation: its type is the one capture read from the checker for that type node. */
function typeNode(lowering: Lowering, node: Hir.TypeNode<Syntax>): { readonly node: Hir.TypeNode<Checked>; readonly type: TyId } {
  if (node.kind !== "NumberKeyword" && node.kind !== "StringKeyword" && node.kind !== "BooleanKeyword")
    return throwInvariant(invariant("A type node of an unwritten kind passed the written-kinds check."));
  const raw = lowering.authoredTypes.get(node.id);
  if (raw === undefined) return throwInvariant(invariant("An authored type annotation has no captured checker type."));
  const type = typeOf(lowering, raw);
  return { node: { ...headerOf(node), kind: node.kind, tsonic: { core: coreOf(lowering, node.id), type: { kind: "available", value: type }, referencedDefinitions: [] } }, type };
}

function expression(lowering: Lowering, node: Hir.Expression<Syntax>): Hir.Expression<Checked> {
  switch (node.kind) {
    case "ParenthesizedExpression":
      return { ...headerOf(node), kind: "ParenthesizedExpression", expression: expression(lowering, node.expression),
        tsonic: { core: coreOf(lowering, node.id), ...valueOf(lowering, node.id) } };
    case "Identifier": {
      const resolution = resolutionOf(lowering, node.id, lowering.references.get(node.id));
      return { ...headerOf(node), kind: "Identifier", text: node.text, tsonic: { core: coreOf(lowering, node.id), role: "value", value: valueOf(lowering, node.id), resolution } };
    }
    case "BinaryExpression":
      if (node.operatorToken.kind !== "PlusToken") return throwInvariant(invariant("A binary operator of an unwritten kind passed the written-kinds check."));
      return { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left: expression(lowering, node.left), type: null,
        operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
        tsonic: { core: coreOf(lowering, node.id), role: "arithmetic", value: valueOf(lowering, node.id) } };
    case "CallExpression":
      return { ...headerOf(node), kind: "CallExpression", expression: expression(lowering, node.expression), questionDotToken: null, typeArguments: null,
        arguments: { loc: node.arguments.loc, nodes: node.arguments.nodes.map(argument => expression(lowering, argument)) },
        tsonic: { core: coreOf(lowering, node.id), ...valueOf(lowering, node.id), application: { kind: "available", value: applicationOf(lowering, node) } } };
    default: return throwInvariant(invariant("An expression of an unwritten kind passed the written-kinds check."));
  }
}

function applicationOf(lowering: Lowering, node: Hir.CallExpression<Syntax>): Hir.HirApplication {
  const call = lowering.calls.get(node.id);
  if (call === undefined || call.kind !== "applicable") return throwInvariant(invariant("A lowered call has no captured applicable selection."));
  const captured = lowering.raw.types.candidates[call.candidates];
  if (captured === undefined) return throwInvariant(invariant("A lowered call has no captured candidate list."));
  const declarationOrder = call.declarationOrder;
  if (declarationOrder.kind !== "available" || declarationOrder.value.length !== 1 || captured.candidates.length !== 1)
    throw new TypeError("front: complete applicable candidate conversion is not implemented without a proven singleton declaration order");
  const body = lowering.bodyOf.get(node.id);
  if (body === undefined) return throwInvariant(invariant("A lowered call belongs to no body."));
  const lists = lowering.candidateLists.get(body) ?? [];
  const id = candidateListId(lists.length);
  const candidates = captured.candidates.map((candidate): Hir.HirCandidate => {
    if (candidate.ordinal !== 0 || candidate.application.signature !== declarationOrder.value[0])
      return throwInvariant(invariant("The singleton call candidate is not its captured declaration-order signature."));
    if (candidate.application.classArguments.length !== 0 || candidate.application.signatureArguments.length !== 0 || candidate.application.receiver !== null)
      throw new TypeError("front: nonempty call candidate binding conversion is not implemented");
    if (candidate.constraints.length !== 0 || candidate.diagnostics.length !== 0 || candidate.diagnosticCoverage.length !== 0)
      throw new TypeError("front: call candidate conditional failure conversion is not implemented");
    const signature = lowering.raw.types.signatures[candidate.application.signature];
    if (signature?.declaration === null || signature === undefined) return throwInvariant(invariant("A call candidate has no actual declaration."));
    if (candidate.inferenceContributions.kind !== "available" || candidate.inferenceContributions.value.length !== 0)
      throw new TypeError("front: unavailable or nonempty call inference contribution conversion is not implemented");
    return { ordinal: candidate.ordinal, declaration: lowering.deps.definitionOf(signature.declaration),
      appliedSignature: { kind: "available", value: signatureOf(lowering, signature.id) },
      bindings: { kind: "available", value: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } },
      conditionalFailure: { kind: "available", value: null }, contributions: [] };
  });
  const selected = candidates.find(candidate => candidate.ordinal === call.selectedOrdinal);
  if (selected === undefined || selected.appliedSignature.kind !== "available") return throwInvariant(invariant("A call selection names no converted candidate."));
  lists.push({ id, candidates });
  lowering.candidateLists.set(body, lists);
  return { kind: "call", receiver: null, arguments: node.arguments.nodes.map(argument => ({ kind: "value", expression: argument.id })),
    typeArguments: [], candidates: { kind: "available", value: id }, resolvedSignature: { kind: "available", value: selected.appliedSignature.value } };
}

function statement(lowering: Lowering, node: Hir.Statement<Syntax>, owner: DefId): Hir.Statement<Checked> {
  switch (node.kind) {
    case "ReturnStatement":
      return { ...headerOf(node), kind: "ReturnStatement", expression: node.expression === null ? null : expression(lowering, node.expression), tsonic: null };
    case "ExpressionStatement":
      return { ...headerOf(node), kind: "ExpressionStatement", expression: expression(lowering, node.expression), tsonic: null };
    case "Block": return block(lowering, node, owner);
    case "FunctionDeclaration": return functionDeclaration(lowering, node, owner);
    case "ExportDeclaration": return lowerExportDeclaration({
      core: node => coreOf(lowering, node), memory: node => memoryOf(lowering, node), definition: node => definitionOf(lowering, node),
      binding: node => lowering.deps.bindingOccurrenceOf({ module: lowering.raw.module, node })
        ?? throwInvariant(invariant("A checked binding syntax requires its actual B1 occurrence.")),
      target: node => {
        const link = lowering.links.get(node);
        if (link === undefined || link.resolution.kind === "unresolved") return { kind: "unavailable", reason: "incomplete-association" };
        return { kind: "available", value: link.resolution.kind === "project" ? { target: "project", module: link.resolution.module }
          : { target: "library", module: link.resolution.module } };
      },
    }, node, owner);
    default: return throwInvariant(invariant("A statement of an unwritten kind passed the written-kinds check."));
  }
}

function block(lowering: Lowering, node: Hir.Block<Syntax>, owner: DefId): Hir.Block<Checked> {
  return { ...headerOf(node), kind: "Block", statements: { loc: node.statements.loc, nodes: node.statements.nodes.map(child => statement(lowering, child, owner)) },
    multiLine: node.multiLine, tsonic: null };
}

function modifiers(node: Hir.ModifierList<Syntax> | null): Hir.ModifierList<Checked> | null {
  if (node === null) return null;
  return { loc: node.loc, nodes: node.nodes.map(modifier => modifier.kind === "ExportKeyword" ? token(modifier)
    : throwInvariant(invariant("A modifier of an unwritten kind passed the written-kinds check."))) };
}

function functionDeclaration(lowering: Lowering, node: Hir.FunctionDeclaration<Syntax>, owner: DefId): Hir.FunctionDeclaration<Checked> {
  const definition = definitionOf(lowering, node.id);
  const bodyNode = node.body;
  if (bodyNode === null || bodyNode.kind !== "Block") return throwInvariant(invariant("A function of a written form has no block body."));
  const body = encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  // The checked signature: the checker's own parameter and result types from capture's signature row, never another slot's.
  const association = lowering.associations.get(node.id);
  const advertised = association?.advertised[0];
  const rawSignature = advertised === undefined ? undefined : lowering.raw.types.signatures[advertised];
  if (association === undefined || association.advertised.length !== 1 || rawSignature === undefined)
    return throwInvariant(invariant("A function of a written form has no captured signature."));
  // An explicit this receiver is not an ordinary parameter (K-3361): its lowering is outside the written slice.
  if (rawSignature.receiver.kind !== "available" || rawSignature.receiver.value !== null)
    throw new TypeError("front: a function with an explicit this receiver, or whose receiver is not captured, is not implemented");
  if (rawSignature.parameters.length !== node.parameters.nodes.length)
    return throwInvariant(invariant("A function of a written form has no captured signature with one row per parameter."));
  if (rawSignature.result.kind !== "available") throw new TypeError("front: a function whose checked result type is not captured is not implemented");
  // The body's locals: its parameters, in declaration order (local variables and binding elements join when written).
  const signatureParameters = node.parameters.nodes.map((parameter, index) => {
    lowering.locals.set(parameter.id, { body, local: localId(index) });
    return parameter;
  });
  const parameters = signatureParameters.map((parameter, index) => {
    const parameterDefinition = definitionOf(lowering, parameter.id);
    const declared = parameter.type === null ? null : typeNode(lowering, parameter.type);
    const declaredType = declared === null ? null : declared.type;
    const checkedParameter = rawSignature.parameters[index];
    if (checkedParameter === undefined) return throwInvariant(invariant("A parameter has no row of its captured signature."));
    const checkedType = typeOf(lowering, checkedParameter.type);
    const initializerBody = parameter.initializer === null ? null : encodeBodyId({ owner: parameterDefinition, role: "default-argument", ordinal: 0 });
    const initializer = parameter.initializer === null ? null : expression(lowering, parameter.initializer);
    if (initializerBody !== null && initializer !== null) lowering.bodies.push({
      body: initializerBody, owner: parameterDefinition, params: [], locals: [], root: initializer, captures: [], scopes: [],
      asynchronous: false, generator: false, candidateLists: lowering.candidateLists.get(initializerBody) ?? [], nestedBodies: [],
    });
    if (parameter.name.kind !== "Identifier") return throwInvariant(invariant("A parameter of a written form has no identifier name."));
    const target = targetOf(lowering, parameter.id);
    const lowered: Hir.ParameterDeclaration<Checked> = { ...headerOf(parameter), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      name: { ...headerOf(parameter.name), kind: "Identifier", text: parameter.name.text, tsonic: { core: coreOf(lowering, parameter.name.id), role: "declaration-name", declaration: target } },
      questionToken: null, type: declared === null ? null : declared.node, initializer,
      tsonic: { core: coreOf(lowering, parameter.id), parent: definition, attributes: [], memory: memoryOf(lowering, parameter.id), declaration: target,
        declaredType: { kind: "available", value: declaredType }, initializer: initializerBody } };
    return { lowered, definition: parameterDefinition, checkedType, passing: passingOf(lowering, parameter.id), initializer: initializerBody };
  });
  const returnType = node.type === null ? null : typeNode(lowering, node.type).node;
  const item = (target: NodeId, itemOwner: DefId): SourceNodeRef => ({ kind: "item", value: { owner: itemOwner, node: target } });
  const signature = signatureOf(lowering, rawSignature.id);
  const loweredBody = block(lowering, bodyNode, definition);
  lowering.bodies.push({
    body, owner: definition,
    params: parameters.map((parameter, index) => ({ local: localId(index), declaration: parameter.definition,
      role: parameter.initializer === null ? "required" : "default", passing: parameter.passing, initializer: parameter.initializer })),
    locals: parameters.map((parameter, index) => ({ id: localId(index), declaration: item(parameter.lowered.id, parameter.definition),
      name: parameter.lowered.name.kind === "Identifier" ? parameter.lowered.name.text : "", role: "parameter",
      checkerSlot: { kind: "available", value: parameter.checkedType }, capturedFrom: null, mutable: true })),
    root: loweredBody, captures: [], scopes: [], asynchronous: false, generator: false, candidateLists: lowering.candidateLists.get(body) ?? [], nestedBodies: [],
  });
  const name = node.name;
  return { ...headerOf(node), kind: "FunctionDeclaration", modifiers: modifiers(node.modifiers), typeParameters: null,
    parameters: { loc: node.parameters.loc, nodes: parameters.map(parameter => parameter.lowered) }, type: returnType, fullSignature: null, asteriskToken: null,
    body: loweredBody,
    name: name === null ? null : { ...headerOf(name), kind: "Identifier", text: name.text, tsonic: { core: coreOf(lowering, name.id), role: "declaration-name", declaration: targetOf(lowering, node.id) } },
    tsonic: { core: coreOf(lowering, node.id), parent: owner, attributes: [], memory: memoryOf(lowering, node.id), definition, parameters: [],
      // One API body endpoint with its real body: a written function is not overloaded (an overload family is refused
      // by the written-kinds check, as a FunctionDeclaration without a body), so it has no advertised row (K-3312.1).
      signatures: [{ declaration: definition, role: "api-body", signature, body }], body } };
}

/**
 * The checked module of one raw capture. The written kinds and forms are the only ones lowered; a module holding
 * any other is refused at once by the one check of the development frontier.
 */
function referenceTargets(raw: RawModule): ReadonlyMap<NodeId, RawFact<RawBindingTarget>> {
  const references = new Map<NodeId, RawFact<RawBindingTarget>>();
  for (const reference of raw.references) {
    if (reference.occurrence.module !== raw.module || references.has(reference.occurrence.node))
      return throwInvariant(invariant("Each use must retain one complete captured target in its actual module."));
    references.set(reference.occurrence.node, reference.target);
  }
  return references;
}

function moduleLinks(raw: RawModule): ReadonlyMap<NodeId, RawModuleLink> {
  const links = new Map<NodeId, RawModuleLink>();
  for (const link of raw.links) {
    if (link.specifier.module !== raw.module || links.has(link.specifier.node))
      return throwInvariant(invariant("Each module specifier must retain one actual captured module-link row."));
    links.set(link.specifier.node, link);
  }
  return links;
}

export function lowerRawModule(deps: LowerDeps, raw: RawModule): Result<Hir.HirModule> {
  refuseUnwritten(raw.tree);
  const exported = deps.exportsOf(raw.module);
  if (exported === null || exported.module !== raw.module)
    return throwInvariant(invariant("Checked lowering requires the actual completed B1 module export and binding inventory."));
  const rows = moduleIdentities(raw.module, raw.tree).rows;
  const definitionAt = new Map<NodeId, DefId>(rows.map(row => [row.node, deps.definitionOf({ module: raw.module, node: row.node })]));
  const moduleDefinition = definitionAt.get(raw.tree.id) ?? throwInvariant(invariant("A module has no definition identity."));
  const moduleBody: BodyId = encodeBodyId({ owner: moduleDefinition, role: "module", ordinal: 0 });
  const structure = nodeBodies(raw.tree, moduleBody, definitionAt);
  const lowering: Lowering = {
    deps, raw, definitionAt, bodyOf: structure.bodyOf, captureParent: structure.captureParent, captures: new Map(),
    core: new Map(raw.core.filter(entry => entry.node.module === raw.module).map(entry => [entry.node.node, entry])),
    storage: new Map(raw.storage.filter(entry => entry.node.module === raw.module).map(entry => [entry.node.node, entry])),
    views: new Map(raw.checkerViews.filter(view => view.node.module === raw.module).map(view => [view.node.node, view])),
    references: referenceTargets(raw), links: moduleLinks(raw),
    locals: new Map(), bodies: [], convertedTypes: new Map(), convertedSignatures: new Map(),
    calls: new Map(raw.calls.filter(call => call.invocation.module === raw.module).map(call => [call.invocation.node, call])), candidateLists: new Map(),
    associations: new Map(raw.callableAssociations.filter(entry => entry.declaration.module === raw.module).map(entry => [entry.declaration.node, entry])),
    authoredTypes: new Map(raw.types.types.flatMap((row): [NodeId, RawTypeId][] => row.authoredTypeNode !== null && row.authoredTypeNode.module === raw.module ? [[row.authoredTypeNode.node, row.id]] : [])),
  };
  const tree: Hir.SourceFile<Checked> = { ...headerOf(raw.tree), kind: "SourceFile",
    statements: { loc: raw.tree.statements.loc, nodes: raw.tree.statements.nodes.map(child => statement(lowering, child, moduleDefinition)) },
    endOfFileToken: token(raw.tree.endOfFileToken), languageVariant: raw.tree.languageVariant, scriptKind: raw.tree.scriptKind,
    commentDirectives: raw.tree.commentDirectives, pragmas: raw.tree.pragmas, checkJsDirective: raw.tree.checkJsDirective,
    tsonic: { core: coreOf(lowering, raw.tree.id), parent: null, attributes: [], memory: memoryOf(lowering, raw.tree.id), definition: moduleDefinition, body: moduleBody } };
  // Each body's captures, and its nested bodies: the bodies it directly encloses, in preorder, as the body walk recorded them.
  const bodies: Hir.HirBody[] = [{ body: moduleBody, owner: moduleDefinition, params: [], locals: [], root: tree, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: lowering.candidateLists.get(moduleBody) ?? [], nestedBodies: [] }, ...lowering.bodies]
    .map(body => ({ ...body, captures: lowering.captures.get(body.body) ?? [], nestedBodies: structure.children.get(body.body) ?? [] }))
    .sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  const items = rows.filter(row => row.node !== raw.tree.id).map(row => ({ definition: definitionOf(lowering, row.node), node: row.node }))
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  return { kind: "ok", diagnostics: [], value: { module: raw.module, tree, items, bodies, exports: exported.entries, bindings: exported.bindings, checkerDiagnostics: [], obligations: [] } };
}
