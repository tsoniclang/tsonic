import type { InvariantFailure, Result } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, NodeId, RawTypeId, SourceNodeRef, TyId } from "../ids/contract.js";
import { candidateListId, encodeBodyId, localId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { binaryOperatorOf, iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { MemberKey, MemberOrigin, TypePublicationStop } from "../ir-types/contract.js";
import type { PassingMode } from "../ir-types/contract.js";
import type { LowerDeps, ModuleDefinitions, ModuleDefinitionsInput, ModuleExports, RawBindingTarget, RawCallSelection, RawCallableAssociation, RawCheckerViews, RawCoreCapture, RawFact, RawMemberUse, RawModule, RawModuleLink, RawPropertyName, RawStorageCapture } from "./contract.js";
import { moduleIdentities, sourceIdentityName, sourcePropertyNames } from "./identities.js";
import { bindingOccurrence, lowerBindingFact, lowerBindings, lowerMemberKey, lowerMemberOrigin } from "./bindings.js";
import { lowerExportDeclaration } from "./lower-exports.js";
import { childSourceBody, enterSourceBody } from "./source-bodies.js";
import type { SourceBodyScope, SourceBodyTransition } from "./source-bodies.js";
import { lowerImportDeclaration } from "./lower-imports.js";
import { convertRawType, createTypeConversion, signatureOf } from "./type-conversion.js";
import type { ConversionResult, TypeConversion } from "./type-conversion.js";
import { expressionKinds } from "./syntax-capture.js";
import { lowerCheckedAlias, lowerCheckedInterface, lowerCheckedModifiers, lowerCheckedType } from "./checked-declarations.js";
import type { DeclarationLowering } from "./checked-declarations.js";

type Syntax = Hir.SyntaxPhase;
type Checked = Hir.CheckedPhase;

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });

/**
 * The syntax kinds whose checked annotation is written, and the forms of them it covers: the development frontier
 * of lowering, in one place. A module holding any other kind, or a written kind in another form, is refused by the
 * one check below with a compiler-defect TypeError; no partial HIR is returned.
 */
const writtenKinds: readonly string[] = ["SourceFile", "EndOfFile", "ExportKeyword", "FunctionDeclaration", "Parameter",
  "Identifier", "NumberKeyword", "StringKeyword", "BooleanKeyword", "BigIntKeyword", "AnyKeyword", "UnknownKeyword", "NeverKeyword", "ObjectKeyword", "UndefinedKeyword", "VoidKeyword",
  "Block", "ReturnStatement", "ThrowStatement", "IfStatement", "BinaryExpression", "PrefixUnaryExpression", "PlusToken", "EqualsToken", "CallExpression", "ExpressionStatement", "ParenthesizedExpression",
  "EqualsEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsToken", "ExclamationEqualsEqualsToken",
  "ExportDeclaration", "NamedExports", "ExportSpecifier", "NamespaceExport", "StringLiteral", "TrueKeyword", "FalseKeyword", "NullKeyword",
  "ImportDeclaration", "ImportClause", "NamedImports", "ImportSpecifier", "NamespaceImport",
  "VariableStatement", "VariableDeclarationList", "VariableDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "TypeLiteral", "TypeParameter", "PropertySignature",
  "CallSignature", "ConstructSignature", "MethodSignature", "IndexSignature", "GetAccessor", "SetAccessor", "TypeReference", "UnionType", "IntersectionType",
  "SymbolKeyword", "ReadonlyKeyword", "DeclareKeyword", "ComputedPropertyName", "PropertyAccessExpression", "QuestionToken"];

function unwrittenForm(node: Hir.SyntaxNode<Syntax>): string | null {
  if (!writtenKinds.includes(node.kind)) return node.kind;
  switch (node.kind) {
    case "FunctionDeclaration":
      return node.body === null ? "FunctionDeclaration without a body" : node.typeParameters !== null ? "FunctionDeclaration with type parameters" : null;
    case "Parameter": return node.dotDotDotToken !== null ? "rest Parameter" : null;
    case "GetAccessor": case "SetAccessor": return node.body !== null || node.asteriskToken !== null ? `${node.kind} with an execution body or generator marker` : null;
    case "PrefixUnaryExpression": return node.operator === "ExclamationToken" ? null : `PrefixUnaryExpression ${node.operator}`;
    case "VariableDeclaration": return node.name.kind !== "Identifier" ? "pattern VariableDeclaration"
      : node.exclamationToken !== null ? "definite-assignment VariableDeclaration" : null;
    case "CallExpression":
      return node.typeArguments !== null ? "CallExpression with type arguments" : node.questionDotToken !== null ? "optional CallExpression" : null;
    case "ExportDeclaration": return node.attributes !== null ? "ExportDeclaration with attributes"
      : node.moduleSpecifier !== null && node.moduleSpecifier.kind !== "StringLiteral" ? "ExportDeclaration with nonliteral module specifier" : null;
    case "ImportDeclaration": return node.attributes !== null ? "ImportDeclaration with attributes"
      : node.modifiers !== null ? "ImportDeclaration with modifiers"
      : node.moduleSpecifier.kind !== "StringLiteral" ? "ImportDeclaration with nonliteral module specifier" : null;
    default: return null;
  }
}

/** The one check of lowering's development frontier; it names the first unwritten form in preorder. */
function refuseUnwritten(tree: Hir.SyntaxNode<Syntax>): void {
  const pending: Generator<Hir.SyntaxNode<Syntax>, void, undefined>[] = [];
  let next: Hir.SyntaxNode<Syntax> | undefined = tree;
  while (next !== undefined) {
    const form = unwrittenForm(next);
    if (form !== null) throw new TypeError(`front: checked annotation not implemented: ${form}`);
    pending.push(iterateChildrenOfSyntax(next));
    next = undefined;
    while (pending.length !== 0) {
      const cursor = pending[pending.length - 1];
      const child = cursor?.next();
      if (child !== undefined && !child.done) { next = child.value; break; }
      pending.pop();
    }
  }
}

/**
 * One raw fact as HIR's captured fact (K-3340): availability and the reason are kept as captured, each of capture's
 * reasons having its own arm in HIR's captured fact (missing evidence included), never turned into another reason.
 */
function capturedFact<Raw, Value>(raw: RawFact<Raw>, convert: (value: Raw) => Value): Hir.CapturedFact<Value> {
  return raw.kind === "available" ? { kind: "available", value: convert(raw.value) } : { kind: "unavailable", reason: raw.reason, causes: raw.causes };
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


/** The definition identities of one module, read from its raw tree alone. */
export function lowerDefinitions(input: ModuleDefinitionsInput): Result<ModuleDefinitions> {
  const raw = input.module;
  return { kind: "ok", diagnostics: [], value: moduleIdentities(raw.module, raw.tree, raw.propertyNames, input.componentRoots) };
}

/** The export entries of one module: per exported name its declaration group, in canonical declaration order. */
export function lowerExports(deps: LowerDeps, raw: RawModule): Result<ModuleExports> {
  return { kind: "ok", diagnostics: [], value: lowerBindings(deps, raw) };
}

interface Lowering extends TypeConversion {
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly definitionAt: ReadonlyMap<NodeId, DefId>;
  readonly views: ReadonlyMap<NodeId, RawCheckerViews>;
  readonly references: ReadonlyMap<NodeId, RawFact<RawBindingTarget>>;
  readonly propertyNames: ReadonlyMap<NodeId, RawPropertyName>;
  readonly memberUses: Map<NodeId, RawMemberUse>;
  readonly links: ReadonlyMap<NodeId, RawModuleLink>;
  readonly locals: Map<NodeId, LocalRef>;
  readonly variableLocals: ReadonlyMap<BodyId, readonly Hir.HirLocal[]>;
  readonly associations: ReadonlyMap<NodeId, RawCallableAssociation>;
  readonly authoredTypes: ReadonlyMap<NodeId, RawTypeId>;
  readonly bodies: Hir.HirBody[];
  readonly captureParent: ReadonlyMap<BodyId, BodyId>;
  readonly captures: Map<BodyId, { readonly ordered: LocalRef[]; readonly members: Map<BodyId, Set<LocalRef["local"]>> }>;
  readonly core: ReadonlyMap<NodeId, RawCoreCapture>;
  readonly storage: Map<NodeId, RawStorageCapture>;
  readonly calls: ReadonlyMap<NodeId, RawCallSelection>;
  readonly candidateLists: Map<BodyId, Hir.HirCandidateList[]>;
  readonly expressions: Map<NodeId, Hir.Expression<Checked>>;
  readonly statements: Map<NodeId, Hir.Statement<Checked>>;
  readonly assignmentTargets: ReadonlySet<NodeId>;
}

interface NodeBodies {
  readonly definitions: ReadonlyMap<NodeId, DefId>;
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly captureParent: ReadonlyMap<BodyId, BodyId>;
  /** The bodies each body directly encloses, in preorder of their roots. */
  readonly children: ReadonlyMap<BodyId, readonly BodyId[]>;
  readonly locals: ReadonlyMap<NodeId, LocalRef>;
  readonly variables: readonly { readonly node: Hir.VariableDeclaration<Syntax>; readonly mutable: boolean; readonly local: LocalRef }[];
  readonly assignmentTargets: ReadonlySet<NodeId>;
}

function nodeBodies(raw: RawModule, moduleBody: BodyId, moduleDefinition: DefId, deps: LowerDeps,
  properties: ReadonlyMap<NodeId, RawPropertyName>): NodeBodies {
  const definitionAt = new Map<NodeId, DefId>([[raw.tree.id, moduleDefinition]]);
  const bodies = new Map<NodeId, BodyId>();
  const captureParent = new Map<BodyId, BodyId>();
  const children = new Map<BodyId, BodyId[]>();
  const locals = new Map<NodeId, LocalRef>();
  const localCounts = new Map<BodyId, number>();
  const variables: NodeBodies["variables"][number][] = [];
  const assignmentTargets = new Set<NodeId>();
  type Frame = { readonly node: Hir.SyntaxNode<Syntax>; readonly context: SourceBodyTransition;
    readonly children: Generator<Hir.SyntaxNode<Syntax>, void, undefined>; readonly mutable: boolean };
  const enter = (node: Hir.SyntaxNode<Syntax>, scope: SourceBodyScope, mutable: boolean): Frame => {
    if (!definitionAt.has(node.id) && sourceIdentityName(node, raw.module, properties, definitionAt) !== null)
      definitionAt.set(node.id, deps.definitionOf({ module: raw.module, node: node.id }));
    const body = scope.body;
    if (node.kind === "BinaryExpression" && node.operatorToken.kind === "EqualsToken") assignmentTargets.add(node.left.id);
    bodies.set(node.id, body);
    const context = enterSourceBody(node, scope, definitionAt);
    const boundary = context.boundary;
    if (node.kind === "FunctionDeclaration" && boundary !== null) {
      for (const [index, parameter] of node.parameters.nodes.entries()) locals.set(parameter.id, { body: boundary.body, local: localId(index) });
      localCounts.set(boundary.body, node.parameters.nodes.length);
    } else if (boundary?.kind === "initializer") {
      captureParent.set(boundary.body, boundary.parent);
      const siblings = children.get(context.lexicalBody) ?? [];
      siblings.push(boundary.body);
      children.set(context.lexicalBody, siblings);
    }
    if (node.kind === "VariableDeclaration" && body !== moduleBody) {
      const local = { body, local: localId(localCounts.get(body) ?? 0) };
      locals.set(node.id, local);
      localCounts.set(body, local.local + 1);
      variables.push({ node, mutable, local });
    }
    return { node, context, children: iterateChildrenOfSyntax(node),
      mutable: node.kind === "VariableDeclarationList" ? !node.flags.includes("Const") : mutable };
  };
  const pending: Frame[] = [enter(raw.tree, { body: moduleBody, lexicalBody: moduleBody, callableBody: null }, true)];
  for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
    const next = frame.children.next();
    if (next.done) continue;
    const child = next.value;
    pending.push(frame);
    const scope = childSourceBody(frame.context, child);
    const boundary = frame.context.boundary;
    if (boundary?.kind === "function" && child === boundary.root) {
      captureParent.set(boundary.body, boundary.parent);
      const siblings = children.get(frame.context.lexicalBody) ?? [];
      siblings.push(boundary.body);
      children.set(frame.context.lexicalBody, siblings);
    }
    pending.push(enter(child, scope, frame.mutable));
  }
  return { definitions: definitionAt, bodyOf: bodies, captureParent, children, locals, variables, assignmentTargets };
}

function headerOf<P extends Hir.Phase>(node: Hir.NodeHeader): Hir.NodeHeader & Record<never, P> {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

function typeOf(lowering: Lowering, type: RawTypeId): ConversionResult<TyId> {
  const converted = convertRawType(lowering, type);
  if (converted.kind === "unavailable") throw new TypeError("front: this checked endpoint requires its actual available captured type (" + converted.reason + ")");
  return converted.kind === "complete" ? { kind: "complete", value: converted.value.type } : converted;
}

function typeFactOf(lowering: Lowering, fact: RawFact<RawTypeId>): ConversionResult<Hir.CapturedFact<TyId>>;
function typeFactOf(lowering: Lowering, fact: RawFact<RawTypeId | null>): ConversionResult<Hir.CapturedFact<TyId | null>>;
function typeFactOf(lowering: Lowering, fact: RawFact<RawTypeId | null>): ConversionResult<Hir.CapturedFact<TyId | null>> {
  if (fact.kind === "unavailable") return { kind: "complete", value: fact };
  if (fact.value === null) return { kind: "complete", value: { kind: "available", value: null } };
  const converted = convertRawType(lowering, fact.value);
  if (converted.kind === "unavailable") return { kind: "complete", value: converted };
  return converted.kind === "complete" ? { kind: "complete", value: { kind: "available", value: converted.value.type } } : converted;
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
  if (raw === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
  const first = raw.kind === "available" && raw.value.kind === "declarations" && raw.value.declarations.length === 1 ? raw.value.declarations[0] : undefined;
  const local = first !== undefined && first.module === lowering.raw.module ? lowering.locals.get(first.node) : undefined;
  if (local === undefined) {
    const target = lowerBindingFact(lowering.deps, raw);
    return target.kind === "available" ? target.value : target;
  }
  for (let body = lowering.bodyOf.get(use); body !== undefined && body !== local.body; body = lowering.captureParent.get(body)) {
    const recorded = lowering.captures.get(body) ?? { ordered: [], members: new Map<BodyId, Set<LocalRef["local"]>>() };
    const members = recorded.members.get(local.body) ?? new Set<LocalRef["local"]>();
    if (!members.has(local.local)) {
      members.add(local.local);
      recorded.members.set(local.body, members);
      recorded.ordered.push(local);
    }
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
function valueOf(lowering: Lowering, node: NodeId): ConversionResult<Hir.CheckedValue> {
  const views = lowering.views.get(node);
  const core = lowering.core.get(node);
  if (views === undefined || core === undefined) return throwInvariant(invariant("An expression of a written kind has no checker views or core facts."));
  const read = typeFactOf(lowering, views.read);
  if (read.kind !== "complete") return read;
  const declared = typeFactOf(lowering, views.declared);
  if (declared.kind !== "complete") return declared;
  const contextual = typeFactOf(lowering, views.contextual);
  if (contextual.kind !== "complete") return contextual;
  const place = storageOf(lowering, node);
  if (place.kind !== "complete") return place;
  return { kind: "complete", value: {
    views: { read: read.value, declared: declared.value, contextual: contextual.value },
    place: place.value,
    memory: memoryOf(lowering, node), observation: capturedFact(core.layoutQuery, absenceOnly("layout query")),
  } };
}

function storageOf(lowering: Lowering, node: NodeId): ConversionResult<Hir.CapturedFact<Hir.HirStoragePlace | null>> {
  const captured = lowering.storage.get(node);
  if (captured === undefined) return { kind: "complete", value: { kind: "unavailable", reason: "not-provided", causes: [] } };
  const fact = captured.fact;
  if (fact.kind === "unavailable") { lowering.storage.delete(node); return { kind: "complete", value: fact }; }
  if (fact.value === null) { lowering.storage.delete(node); return { kind: "complete", value: { kind: "available", value: null } }; }
  const selected = fact.value;
  const local = selected.declaration?.module === lowering.raw.module ? lowering.locals.get(selected.declaration.node) : undefined;
  const resolution = resolutionOf(lowering, node, lowering.references.get(node));
  const symbol = lowering.views.get(node)?.symbol;
  if (captured.node.module !== lowering.raw.module || captured.node.node !== node
    || selected.expression.module !== lowering.raw.module || selected.expression.node !== node
    || selected.storageExpression.module !== lowering.raw.module || selected.storageExpression.node !== node
    || symbol?.kind === "available" && symbol.value !== selected.symbol
    || local === undefined || resolution.kind !== "local" || resolution.local.body !== local.body || resolution.local.local !== local.local)
    throw new TypeError("front: a local storage capture must retain its actual expression, declaration and qualified local");
  const type = typeFactOf(lowering, { kind: "available", value: selected.type });
  if (type.kind !== "complete") return type;
  lowering.storage.delete(node);
  return { kind: "complete", value: { kind: "available", value: { base: { kind: "root", resolution }, step: null,
    read: type.value, write: selected.writable ? type.value : { kind: "available", value: null } } } };
}

function token<K extends Hir.TokenSyntaxKind>(node: Hir.Token<Syntax, K>): Hir.Token<Checked, K> {
  return { ...headerOf(node), kind: node.kind, tsonic: null };
}

/** An authored annotation: its type is the one capture read from the checker for that type node. */
function typeNode(lowering: Lowering, node: Hir.TypeNode<Syntax>, owner: DefId): ConversionResult<{ readonly node: Hir.TypeNode<Checked>; readonly type: Hir.CapturedFact<TyId> }> {
  const checked = lowerCheckedType(declarationLowering(lowering), node, owner);
  if (checked.kind !== "complete") return checked;
  return { kind: "complete", value: { node: checked.value, type: checked.value.tsonic.type } };
}

function declarationLowering(lowering: Lowering): DeclarationLowering {
  return {
    core: node => coreOf(lowering, node), definitions: lowering.definitionAt, memory: node => memoryOf(lowering, node),
    resolution: node => resolutionOf(lowering, node, lowering.references.get(node)),
    checkedType: node => {
      const captured = lowering.authoredTypes.get(node);
      if (captured === undefined) return throwInvariant(invariant("Every checked type annotation retains its actual captured SDK type."));
      return typeFactOf(lowering, { kind: "available", value: captured });
    },
    signature: node => {
      const rows = lowering.associations.get(node)?.advertised;
      const selected = rows?.[0];
      if (rows?.length !== 1 || selected === undefined)
        return throwInvariant(invariant("A bodyless callable header requires its actual single checked signature association."));
      return signatureOf(lowering, selected);
    },
    expression: node => expression(lowering, node),
    property: node => {
      const row = lowering.propertyNames.get(node);
      if (row === undefined) return throwInvariant(invariant("A computed property requires its actual captured property-key state."));
      if (row.selected.kind !== "available") return { kind: "unavailable", reason: row.selected.reason, causes: row.selected.causes };
      const key = row.selected.value;
      if (key === null) return { kind: "unavailable", reason: "missing-original-component", causes: [] };
      if (key.kind === "text") return { kind: "available", value: key };
      if (key.kind === "symbol") return { kind: "available", value: { kind: "symbol", declaration: lowering.deps.definitionOf(key.declaration) } };
      throw new TypeError("front: checked numeric computed property keys require their exact numeric capture");
    },
  };
}

function expression(lowering: Lowering, node: Hir.Expression<Syntax>): Hir.Expression<Checked> {
  return lowering.expressions.get(node.id) ?? throwInvariant(invariant("An expression is not completed before its containing node."));
}

function memberUse(lowering: Lowering, node: Hir.PropertyAccessExpression<Syntax>): {
  readonly key: Hir.CapturedFact<MemberKey>;
  readonly origins: Hir.CapturedFact<readonly MemberOrigin[]>;
  readonly accessor: Hir.CapturedFact<Hir.HirApplication | null>;
} {
  const selected = lowering.memberUses.get(node.id);
  const missing: Hir.CapturedFact<never> = { kind: "unavailable", reason: "not-provided", causes: [] };
  if (selected === undefined) return { key: missing, origins: missing, accessor: missing };
  if (selected.receiver.module !== lowering.raw.module || selected.receiver.node !== node.expression.id
    || selected.access !== "read" || selected.optionalChain || selected.chainContinuation || selected.arms.length !== 1)
    throw new TypeError("front: a member use requires its actual receiver, access and selected arm");
  const arm = selected.arms[0];
  if (arm?.kind !== "member" || arm.receiver !== selected.receiverComponent)
    throw new TypeError("front: a property use requires its actual selected member arm");
  const inventory = lowering.raw.types.members[arm.member.table];
  const member = inventory?.members[arm.member.index];
  if (inventory?.component !== arm.receiver || member === undefined)
    throw new TypeError("front: a selected member use must name its genuine receiver inventory row");
  const component = lowering.raw.types.components[selected.receiverComponent];
  const read = selected.read === null ? undefined : lowering.raw.types.components[selected.read];
  if (component?.root.module !== selected.receiver.module || component.root.node !== selected.receiver.node || component.path.length !== 0
    || read?.root.module !== selected.occurrence.module || read.root.node !== selected.occurrence.node || read.path.length !== 0
    || selected.write !== null || selected.writeDeclarations.length !== 0 || arm.writeDeclarations.length !== 0)
    throw new TypeError("front: a selected read must retain its actual receiver and read components without a write occurrence");
  const primary = selected.selectedDeclaration;
  if (primary === null || !member.declarations.some(declaration => declaration.module === primary.module && declaration.node === primary.node)
    || selected.selectedDeclarations.length !== member.declarations.length || selected.selectedDeclarations.some((declaration, index) => {
      const actual = member.declarations[index];
      return actual?.module !== declaration.module || actual.node !== declaration.node;
    }))
    throw new TypeError("front: a selected read must retain its exact original declaration inventory");
  const declarations = selected.readDeclarations;
  if (declarations.length === 0 || declarations.length !== arm.readDeclarations.length)
    throw new TypeError("front: a member read requires its actual selected read declarations");
  const origins = declarations.map((declaration, index): MemberOrigin => {
    const original = arm.readDeclarations[index];
    const captured = member.origins.find(origin => {
      if (origin.kind !== "declaration" && origin.kind !== "source-member") return false;
      const reference = origin.kind === "declaration" ? origin.declaration : origin.occurrence;
      return origin.access === "read" && reference.module === declaration.module && reference.node === declaration.node;
    });
    if (original?.module !== declaration.module || original.node !== declaration.node || captured === undefined)
      throw new TypeError("front: member read origins must retain the exact selected receiver declarations");
    return lowerMemberOrigin(lowering.deps, captured);
  });
  lowering.memberUses.delete(node.id);
  return { key: { kind: "available", value: lowerMemberKey(lowering.deps, member.key) },
    origins: { kind: "available", value: origins }, accessor: member.readKind === "accessor"
      ? { kind: "unavailable", reason: "incomplete-association", causes: [] } : { kind: "available", value: null } };
}

function buildExpression(lowering: Lowering, node: Hir.Expression<Syntax>): ConversionResult<Hir.Expression<Checked>> {
  const value = valueOf(lowering, node.id);
  if (value.kind !== "complete") return value;
  switch (node.kind) {
    case "TrueKeyword": case "FalseKeyword": case "NullKeyword":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind,
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value } } };
    case "StringLiteral":
      return { kind: "complete", value: { ...headerOf(node), kind: "StringLiteral", text: node.text, tokenFlags: node.tokenFlags,
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value,
          literal: { kind: "string", value: node.text } } } };
    case "ParenthesizedExpression":
      return { kind: "complete", value: { ...headerOf(node), kind: "ParenthesizedExpression", expression: expression(lowering, node.expression),
        tsonic: { core: coreOf(lowering, node.id), ...value.value } } };
    case "PrefixUnaryExpression":
      return { kind: "complete", value: { ...headerOf(node), kind: "PrefixUnaryExpression", operator: node.operator, operand: expression(lowering, node.operand),
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value } } };
    case "Identifier": {
      const resolution = resolutionOf(lowering, node.id, lowering.references.get(node.id));
      if (lowering.assignmentTargets.has(node.id)) {
        const place = value.value.place;
        let target: Hir.CapturedFact<Hir.HirStoragePlace>;
        if (place.kind === "unavailable") target = place;
        else {
          const selected = place.value;
          if (selected === null) throw new TypeError("front: an assignment target requires its actual captured storage place");
          target = { kind: "available", value: selected };
        }
        return { kind: "complete", value: { ...headerOf(node), kind: "Identifier", text: node.text,
          tsonic: { core: coreOf(lowering, node.id), role: "assignment-target", resolution, views: value.value.views, place: target, access: "write" } } };
      }
      return { kind: "complete", value: { ...headerOf(node), kind: "Identifier", text: node.text, tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value, resolution } } };
    }
    case "BinaryExpression": {
      if (node.operatorToken.kind === "EqualsToken") {
        const left = expression(lowering, node.left);
        if (left.kind !== "Identifier" || left.tsonic.role !== "assignment-target")
          throw new TypeError("front: a plain assignment requires its actual selected storage target");
        return { kind: "complete", value: { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left, type: null,
          operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
          tsonic: { core: coreOf(lowering, node.id), role: "assignment", value: value.value, target: left.tsonic.place } } };
      }
      const operator = binaryOperatorOf(node.operatorToken.kind);
      if (operator !== "+" && operator !== "==" && operator !== "===" && operator !== "!=" && operator !== "!==")
        return throwInvariant(invariant("A binary operator of an unwritten kind passed the written-kinds check."));
      return { kind: "complete", value: { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left: expression(lowering, node.left), type: null,
        operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
        tsonic: { core: coreOf(lowering, node.id), role: operator === "+" ? "arithmetic" : "comparison", value: value.value } } };
    }
    case "CallExpression": {
      const application = applicationOf(lowering, node);
      if (application.kind !== "complete") return application;
      return { kind: "complete", value: { ...headerOf(node), kind: "CallExpression", expression: expression(lowering, node.expression), questionDotToken: null, typeArguments: null,
        arguments: { loc: node.arguments.loc, nodes: node.arguments.nodes.map(argument => expression(lowering, argument)) },
        tsonic: { core: coreOf(lowering, node.id), ...value.value, application: { kind: "available", value: application.value } } } };
    }
    case "PropertyAccessExpression": {
      if (node.name.kind !== "Identifier" || node.questionDotToken !== null) throw new TypeError("front: checked optional or private property access is not implemented");
      const selected = memberUse(lowering, node);
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, expression: expression(lowering, node.expression), questionDotToken: null,
        name: { ...headerOf(node.name), kind: "Identifier", text: node.name.text,
          tsonic: { core: coreOf(lowering, node.name.id), role: "property-name", key: selected.key, origins: selected.origins } },
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value,
          origins: selected.origins, accessor: selected.accessor } } };
    }
    default: return throwInvariant(invariant("An expression of an unwritten kind passed the written-kinds check."));
  }
}

function applicationOf(lowering: Lowering, node: Hir.CallExpression<Syntax>): ConversionResult<Hir.HirApplication> {
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
  const candidates: Hir.HirCandidate[] = [];
  for (const candidate of captured.candidates) {
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
    const appliedSignature = signatureOf(lowering, signature.id);
    if (appliedSignature.kind !== "complete") return appliedSignature;
    candidates.push({ ordinal: candidate.ordinal, declaration: lowering.deps.definitionOf(signature.declaration),
      appliedSignature: { kind: "available", value: appliedSignature.value },
      bindings: { kind: "available", value: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } },
      conditionalFailure: { kind: "available", value: null }, contributions: [] });
  }
  const selected = candidates.find(candidate => candidate.ordinal === call.selectedOrdinal);
  if (selected === undefined || selected.appliedSignature.kind !== "available") return throwInvariant(invariant("A call selection names no converted candidate."));
  lists.push({ id, candidates });
  lowering.candidateLists.set(body, lists);
  return { kind: "complete", value: { kind: "call", receiver: null, arguments: node.arguments.nodes.map(argument => ({ kind: "value", expression: argument.id })),
    typeArguments: [], candidates: { kind: "available", value: id }, resolvedSignature: { kind: "available", value: selected.appliedSignature.value } } };
}

function statement(lowering: Lowering, node: Hir.Statement<Syntax>): Hir.Statement<Checked> {
  return lowering.statements.get(node.id) ?? throwInvariant(invariant("A statement is not completed before its containing node."));
}

function buildStatement(lowering: Lowering, node: Hir.Statement<Syntax>, owner: DefId): ConversionResult<Hir.Statement<Checked>> {
  switch (node.kind) {
    case "VariableStatement": {
      const declarations: Hir.VariableDeclaration<Checked>[] = [];
      for (const declaration of node.declarationList.declarations.nodes) {
        const converted = variableDeclaration(lowering, declaration, owner);
        if (converted.kind !== "complete") return converted;
        declarations.push(converted.value);
      }
      return { kind: "complete", value: { ...headerOf(node), kind: "VariableStatement", modifiers: lowerCheckedModifiers(node.modifiers),
      declarationList: { ...headerOf(node.declarationList), kind: "VariableDeclarationList",
        declarations: { loc: node.declarationList.declarations.loc,
          nodes: declarations },
        tsonic: { core: coreOf(lowering, node.declarationList.id), disposal: [] } }, tsonic: null } };
    }
    case "ReturnStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "ReturnStatement", expression: node.expression === null ? null : expression(lowering, node.expression), tsonic: null } };
    case "ThrowStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "ThrowStatement", expression: expression(lowering, node.expression), tsonic: null } };
    case "IfStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "IfStatement", expression: expression(lowering, node.expression),
        thenStatement: statement(lowering, node.thenStatement),
        elseStatement: node.elseStatement === null ? null : statement(lowering, node.elseStatement), tsonic: null } };
    case "ExpressionStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "ExpressionStatement", expression: expression(lowering, node.expression), tsonic: null } };
    case "Block": return { kind: "complete", value: { ...headerOf(node), kind: "Block", statements: { loc: node.statements.loc,
      nodes: node.statements.nodes.map(child => statement(lowering, child)) }, multiLine: node.multiLine, tsonic: null } };
    case "FunctionDeclaration": return functionDeclaration(lowering, node, owner);
    case "InterfaceDeclaration": return lowerCheckedInterface(declarationLowering(lowering), node, owner);
    case "TypeAliasDeclaration": return lowerCheckedAlias(declarationLowering(lowering), node, owner);
    case "ExportDeclaration": case "ImportDeclaration": {
      const inputs = {
      core: (node: NodeId) => coreOf(lowering, node), memory: (node: NodeId) => memoryOf(lowering, node), definition: (node: NodeId) => definitionOf(lowering, node),
      binding: (node: NodeId) => bindingOccurrence(lowering.deps, { module: lowering.raw.module, node })
        ?? throwInvariant(invariant("A checked binding syntax requires its actual B1 occurrence.")),
      target: (node: NodeId): Hir.CapturedFact<Hir.ImportTarget> => {
        const link = lowering.links.get(node);
        if (link === undefined || link.resolution.kind === "unresolved") return { kind: "unavailable", reason: "incomplete-association", causes: [] };
        return { kind: "available", value: link.resolution.kind === "project" ? { target: "project", module: link.resolution.module }
          : { target: "library", module: link.resolution.module } };
      },
      };
      return { kind: "complete", value: node.kind === "ExportDeclaration" ? lowerExportDeclaration(inputs, node, owner) : lowerImportDeclaration(inputs, node) };
    }
    default: return throwInvariant(invariant("A statement of an unwritten kind passed the written-kinds check."));
  }
}

function variableDeclaration(lowering: Lowering, node: Hir.VariableDeclaration<Syntax>, owner: DefId): ConversionResult<Hir.VariableDeclaration<Checked>> {
  if (node.name.kind !== "Identifier") return throwInvariant(invariant("A variable of a written form has no identifier name."));
  const definition = definitionOf(lowering, node.id);
  const declaration = targetOf(lowering, node.id);
  const declared = node.type === null ? null : typeNode(lowering, node.type, definition);
  if (declared !== null && declared.kind !== "complete") return declared;
  const initializer = node.initializer === null ? null : expression(lowering, node.initializer);
  const body = initializer === null ? null : encodeBodyId({ owner: definition, role: "initializer", ordinal: 0 });
  if (body !== null && initializer !== null) lowering.bodies.push({ body, owner: definition, params: [], locals: [],
    root: initializer, captures: [], scopes: [], asynchronous: false, generator: false,
    candidateLists: lowering.candidateLists.get(body) ?? [], nestedBodies: [] });
  return { kind: "complete", value: { ...headerOf(node), kind: "VariableDeclaration", name: { ...headerOf(node.name), kind: "Identifier", text: node.name.text,
    tsonic: { core: coreOf(lowering, node.name.id), role: "declaration-name", declaration } }, exclamationToken: null,
    type: declared === null ? null : declared.value.node, initializer,
    tsonic: { core: coreOf(lowering, node.id), parent: owner, attributes: [], memory: memoryOf(lowering, node.id),
      declaration, declaredType: declared === null ? { kind: "available", value: null } : declared.value.type, initializer: body } } };
}

function block(lowering: Lowering, node: Hir.Block<Syntax>): Hir.Block<Checked> {
  const lowered = statement(lowering, node);
  return lowered.kind === "Block" ? lowered : throwInvariant(invariant("A checked block has another syntax kind."));
}

type CheckedWork =
  | { readonly kind: "expression"; readonly node: Hir.Expression<Syntax>; readonly owner: DefId }
  | { readonly kind: "statement"; readonly node: Hir.Statement<Syntax>; readonly owner: DefId };

function isExpression(node: Hir.SyntaxNode<Syntax>): node is Hir.Expression<Syntax> {
  return expressionKinds.includes(node.kind);
}

function* checkedChildren(work: CheckedWork): Generator<CheckedWork, void, undefined> {
  const { node, owner } = work;
  let statementIndex = 0;
  for (const child of iterateChildrenOfSyntax(node)) {
    if (work.kind === "expression") {
      if (isExpression(child) && !(node.kind === "PropertyAccessExpression" && child === node.name)) yield { kind: "expression", node: child, owner };
    } else if (node.kind === "InterfaceDeclaration") {
      if (child === node.members.nodes[0]) {
        for (const member of node.members.nodes)
          if ("name" in member && member.name.kind === "ComputedPropertyName")
            yield { kind: "expression", node: member.name.expression, owner };
      }
    } else if (node.kind === "Block") {
      const statement = node.statements.nodes[statementIndex++];
      if (statement === undefined || statement !== child) return throwInvariant(invariant("A block child is not its canonical statement occurrence."));
      yield { kind: "statement", node: statement, owner };
    } else if (node.kind === "ReturnStatement" || node.kind === "ThrowStatement" || node.kind === "ExpressionStatement") {
      if (child === node.expression && node.expression !== null) yield { kind: "expression", node: node.expression, owner };
    } else if (node.kind === "IfStatement") {
      if (child === node.expression) yield { kind: "expression", node: node.expression, owner };
      else if (child === node.thenStatement) yield { kind: "statement", node: node.thenStatement, owner };
      else if (child === node.elseStatement && node.elseStatement !== null) yield { kind: "statement", node: node.elseStatement, owner };
    } else if (node.kind === "VariableStatement" && child === node.declarationList) {
      for (const declaration of node.declarationList.declarations.nodes)
        if (declaration.initializer !== null) yield { kind: "expression", node: declaration.initializer, owner };
    } else if (node.kind === "FunctionDeclaration") {
      if (child.kind === "Parameter") {
        for (const parameterChild of iterateChildrenOfSyntax(child))
          if (parameterChild === child.initializer && child.initializer !== null)
            yield { kind: "expression", node: child.initializer, owner };
      } else if (child === node.body && node.body !== null) {
        if (node.body.kind !== "Block") return throwInvariant(invariant("A function of a written form has no block body."));
        yield { kind: "statement", node: node.body, owner };
      }
    }
  }
}

function lowerStatements(lowering: Lowering, owner: DefId): ConversionResult<void> {
  type Frame = { readonly work: CheckedWork; readonly children: Generator<CheckedWork, void, undefined> };
  const pending: Frame[] = [];
  const enter = (work: CheckedWork): Frame => {
    const node = work.node;
    if (work.kind === "statement" && node.kind === "FunctionDeclaration") {
      const definition = definitionOf(lowering, node.id);
      return { work, children: checkedChildren({ ...work, owner: definition }) };
    }
    return { work, children: checkedChildren(work) };
  };
  for (const node of lowering.raw.tree.statements.nodes) {
    pending.push(enter({ kind: "statement", node, owner }));
    for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
      const next = frame.children.next();
      if (!next.done) { pending.push(frame, enter(next.value)); continue; }
      if (frame.work.kind === "expression") {
        const converted = buildExpression(lowering, frame.work.node);
        if (converted.kind !== "complete") return converted;
        lowering.expressions.set(frame.work.node.id, converted.value);
      } else {
        const converted = buildStatement(lowering, frame.work.node, frame.work.owner);
        if (converted.kind !== "complete") return converted;
        lowering.statements.set(frame.work.node.id, converted.value);
      }
    }
  }
  return { kind: "complete", value: undefined };
}

function functionDeclaration(lowering: Lowering, node: Hir.FunctionDeclaration<Syntax>, owner: DefId): ConversionResult<Hir.FunctionDeclaration<Checked>> {
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
  const signatureParameters = node.parameters.nodes;
  const parameters: { readonly lowered: Hir.ParameterDeclaration<Checked>; readonly definition: DefId;
    readonly checkedType: TyId; readonly passing: PassingMode; readonly initializer: BodyId | null }[] = [];
  for (const [index, parameter] of signatureParameters.entries()) {
    const parameterDefinition = definitionOf(lowering, parameter.id);
    const declared = parameter.type === null ? null : typeNode(lowering, parameter.type, parameterDefinition);
    if (declared !== null && declared.kind !== "complete") return declared;
    const declaredType: Hir.CapturedFact<TyId | null> = declared === null ? { kind: "available", value: null } : declared.value.type;
    const checkedParameter = rawSignature.parameters[index];
    if (checkedParameter === undefined) return throwInvariant(invariant("A parameter has no row of its captured signature."));
    const checkedType = typeOf(lowering, checkedParameter.type);
    if (checkedType.kind !== "complete") return checkedType;
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
      questionToken: null, type: declared === null ? null : declared.value.node, initializer,
      tsonic: { core: coreOf(lowering, parameter.id), parent: definition, attributes: [], memory: memoryOf(lowering, parameter.id), declaration: target,
        declaredType, initializer: initializerBody } };
    parameters.push({ lowered, definition: parameterDefinition, checkedType: checkedType.value, passing: passingOf(lowering, parameter.id), initializer: initializerBody });
  }
  const returnType = node.type === null ? null : typeNode(lowering, node.type, definition);
  if (returnType !== null && returnType.kind !== "complete") return returnType;
  const item = (target: NodeId, itemOwner: DefId): SourceNodeRef => ({ kind: "item", value: { owner: itemOwner, node: target } });
  const signature = signatureOf(lowering, rawSignature.id);
  if (signature.kind !== "complete") return signature;
  const loweredBody = block(lowering, bodyNode);
  lowering.bodies.push({
    body, owner: definition,
    params: parameters.map((parameter, index) => ({ local: localId(index), declaration: parameter.definition,
      role: parameter.initializer === null ? "required" : "default", passing: parameter.passing, initializer: parameter.initializer })),
    locals: [...parameters.map((parameter, index): Hir.HirLocal => ({ id: localId(index), declaration: item(parameter.lowered.id, parameter.definition),
      name: parameter.lowered.name.kind === "Identifier" ? parameter.lowered.name.text : "", role: "parameter",
      checkerSlot: { kind: "available", value: parameter.checkedType }, capturedFrom: null, mutable: true })),
      ...lowering.variableLocals.get(body) ?? []],
    root: loweredBody, captures: [], scopes: [], asynchronous: false, generator: false, candidateLists: lowering.candidateLists.get(body) ?? [], nestedBodies: [],
  });
  const name = node.name;
  return { kind: "complete", value: { ...headerOf(node), kind: "FunctionDeclaration", modifiers: lowerCheckedModifiers(node.modifiers), typeParameters: null,
    parameters: { loc: node.parameters.loc, nodes: parameters.map(parameter => parameter.lowered) }, type: returnType === null ? null : returnType.value.node, fullSignature: null, asteriskToken: null,
    body: loweredBody,
    name: name === null ? null : { ...headerOf(name), kind: "Identifier", text: name.text, tsonic: { core: coreOf(lowering, name.id), role: "declaration-name", declaration: targetOf(lowering, node.id) } },
    tsonic: { core: coreOf(lowering, node.id), parent: owner, attributes: [], memory: memoryOf(lowering, node.id), definition, parameters: [],
      // One API body endpoint with its real body: a written function is not overloaded (an overload family is refused
      // by the written-kinds check, as a FunctionDeclaration without a body), so it has no advertised row (K-3312.1).
      signatures: [{ declaration: definition, role: "api-body", signature: signature.value, body }], body } } };
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

function memberUsesOf(raw: RawModule): Map<NodeId, RawMemberUse> {
  const uses = new Map<NodeId, RawMemberUse>();
  let previous = -1;
  for (const use of raw.memberUses) {
    if (use.occurrence.module !== raw.module || use.occurrence.node <= previous)
      return throwInvariant(invariant("Member uses retain their actual module and unique syntax order."));
    previous = use.occurrence.node;
    uses.set(use.occurrence.node, use);
  }
  return uses;
}

function storageCaptures(raw: RawModule): Map<NodeId, RawStorageCapture> {
  const rows = new Map<NodeId, RawStorageCapture>();
  let previous = -1;
  for (const row of raw.storage) {
    if (row.node.module !== raw.module || row.node.node <= previous)
      throw new TypeError("front: storage captures retain their actual module and unique syntax order");
    previous = row.node.node;
    rows.set(row.node.node, row);
  }
  return rows;
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
  const propertyNames = sourcePropertyNames(raw.module, raw.propertyNames);
  const moduleDefinition = deps.definitionOf({ module: raw.module, node: raw.tree.id });
  const moduleBody: BodyId = encodeBodyId({ owner: moduleDefinition, role: "module", ordinal: 0 });
  const structure = nodeBodies(raw, moduleBody, moduleDefinition, deps, propertyNames);
  const definitionAt = structure.definitions;
  const variableLocals = new Map<BodyId, Hir.HirLocal[]>();
  const lowering: Lowering = {
    ...createTypeConversion(deps, raw), bodyOf: structure.bodyOf, definitionAt, captureParent: structure.captureParent, captures: new Map(),
    assignmentTargets: structure.assignmentTargets,
    core: new Map(raw.core.filter(entry => entry.node.module === raw.module).map(entry => [entry.node.node, entry])),
    storage: storageCaptures(raw),
    views: new Map(raw.checkerViews.filter(view => view.node.module === raw.module).map(view => [view.node.node, view])),
    references: referenceTargets(raw), links: moduleLinks(raw), memberUses: memberUsesOf(raw),
    propertyNames,
    locals: new Map(structure.locals), variableLocals, bodies: [], expressions: new Map(), statements: new Map(),
    calls: new Map(raw.calls.filter(call => call.invocation.module === raw.module).map(call => [call.invocation.node, call])), candidateLists: new Map(),
    associations: new Map(raw.callableAssociations.filter(entry => entry.declaration.module === raw.module).map(entry => [entry.declaration.node, entry])),
    authoredTypes: new Map(raw.types.types.flatMap((row): [NodeId, RawTypeId][] => row.authoredTypeNode !== null && row.authoredTypeNode.module === raw.module ? [[row.authoredTypeNode.node, row.id]] : [])),
  };
  for (const { node, mutable, local } of structure.variables) {
    if (node.name.kind !== "Identifier") return throwInvariant(invariant("A variable of a written form has no identifier name."));
    const checked = lowering.views.get(node.id);
    if (checked === undefined) return throwInvariant(invariant("A local variable requires its own captured checked type."));
    const checkerSlot = typeFactOf(lowering, checked.read);
    if (checkerSlot.kind !== "complete") return publicationRefusal(raw, checkerSlot);
    const rows = variableLocals.get(local.body) ?? [];
    rows.push({ id: local.local, declaration: { kind: "item", value: { owner: definitionOf(lowering, node.id), node: node.id } },
      name: node.name.text, role: "binding", checkerSlot: checkerSlot.value,
      capturedFrom: null, mutable });
    variableLocals.set(local.body, rows);
  }
  const statements = lowerStatements(lowering, moduleDefinition);
  if (statements.kind !== "complete") return publicationRefusal(raw, statements);
  if (lowering.memberUses.size !== 0)
    return throwInvariant(invariant("Every captured member use must project to its actual selected syntax."));
  if (lowering.storage.size !== 0)
    throw new TypeError("front: every captured storage row must project to its actual executing expression");
  const tree: Hir.SourceFile<Checked> = { ...headerOf(raw.tree), kind: "SourceFile",
    statements: { loc: raw.tree.statements.loc, nodes: raw.tree.statements.nodes.map(child => statement(lowering, child)) },
    endOfFileToken: token(raw.tree.endOfFileToken), languageVariant: raw.tree.languageVariant, scriptKind: raw.tree.scriptKind,
    commentDirectives: raw.tree.commentDirectives, pragmas: raw.tree.pragmas, checkJsDirective: raw.tree.checkJsDirective,
    tsonic: { core: coreOf(lowering, raw.tree.id), parent: null, attributes: [], memory: memoryOf(lowering, raw.tree.id), definition: moduleDefinition, body: moduleBody } };
  // Each body's captures, and its nested bodies: the bodies it directly encloses, in preorder, as the body walk recorded them.
  const actualBodies: Hir.HirBody[] = [{ body: moduleBody, owner: moduleDefinition, params: [], locals: [], root: tree, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: lowering.candidateLists.get(moduleBody) ?? [], nestedBodies: [] }, ...lowering.bodies]
    .map(body => ({ ...body, captures: lowering.captures.get(body.body)?.ordered ?? [], nestedBodies: structure.children.get(body.body) ?? [] }));
  const bodyRows = new Map(actualBodies.map(body => [body.body, body]));
  const bodies = actualBodies.map(body => ({ ...body, locals: [...body.locals, ...body.captures.map((reference, index): Hir.HirLocal => {
    const source = bodyRows.get(reference.body)?.locals[reference.local];
    if (source === undefined || !Object.is(source.id, reference.local))
      return throwInvariant(invariant("A captured local requires its actual qualified source storage row."));
    return { ...source, id: localId(body.locals.length + index), role: "capture", capturedFrom: reference };
  })] })).sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  const items = [...definitionAt].filter(([node]) => node !== raw.tree.id).map(([node, definition]) => ({ definition, node }))
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  return { kind: "ok", diagnostics: [], value: { module: raw.module, tree, items, bodies, exports: exported.entries, bindings: exported.bindings, checkerDiagnostics: raw.checkerDiagnostics, obligations: [] } };
}

function publicationRefusal(raw: RawModule, stop: TypePublicationStop): Result<never> {
  return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
    limit: stop.dimension === "work" ? "front.typePublication.maximumWork" : "front.typePublication.maximumCreatedRecords",
    maximum: stop.maximum, site: { kind: "source", origin: raw.tree.origin },
    unit: { request: { query: "lowerModule", key: raw.module }, position: { kind: "result" } } })] };
}
