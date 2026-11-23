import type { InvariantFailure, Result } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, NodeId, NodeRef, RawTypeId, SourceNodeRef, TyId } from "../ids/contract.js";
import { candidateListId, encodeBodyId, localId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { binaryOperatorOf, iterateChildrenOfSyntax, prefixOperatorOf, shortCircuitOperatorOf, unparenthesizedExpression } from "../ir-hir/index.js";
import type { MemberKey, MemberOrigin } from "../ir-types/contract.js";
import type { PassingMode } from "../ir-types/contract.js";
import { admitTypePublicationStep, readType } from "../ir-types/index.js";
import type { LowerDeps, ModuleDefinitions, ModuleDefinitionsInput, ModuleExports, RawCallSelection, RawCallableAssociation, RawCheckerViews, RawCoreCapture, RawFact, RawMemberUse, RawModule, RawModuleLink, RawNodeRef, RawNumericLiteral, RawPropertyName, RawReference, RawStorageCapture } from "./contract.js";
import { moduleIdentities, sourceIdentityName, sourcePropertyNames } from "./identities.js";
import { bindingOccurrence, lowerBindingFact, lowerBindingTarget, lowerBindings, lowerMemberKey, lowerMemberOrigin, sourceOccurrence } from "./bindings.js";
import { lowerExportDeclaration } from "./lower-exports.js";
import { childSourceBody, enterSourceBody } from "./source-bodies.js";
import type { SourceBodyScope, SourceBodyTransition } from "./source-bodies.js";
import { lowerImportDeclaration } from "./lower-imports.js";
import { lowerCall } from "./lower-calls.js";
import { lowerObjectProperties } from "./lower-members.js";
import { convertRawType, createTypeConversion, signatureOf } from "./type-conversion.js";
import type { ConversionResult, ConversionStop, TypeConversion } from "./type-conversion.js";
import { captureNumericLiteral } from "./literals.js";
import type { LiteralResult } from "./literals.js";
import { expressionKinds, typeNodeKinds } from "./syntax-capture.js";
import { numericTypeSpelling, writtenCompoundAssignmentKinds } from "./syntax-support.js";
import { lowerCheckedAlias, lowerCheckedBodylessFunction, lowerCheckedInterface, lowerCheckedModifiers, lowerCheckedType } from "./checked-declarations.js";
import type { DeclarationLowering, TypeReader } from "./checked-declarations.js";

type Syntax = Hir.SyntaxPhase;
type Checked = Hir.CheckedPhase;

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });

/**
 * The syntax kinds whose checked annotation is written, and the forms of them it covers: the development frontier
 * of lowering, in one place. A module holding any other kind, or a written kind in another form, is refused by the
 * one check below with a compiler-defect TypeError; no partial HIR is returned.
 */
const writtenKinds: readonly string[] = ["SourceFile", "EndOfFile", "ExportKeyword", "DefaultKeyword", "FunctionDeclaration", "Parameter",
  "Identifier", "NumberKeyword", "StringKeyword", "BooleanKeyword", "BigIntKeyword", "AnyKeyword", "UnknownKeyword", "NeverKeyword", "ObjectKeyword", "UndefinedKeyword", "VoidKeyword",
  "Block", "ReturnStatement", "ThrowStatement", "IfStatement", "WhileStatement", "DoStatement", "ForStatement", "BreakStatement", "ContinueStatement",
  "SwitchStatement", "CaseBlock", "CaseClause", "DefaultClause",
  "EmptyStatement", "LabeledStatement",
  "BinaryExpression", "ConditionalExpression", "ColonToken", "PrefixUnaryExpression", "PostfixUnaryExpression", "PlusToken", "EqualsToken",
  "CallExpression", "ExpressionStatement", "ParenthesizedExpression", "VoidExpression",
  "AsExpression", "TypeAssertionExpression", "SatisfiesExpression", "NonNullExpression",
  "MinusToken", "AsteriskToken", "SlashToken", "PercentToken", "EqualsEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsToken", "ExclamationEqualsEqualsToken",
  "LessThanToken", "LessThanEqualsToken", "GreaterThanToken", "GreaterThanEqualsToken",
  "AmpersandToken", "BarToken", "CaretToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken", "GreaterThanGreaterThanGreaterThanToken",
  "AmpersandAmpersandToken", "BarBarToken", "QuestionQuestionToken", "CommaToken",
  "ExportDeclaration", "NamedExports", "ExportSpecifier", "NamespaceExport", "NumericLiteral", "StringLiteral", "NoSubstitutionTemplateLiteral", "TrueKeyword", "FalseKeyword", "NullKeyword",
  "ImportDeclaration", "ImportClause", "NamedImports", "ImportSpecifier", "NamespaceImport",
  "VariableStatement", "VariableDeclarationList", "VariableDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "TypeLiteral", "TypeParameter", "PropertySignature",
  "CallSignature", "ConstructSignature", "MethodSignature", "IndexSignature", "GetAccessor", "SetAccessor", "TypeReference", "TypeQuery", "UnionType", "IntersectionType",
  "ArrayType", "TupleType", "OptionalType", "TypeOperator", "IndexedAccessType", "ConditionalType", "InferType", "ThisType", "LiteralType", "ParenthesizedType",
  "TemplateLiteralType", "TemplateLiteralTypeSpan", "TemplateHead", "TemplateMiddle", "TemplateTail",
  "SymbolKeyword", "ReadonlyKeyword", "DeclareKeyword", "ComputedPropertyName", "PropertyAccessExpression", "QuestionToken",
  "ObjectLiteralExpression", "PropertyAssignment"];

function unwrittenForm(node: Hir.SyntaxNode<Syntax>, declarationName: boolean): string | null {
  if (node.kind === "QuestionDotToken" && declarationName) return null;
  if (!writtenKinds.includes(node.kind) && !writtenCompoundAssignmentKinds.includes(node.kind)) return node.kind;
  switch (node.kind) {
    case "FunctionDeclaration":
      return node.body === null ? node.modifiers?.nodes.some(modifier => modifier.kind === "DeclareKeyword") === true
        ? null : "FunctionDeclaration without a body or explicit declaration" : node.typeParameters !== null ? "FunctionDeclaration with type parameters" : null;
    case "Parameter": return node.dotDotDotToken !== null ? "rest Parameter" : null;
    case "GetAccessor": case "SetAccessor": return node.body !== null || node.asteriskToken !== null ? `${node.kind} with an execution body or generator marker` : null;
    case "LiteralType":
      return node.literal.kind === "NullKeyword" || node.literal.kind === "TrueKeyword" || node.literal.kind === "FalseKeyword"
        || node.literal.kind === "StringLiteral" || node.literal.kind === "NoSubstitutionTemplateLiteral" || numericTypeSpelling(node.literal) !== null
        ? null : `${node.kind} ${node.literal.kind}`;
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": {
      const operator = prefixOperatorOf(node.operator);
      return (operator === "++" || operator === "--") && unparenthesizedExpression(node.operand).kind !== "Identifier"
        ? `${node.kind} with a non-identifier update target` : null;
    }
    case "VariableDeclaration": return node.name.kind !== "Identifier" ? "pattern VariableDeclaration"
      : node.exclamationToken !== null ? "definite-assignment VariableDeclaration" : null;
    case "VariableDeclarationList": return node.flags.includes("AwaitUsing") ? "await using declaration"
      : node.flags.includes("Using") ? "using declaration" : null;
    case "BinaryExpression":
      return writtenCompoundAssignmentKinds.includes(node.operatorToken.kind) && unparenthesizedExpression(node.left).kind !== "Identifier"
        ? "compound assignment with a non-identifier target" : null;
    case "CallExpression":
      return node.questionDotToken !== null ? "optional CallExpression" : null;
    case "ForStatement": {
      const initializer = node.initializer;
      return initializer === null || initializer.kind === "VariableDeclarationList" || isExpression(initializer)
        ? null : "ForStatement with a missing initializer declaration";
    }
    case "PropertyAssignment":
      return node.name.kind !== "Identifier" || node.modifiers !== null || node.postfixToken !== null || node.type !== null
        ? "PropertyAssignment without a plain identifier name and initializer" : null;
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
  const pending: { readonly node: Hir.SyntaxNode<Syntax>; readonly declarationName: boolean;
    readonly children: Generator<Hir.SyntaxNode<Syntax>, void, undefined> }[] = [];
  let next: Hir.SyntaxNode<Syntax> | undefined = tree;
  while (next !== undefined) {
    const enclosing = pending[pending.length - 1];
    const parent = enclosing?.node;
    const declarationName = enclosing?.declarationName === true || next.kind === "ComputedPropertyName"
      && (parent?.kind === "PropertySignature" || parent?.kind === "MethodSignature") && parent.name === next;
    const form = unwrittenForm(next, declarationName);
    if (form !== null) throw new TypeError(`front: checked annotation not implemented: ${form}`);
    if (next.kind !== "LiteralType") pending.push({ node: next, declarationName, children: iterateChildrenOfSyntax(next) });
    next = undefined;
    while (pending.length !== 0) {
      const cursor = pending[pending.length - 1];
      const child = cursor?.children.next();
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

function markerType(lowering: Lowering, reference: RawNodeRef): { readonly typeNode: SourceNodeRef; readonly type: Hir.CapturedFact<TyId> } {
  const source = sourceOccurrence(lowering.deps, reference);
  if (reference.module !== lowering.raw.module || source === null || !typeNodeKinds.includes(source.kind))
    return throwInvariant(invariant("A checked marker must retain its actual authored type occurrence."));
  const id = lowering.authoredTypes.get(reference.node);
  const row = id === undefined ? undefined : lowering.raw.types.types[id];
  if (row === undefined || row.authoredTypeNode?.module !== reference.module || row.authoredTypeNode.node !== reference.node)
    return throwInvariant(invariant("A checked marker must join its actual authored type answer."));
  if (row.form.kind === "unavailable") return { typeNode: source.occurrence, type: row.form };
  const selected = lowering.convertedTypes.get(row.id);
  if (selected === undefined) return throwInvariant(invariant("A checked marker's authored argument type must already be lowered."));
  return { typeNode: source.occurrence, type: { kind: "available", value: selected.type } };
}

function coreOf(lowering: Lowering, node: NodeId): Hir.HirCoreCapture {
  const raw = lowering.core.get(node);
  if (raw === undefined) return throwInvariant(invariant("A node of a lowered module has no captured core facts."));
  const markers = capturedFact(raw.markers, (value): Hir.HirMarkersCapture => ({
    struct: value.struct === null ? null : { valueType: value.struct.valueType, fields: capturedFact(value.struct.fields,
      fields => fields.map(field => ({ name: field.name, readonly: field.readonly, ...markerType(lowering, field.typeNode) }))) },
    field: value.field === null ? null : { name: value.field.name, readonly: value.field.readonly, ...markerType(lowering, value.field.typeNode) },
    defaultValue: value.defaultValue === null ? null : markerType(lowering, value.defaultValue.typeNode),
    jsString: value.jsString,
    application: capturedFact(value.application, application => {
      if (application === null) return null;
      const body = lowering.bodyOf.get(node);
      if (body === undefined) return throwInvariant(invariant("A marker application must retain its actual execution body."));
      return { role: application.role, occurrence: { body, node }, declaration: lowering.deps.definitionOf(application.declaration) };
    }),
  }));
  const argumentPassing = capturedFact(raw.argumentPassing, (value): Hir.HirArgumentPassingCapture | null => {
    if (value === null) return null;
    if (value.role !== "declaration") throw new TypeError("front: the lowering of a present fact (argument passing of an argument) is not implemented");
    return { role: "declaration", mode: value.mode };
  });
  return {
    provider: capturedFact(raw.provider, value => value === null ? null : definitionOf(lowering, node)), markers,
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

/** The definition identities of one module, read from its raw tree alone. */
export function lowerDefinitions(input: ModuleDefinitionsInput): Result<ModuleDefinitions> {
  const raw = input.module;
  return { kind: "ok", diagnostics: [], value: moduleIdentities(raw.module, raw.tree, raw.propertyNames, input.componentRoots) };
}

/** The export entries of one module: per exported name its declaration group, in canonical declaration order. */
export function lowerExports(deps: LowerDeps, raw: RawModule): Result<ModuleExports> {
  const lowered = lowerBindings(deps, raw);
  return lowered.kind === "complete" ? { kind: "ok", diagnostics: [], value: lowered.value } : publicationRefusal(raw, lowered);
}

interface Lowering extends TypeConversion {
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly definitionAt: ReadonlyMap<NodeId, DefId>;
  readonly views: ReadonlyMap<NodeId, RawCheckerViews>;
  readonly references: ReadonlyMap<NodeId, RawReference>;
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
  readonly assignmentTargets: ReadonlyMap<NodeId, "write" | "read-write">;
  readonly labelTargets: ReadonlyMap<NodeId, NodeRef>;
}

interface NodeBodies {
  readonly definitions: ReadonlyMap<NodeId, DefId>;
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly captureParent: ReadonlyMap<BodyId, BodyId>;
  /** The bodies each body directly encloses, in preorder of their roots. */
  readonly children: ReadonlyMap<BodyId, readonly BodyId[]>;
  readonly locals: ReadonlyMap<NodeId, LocalRef>;
  readonly variables: readonly { readonly node: Hir.VariableDeclaration<Syntax>; readonly mutable: boolean; readonly local: LocalRef }[];
  readonly assignmentTargets: ReadonlyMap<NodeId, "write" | "read-write">;
  readonly labelTargets: ReadonlyMap<NodeId, NodeRef>;
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
  const assignmentTargets = new Map<NodeId, "write" | "read-write">();
  const labelTargets = new Map<NodeId, NodeRef>();
  interface LabelBinding {
    readonly declaration: Hir.LabeledStatement<Syntax>;
    readonly target: NodeRef;
    readonly previous: LabelBinding | undefined;
    continuable: boolean;
  }
  const labels = new Map<string, LabelBinding>();
  type Frame = { readonly node: Hir.SyntaxNode<Syntax>; readonly context: SourceBodyTransition;
    readonly children: Generator<Hir.SyntaxNode<Syntax>, void, undefined>; readonly mutable: boolean; readonly label: LabelBinding | null };
  const enter = (node: Hir.SyntaxNode<Syntax>, scope: SourceBodyScope, mutable: boolean, blockVariable: boolean): Frame => {
    if (!definitionAt.has(node.id) && sourceIdentityName(node, raw.module, properties, definitionAt) !== null)
      definitionAt.set(node.id, deps.definitionOf({ module: raw.module, node: node.id }));
    const body = scope.body;
    let label: LabelBinding | null = null;
    if (node.kind === "LabeledStatement") {
      const previous = labels.get(node.label.text);
      label = { declaration: node, target: { body, node: node.id }, previous, continuable: false };
      if (previous?.target.body !== body) labelTargets.set(node.label.id, label.target);
      labels.set(node.label.text, label);
    } else if ((node.kind === "BreakStatement" || node.kind === "ContinueStatement") && node.label !== null) {
      const binding = labels.get(node.label.text);
      if (binding?.target.body === body && (node.kind === "BreakStatement" || binding.continuable))
        labelTargets.set(node.label.id, binding.target);
    }
    if (node.kind === "BinaryExpression") {
      if (node.operatorToken.kind === "EqualsToken") assignmentTargets.set(unparenthesizedExpression(node.left).id, "write");
      else if (writtenCompoundAssignmentKinds.includes(node.operatorToken.kind)) assignmentTargets.set(unparenthesizedExpression(node.left).id, "read-write");
    }
    if (node.kind === "PostfixUnaryExpression" || node.kind === "PrefixUnaryExpression"
      && (node.operator === "PlusPlusToken" || node.operator === "MinusMinusToken"))
      assignmentTargets.set(unparenthesizedExpression(node.operand).id, "read-write");
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
    if (node.kind === "VariableDeclaration" && (body !== moduleBody || blockVariable)) {
      const local = { body, local: localId(localCounts.get(body) ?? 0) };
      locals.set(node.id, local);
      localCounts.set(body, local.local + 1);
      variables.push({ node, mutable, local });
    }
    return { node, context, children: iterateChildrenOfSyntax(node), label,
      mutable: node.kind === "VariableDeclarationList" ? !node.flags.includes("Const") : mutable };
  };
  const pending: Frame[] = [enter(raw.tree, { body: moduleBody, lexicalBody: moduleBody, callableBody: null }, true, false)];
  for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
    const next = frame.children.next();
    if (next.done) {
      if (frame.label !== null) {
        const name = frame.label.declaration.label.text;
        if (frame.label.previous === undefined) labels.delete(name);
        else labels.set(name, frame.label.previous);
      }
      continue;
    }
    const child = next.value;
    pending.push(frame);
    if (child.kind === "WhileStatement" || child.kind === "DoStatement" || child.kind === "ForStatement"
      || child.kind === "ForInStatement" || child.kind === "ForOfStatement") {
      let descendant: Hir.SyntaxNode<Syntax> = child;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const binding = pending[index]?.label;
        if (binding === undefined || binding === null || binding.declaration.statement !== descendant) break;
        binding.continuable = true;
        descendant = binding.declaration;
      }
    }
    const scope = childSourceBody(frame.context, child);
    const boundary = frame.context.boundary;
    if (boundary?.kind === "function" && child === boundary.root) {
      captureParent.set(boundary.body, boundary.parent);
      const siblings = children.get(frame.context.lexicalBody) ?? [];
      siblings.push(boundary.body);
      children.set(frame.context.lexicalBody, siblings);
    }
    const enclosing = pending.at(-2)?.node;
    const blockVariable = scope.body === moduleBody && child.kind === "VariableDeclaration"
      && frame.node.kind === "VariableDeclarationList" && (frame.node.flags.includes("Let") || frame.node.flags.includes("Const"))
      && (enclosing?.kind !== "VariableStatement" || enclosing.parent !== raw.tree.id);
    pending.push(enter(child, scope, frame.mutable, blockVariable));
  }
  return { definitions: definitionAt, bodyOf: bodies, captureParent, children, locals, variables, assignmentTargets, labelTargets };
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
 * K-3313.1, the one declaration-target law: a parameter, a local variable or a binding element of an execution body
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
function resolutionOf(lowering: Lowering, use: NodeId, meaning: "type" | "value"): LiteralResult<Hir.HirResolution> {
  const reference = lowering.references.get(use);
  const raw = reference?.target;
  if (raw === undefined) return { kind: "complete", value: { kind: "unavailable", reason: "incomplete-association", causes: [] } };
  if (raw.kind === "unavailable") {
    const target = lowerBindingFact(lowering, raw);
    if (target.kind !== "complete") return target;
    return { kind: "complete", value: target.value.kind === "available" ? target.value.value : target.value };
  }
  const selected = raw.value;
  if (selected.kind === "intrinsic-value") {
    if (meaning !== "value" || reference?.meaning !== "value" || lowering.assignmentTargets.has(use))
      return throwInvariant(invariant("An intrinsic value association belongs to its actual value-read occurrence."));
    return { kind: "complete", value: selected };
  }
  const first = selected.kind === "declarations" && selected.declarations.length === 1 ? selected.declarations[0] : undefined;
  const local = first !== undefined && first.module === lowering.raw.module ? lowering.locals.get(first.node) : undefined;
  if (local === undefined) return lowerBindingTarget(lowering, selected);
  if (meaning === "type") return { kind: "complete", value: { kind: "local", local } };
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
  return { kind: "complete", value: { kind: "local", local } };
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

function matchesStorageDeclaration(target: RawReference["target"] | undefined, reference: RawNodeRef | null): boolean {
  const declaration = target?.kind === "available" && target.value.kind === "declarations"
    && target.value.declarations.length === 1 ? target.value.declarations[0] : undefined;
  return declaration !== undefined && reference !== null && declaration.module === reference.module && declaration.node === reference.node;
}

function storageOf(lowering: Lowering, node: NodeId): ConversionResult<Hir.CapturedFact<Hir.HirStoragePlace | null>> {
  const captured = lowering.storage.get(node);
  if (captured === undefined) return { kind: "complete", value: { kind: "unavailable", reason: "not-provided", causes: [] } };
  const fact = captured.fact;
  if (fact.kind === "unavailable") { lowering.storage.delete(node); return { kind: "complete", value: fact }; }
  if (fact.value === null) { lowering.storage.delete(node); return { kind: "complete", value: { kind: "available", value: null } }; }
  const selected = fact.value;
  const local = selected.declaration?.module === lowering.raw.module ? lowering.locals.get(selected.declaration.node) : undefined;
  const resolved = resolutionOf(lowering, node, "value");
  if (resolved.kind !== "complete") return resolved;
  const resolution = resolved.value;
  const symbol = lowering.views.get(node)?.symbol;
  const ownLocal = local !== undefined && resolution.kind === "local"
    && resolution.local.body === local.body && resolution.local.local === local.local
    && (symbol?.kind !== "available" || symbol.value === selected.symbol);
  if (captured.node.module !== lowering.raw.module || captured.node.node !== node
    || selected.expression.module !== lowering.raw.module || selected.expression.node !== node
    || selected.storageExpression.module !== lowering.raw.module || selected.storageExpression.node !== node)
    throw new TypeError("front: a storage capture must retain its actual expression and qualified local or static declaration");
  let rejectedBinding = false;
  if (!ownLocal) {
    const selectedSymbol = selected.symbol === null ? undefined : lowering.raw.types.symbols[selected.symbol];
    const definition = selected.declaration?.module === lowering.raw.module ? lowering.definitionAt.get(selected.declaration.node) : undefined;
    const selectedDeclaration = matchesStorageDeclaration(selectedSymbol?.target, selected.declaration);
    const ownStatic = resolution.kind === "declarations" && resolution.definitions.length === 1
      && definition !== undefined && resolution.definitions[0] === definition && selectedDeclaration
      && matchesStorageDeclaration(lowering.references.get(node)?.target, selected.declaration);
    if (resolution.kind === "binding" && !selected.writable && selectedDeclaration) {
      const rawType = lowering.raw.types.types[selected.type];
      const component = rawType?.component === undefined || rawType.component === null ? undefined : lowering.raw.types.components[rawType.component];
      rejectedBinding = component?.root.module === lowering.raw.module && component.root.node === node && component.path === null
        && rawType?.form.kind === "unavailable" && rawType.form.reason === "checker-error";
    }
    if (!ownStatic && !rejectedBinding)
      throw new TypeError("front: a storage capture must retain its actual expression and qualified local or static declaration");
  }
  const type = typeFactOf(lowering, { kind: "available", value: selected.type });
  if (type.kind !== "complete") return type;
  lowering.storage.delete(node);
  if (rejectedBinding) return type.value.kind === "unavailable" ? { kind: "complete", value: type.value }
    : throwInvariant(invariant("A rejected binding write cannot publish a storage place."));
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

function admitNumericAnnotation(lowering: Lowering, node: NodeId, raw: RawFact<RawTypeId>, source: RawNumericLiteral): void {
  if (raw.kind === "unavailable") return;
  const row = lowering.raw.types.types[raw.value];
  const component = row === undefined ? undefined : lowering.raw.types.components[row.component];
  if (row?.id !== raw.value || component?.root.module !== lowering.raw.module || component.root.node !== node || component.path !== null)
    return throwInvariant(invariant("A numeric annotation must retain its actual checked component."));
  if (row.form.kind === "unavailable") return;
  const value = row.literal.kind === "available" && row.literal.value?.kind === "number" ? row.literal.value.value : null;
  const authored = value?.kind === "authored" ? value.literal : null;
  if (authored === null || authored.token !== source.token || authored.origin.module !== source.origin.module
    || authored.origin.start !== source.origin.start || authored.origin.length !== source.origin.length
    || authored.origin.derived.length !== 0 || source.origin.derived.length !== 0)
    return throwInvariant(invariant("A numeric annotation must retain its exact authored spelling and source."));
}

function declarationLowering(lowering: Lowering): DeclarationLowering {
  return {
    core: node => coreOf(lowering, node), definitions: lowering.definitionAt, memory: node => memoryOf(lowering, node),
    resolution: node => resolutionOf(lowering, node, "type"),
    checkedType: (node, inferParameter) => {
      const captured = lowering.authoredTypes.get(node.id);
      if (captured === undefined) return throwInvariant(invariant("Every checked type annotation retains its actual captured SDK type."));
      const form = lowering.raw.types.types[captured]?.form;
      if (form?.kind === "available" && (form.value.kind === "indexed-access" || form.value.kind === "conditional")) {
        const projection = form.value;
        const operands: readonly (readonly [RawTypeId, Hir.TypeNode<Syntax>])[] | null =
          projection.kind === "indexed-access" && node.kind === "IndexedAccessType"
          ? [[projection.object, node.objectType], [projection.index, node.indexType]]
          : projection.kind === "conditional" && node.kind === "ConditionalType"
            && projection.whenTrue.kind === "ready" && projection.whenFalse.kind === "ready"
            ? [[projection.check, node.checkType], [projection.extends, node.extendsType],
              [projection.whenTrue.type, node.trueType], [projection.whenFalse.type, node.falseType]] : null;
        if (operands === null) return throwInvariant(invariant("A dependent projection must be attached to its actual operator syntax."));
        if (projection.kind === "conditional") {
          const stop = admitTypePublicationStep(lowering.typeWork);
          if (stop !== null) return stop;
          const binder = projection.inferParameters[0];
          if (inferParameter === null ? projection.inferParameters.length !== 0
            : projection.inferParameters.length !== 1 || binder?.module !== lowering.raw.module || binder.node !== inferParameter)
            return throwInvariant(invariant("A conditional projection must retain its actual extends inference parameter."));
        }
        for (const [identity, operand] of operands) {
          const stop = admitTypePublicationStep(lowering.typeWork);
          if (stop !== null) return stop;
          const row = lowering.raw.types.types[identity];
          const component = row === undefined ? undefined : lowering.raw.types.components[row.component];
          const source = row?.authoredTypeNode;
          if (row?.id !== identity || source?.node !== operand.id || source.module !== lowering.raw.module
            || component?.root.module !== source.module || component.root.node !== source.node || component.path !== null)
            return throwInvariant(invariant(projection.kind === "indexed-access"
              ? "An indexed projection operand must retain its actual object or index child."
              : "A conditional projection operand must retain its actual checked child."));
        }
      }
      if (node.kind === "InferType" && form?.kind === "available"
        && (form.value.kind !== "parameter" || form.value.parameter.module !== lowering.raw.module
          || form.value.parameter.node !== node.typeParameter.id))
        return throwInvariant(invariant("An InferType annotation must retain its actual parameter type."));
      const numeric = node.kind === "LiteralType" ? numericTypeSpelling(node.literal) : null;
      if (numeric !== null) admitNumericAnnotation(lowering, node.id, { kind: "available", value: captured }, numeric);
      return typeFactOf(lowering, { kind: "available", value: captured });
    },
    numericLiteral: (type, spelling) => {
      if (type.kind === "unavailable") return captureNumericLiteral(lowering.deps.literalCapture, spelling);
      const checked = readType(lowering.deps.types, type.value);
      if (checked.kind !== "literal" || checked.value.kind !== "number")
        return throwInvariant(invariant("A numeric annotation must have its actual checked numeric singleton type."));
      return { kind: "complete", value: checked.value };
    },
    numericOperand: node => {
      const raw = lowering.views.get(node.id)?.read;
      if (raw === undefined) return throwInvariant(invariant("A signed annotation requires its actual numeric operand."));
      admitNumericAnnotation(lowering, node.id, raw, { token: node.text, origin: node.origin });
      return typeFactOf(lowering, raw);
    },
    signature: node => {
      const rows = lowering.associations.get(node)?.advertised;
      const selected = rows?.[0];
      if (rows?.length !== 1 || selected === undefined)
        return throwInvariant(invariant("A bodyless callable header requires its actual single checked signature association."));
      return signatureOf(lowering, selected);
    },
    expression: node => expression(lowering, node),
    prepareNameExpression: (node, owner, typeOf) => isExpression(node)
      ? completeExpression(lowering, node, owner, typeOf, "declaration-name") : { kind: "complete", value: undefined },
    property: node => {
      const row = lowering.propertyNames.get(node.id);
      if (row === undefined) return throwInvariant(invariant("A computed property requires its actual captured property-key state."));
      if (row.selected.kind !== "available") return { kind: "complete", value: row.selected };
      const key = row.selected.value;
      if (key === null) return { kind: "complete", value: { kind: "unavailable", reason: "missing-original-component", causes: [] } };
      if (key.kind === "numeric") {
        const actual = node.expression.origin;
        if (key.origin.module !== actual.module || key.origin.start !== actual.start || key.origin.length !== actual.length)
          return throwInvariant(invariant("A computed numeric property requires its actual name expression source."));
      }
      const lowered = lowerMemberKey(lowering, key);
      return lowered.kind === "complete" ? { kind: "complete", value: { kind: "available", value: lowered.value } } : lowered;
    },
  };
}

function expression(lowering: Lowering, node: Hir.Expression<Syntax>): Hir.Expression<Checked> {
  return lowering.expressions.get(node.id) ?? throwInvariant(invariant("An expression is not completed before its containing node."));
}

function memberUse(lowering: Lowering, node: Hir.PropertyAccessExpression<Syntax>, readFact: Hir.CapturedFact<TyId>): LiteralResult<{
  readonly key: Hir.CapturedFact<MemberKey>;
  readonly origins: Hir.CapturedFact<readonly MemberOrigin[]>;
  readonly accessor: Hir.CapturedFact<Hir.HirApplication | null>;
}> {
  const selected = lowering.memberUses.get(node.id);
  const missing: Hir.CapturedFact<never> = readFact.kind === "unavailable" && readFact.reason === "checker-error" ? readFact
    : { kind: "unavailable", reason: "not-provided", causes: [] };
  if (selected === undefined) return { kind: "complete", value: { key: missing, origins: missing, accessor: missing } };
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
  if (component?.root.module !== selected.receiver.module || component.root.node !== selected.receiver.node || component.path !== null
    || read?.root.module !== selected.occurrence.module || read.root.node !== selected.occurrence.node || read.path !== null
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
  const key = lowerMemberKey(lowering, member.key);
  if (key.kind !== "complete") return key;
  lowering.memberUses.delete(node.id);
  return { kind: "complete", value: { key: { kind: "available", value: key.value },
    origins: { kind: "available", value: origins }, accessor: member.readKind === "accessor"
      ? { kind: "unavailable", reason: "incomplete-association", causes: [] } : { kind: "available", value: null } } };
}

type ExpressionContext = "execution" | "declaration-name";

function buildExpression(lowering: Lowering, node: Hir.Expression<Syntax>, owner: DefId,
  typeOf: TypeReader, context: ExpressionContext): ConversionResult<Hir.Expression<Checked>> {
  const value = valueOf(lowering, node.id);
  if (value.kind !== "complete") return value;
  switch (node.kind) {
    case "TrueKeyword": case "FalseKeyword": case "NullKeyword":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind,
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value } } };
    case "StringLiteral": case "NoSubstitutionTemplateLiteral": {
      const tsonic: Hir.CheckedLiteral = { core: coreOf(lowering, node.id), role: "value", value: value.value,
        literal: { kind: "string", value: node.text } };
      const spelling = { ...headerOf(node), text: node.text, tokenFlags: node.tokenFlags, tsonic };
      return { kind: "complete", value: node.kind === "StringLiteral"
        ? { ...spelling, kind: node.kind }
        : { ...spelling, kind: node.kind, rawText: node.rawText, templateFlags: node.templateFlags } };
    }
    case "NumericLiteral": {
      const views = lowering.views.get(node.id);
      const raw = views?.read.kind === "available" ? lowering.raw.types.types[views.read.value]?.literal : undefined;
      const selected = raw?.kind === "available" ? raw.value : null;
      const authored = selected?.kind === "number" && selected.value.kind === "authored" ? selected.value.literal : null;
      const read = value.value.views.read;
      const type = read.kind === "available" ? readType(lowering.deps.types, read.value) : null;
      if (authored === null || authored.token !== node.text || authored.origin.module !== node.origin.module
        || authored.origin.start !== node.origin.start || authored.origin.length !== node.origin.length
        || authored.origin.derived.length !== 0 || node.origin.derived.length !== 0
        || type?.kind !== "literal" || type.value.kind !== "number")
        return throwInvariant(invariant("A checked numeric literal must retain its actual authored token and exact type."));
      return { kind: "complete", value: { ...headerOf(node), kind: "NumericLiteral", text: node.text, tokenFlags: node.tokenFlags,
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value,
          literal: { kind: "number", token: authored.token, value: type.value.value } } } };
    }
    case "ParenthesizedExpression": case "NonNullExpression": case "VoidExpression":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, expression: expression(lowering, node.expression),
        tsonic: { core: coreOf(lowering, node.id), ...value.value } } };
    case "AsExpression": case "TypeAssertionExpression": case "SatisfiesExpression": {
      const target = typeOf(node.type, owner);
      if (target.kind !== "complete") return target;
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, expression: expression(lowering, node.expression),
        type: target.value, tsonic: { core: coreOf(lowering, node.id), ...value.value } } };
    }
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": {
      const operand = expression(lowering, node.operand);
      const operator = prefixOperatorOf(node.operator);
      const core = coreOf(lowering, node.id);
      const update = operator === "++" || operator === "--";
      const leaf = update ? unparenthesizedExpression<Checked>(operand) : null;
      const target = leaf?.kind === "Identifier" && leaf.tsonic.role === "assignment-target" && leaf.tsonic.access === "read-write"
        ? leaf.tsonic.place : null;
      const checked = { core, value: value.value };
      const tsonic: Hir.CheckedUnary = !update ? { ...checked, role: "value" } : {
        ...checked, role: "update", target: target ?? throwInvariant(invariant("An update requires its actual selected read-write target.")),
      };
      const syntax = { ...headerOf(node), operand, tsonic };
      return node.kind === "PostfixUnaryExpression"
        ? { kind: "complete", value: { ...syntax, kind: node.kind, operator: node.operator } }
        : { kind: "complete", value: { ...syntax, kind: node.kind, operator: node.operator } };
    }
    case "Identifier": {
      const resolved = resolutionOf(lowering, node.id, "value");
      if (resolved.kind !== "complete") return resolved;
      const resolution = resolved.value;
      const access = lowering.assignmentTargets.get(node.id);
      if (access !== undefined) {
        const place = value.value.place;
        let target: Hir.CapturedFact<Hir.HirStoragePlace>;
        if (place.kind === "unavailable") target = place;
        else {
          const selected = place.value;
          if (selected === null) throw new TypeError("front: an assignment target requires its actual captured storage place");
          target = { kind: "available", value: selected };
        }
        return { kind: "complete", value: { ...headerOf(node), kind: "Identifier", text: node.text,
          tsonic: { core: coreOf(lowering, node.id), role: "assignment-target", resolution, views: value.value.views, place: target, access } } };
      }
      return { kind: "complete", value: { ...headerOf(node), kind: "Identifier", text: node.text, tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value, resolution } } };
    }
    case "ConditionalExpression":
      return { kind: "complete", value: { ...headerOf(node), kind: "ConditionalExpression",
        condition: expression(lowering, node.condition), questionToken: token(node.questionToken),
        whenTrue: expression(lowering, node.whenTrue), colonToken: token(node.colonToken),
        whenFalse: expression(lowering, node.whenFalse), tsonic: { core: coreOf(lowering, node.id), ...value.value } } };
    case "BinaryExpression": {
      if (node.operatorToken.kind === "EqualsToken" || writtenCompoundAssignmentKinds.includes(node.operatorToken.kind)) {
        const left = expression(lowering, node.left);
        const leaf = unparenthesizedExpression<Checked>(left);
        if (leaf.kind !== "Identifier" || leaf.tsonic.role !== "assignment-target")
          throw new TypeError("front: an assignment requires its actual selected storage target");
        return { kind: "complete", value: { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left, type: null,
          operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
          tsonic: { core: coreOf(lowering, node.id), role: "assignment", value: value.value, target: leaf.tsonic.place } } };
      }
      const operator = binaryOperatorOf(node.operatorToken.kind);
      const logical = shortCircuitOperatorOf(node.operatorToken.kind, "short-circuit");
      const sequence = node.operatorToken.kind === "CommaToken";
      const arithmetic = operator === "+" || operator === "-" || operator === "*" || operator === "/" || operator === "%"
        || operator === "&" || operator === "|" || operator === "^" || operator === "<<" || operator === ">>" || operator === ">>>";
      if (!sequence && logical === null && !arithmetic && operator !== "==" && operator !== "===" && operator !== "!=" && operator !== "!=="
        && operator !== "<" && operator !== "<=" && operator !== ">" && operator !== ">=")
        return throwInvariant(invariant("A binary operator of an unwritten kind passed the written-kinds check."));
      return { kind: "complete", value: { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left: expression(lowering, node.left), type: null,
        operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
        tsonic: { core: coreOf(lowering, node.id), role: sequence ? "sequence" : logical !== null ? "short-circuit" : arithmetic ? "arithmetic" : "comparison", value: value.value } } };
    }
    case "CallExpression": {
      let application: Hir.HirApplication | null = null;
      const read = value.value.views.read;
      const failure = context === "execution" && read.kind === "unavailable" && read.reason === "checker-error"
        && read.causes.length !== 0 && !lowering.calls.has(node.id) ? read : null;
      if (context === "execution") {
        if (failure === null) {
          const selected = applicationOf(lowering, node);
          if (selected.kind !== "complete") return selected;
          application = selected.value;
        }
      } else if (lowering.calls.has(node.id)) {
        return throwInvariant(invariant("A nonexecuting declaration name cannot retain a captured runtime call."));
      }
      const typeArguments: Hir.TypeNode<Checked>[] = [];
      for (const [index, authored] of (node.typeArguments?.nodes ?? []).entries()) {
        const checked = typeOf(authored, owner);
        if (checked.kind !== "complete") return checked;
        const authoredType = checked.value.tsonic.type;
        if (application?.resolvedSignature.kind === "available"
          && (authoredType.kind === "available" ? authoredType.value !== application.typeArguments[index]
            : authoredType.reason !== "checker-error" || authoredType.causes.length === 0))
          return throwInvariant(invariant("A checked call must agree with its actual authored argument types."));
        typeArguments.push(checked.value);
      }
      return { kind: "complete", value: { ...headerOf(node), kind: "CallExpression", expression: expression(lowering, node.expression), questionDotToken: null,
        typeArguments: node.typeArguments === null ? null : { loc: node.typeArguments.loc, nodes: typeArguments },
        arguments: { loc: node.arguments.loc, nodes: node.arguments.nodes.map(argument => expression(lowering, argument)) },
        tsonic: { core: coreOf(lowering, node.id), ...value.value, application: application === null
          ? failure ?? { kind: "unavailable", reason: "not-provided", causes: [] } : { kind: "available", value: application } } } };
    }
    case "ObjectLiteralExpression": {
      const own = value.value.views.read;
      const body = lowering.bodyOf.get(node.id);
      const shape = own.kind === "available" ? readType(lowering.deps.types, own.value) : null;
      if (body === undefined || shape?.kind !== "shape")
        throw new TypeError("front: an object literal requires its actual checked member shape and source body");
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, multiLine: node.multiLine,
        properties: lowerObjectProperties(node, body, shape.members, property => coreOf(lowering, property), child => expression(lowering, child)),
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value } } };
    }
    case "PropertyAccessExpression": {
      if (node.name.kind !== "Identifier" || context === "execution" && node.questionDotToken !== null)
        throw new TypeError("front: checked optional or private property access is not implemented");
      if (context === "declaration-name" && lowering.memberUses.has(node.id))
        return throwInvariant(invariant("A nonexecuting declaration name cannot retain a captured runtime member use."));
      const result = memberUse(lowering, node, value.value.views.read);
      if (result.kind !== "complete") return result;
      const selected = result.value;
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, expression: expression(lowering, node.expression),
        questionDotToken: node.questionDotToken === null ? null : token(node.questionDotToken),
        name: { ...headerOf(node.name), kind: "Identifier", text: node.name.text,
          tsonic: { core: coreOf(lowering, node.name.id), role: "property-name", key: selected.key, origins: selected.origins } },
        tsonic: { core: coreOf(lowering, node.id), role: "value", value: value.value,
          origins: selected.origins, accessor: selected.accessor } } };
    }
    default: return throwInvariant(invariant("An expression of an unwritten kind passed the written-kinds check."));
  }
}

function completeExpression(lowering: Lowering, node: Hir.Expression<Syntax>, owner: DefId, typeOf: TypeReader,
  context: ExpressionContext = "execution"): ConversionResult<void> {
  const converted = buildExpression(lowering, node, owner, typeOf, context);
  if (converted.kind !== "complete") return converted;
  lowering.expressions.set(node.id, converted.value);
  return { kind: "complete", value: undefined };
}

function applicationOf(lowering: Lowering, node: Hir.CallExpression<Syntax>): ConversionResult<Hir.HirApplication> {
  const call = lowering.calls.get(node.id);
  if (call === undefined || call.kind === "untyped") return throwInvariant(invariant("A lowered call needs its actual captured selection."));
  const body = lowering.bodyOf.get(node.id);
  if (body === undefined) return throwInvariant(invariant("A lowered call belongs to no body."));
  const lists = lowering.candidateLists.get(body) ?? [];
  const id = candidateListId(lists.length);
  let candidates: readonly Hir.HirCandidate[];
  let typeArguments: readonly TyId[];
  let resolvedSignature: Hir.HirApplication["resolvedSignature"];
  if (call.kind === "applicable") {
    const selected = lowerCall(lowering, node, call);
    if (selected.kind !== "complete") return selected;
    const candidate = selected.value.candidate;
    candidates = [candidate];
    typeArguments = selected.value.typeArguments;
    resolvedSignature = candidate.appliedSignature;
  } else {
    const group = lowering.raw.types.candidates[call.candidates];
    const diagnostic = call.diagnostics[0];
    if (call.invocation.module !== lowering.raw.module || call.invocation.node !== node.id
      || group?.id !== call.candidates || group.candidates.length !== 0
      || call.diagnostics.length !== 1 || diagnostic?.module !== lowering.raw.module
      || lowering.raw.checkerDiagnostics[diagnostic.index]?.severity !== "error")
      return throwInvariant(invariant("A rejected call must retain its actual empty candidate group and original checker cause."));
    candidates = [];
    typeArguments = [];
    resolvedSignature = { kind: "unavailable", reason: "checker-error",
      causes: [{ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic } }] };
  }
  lists.push({ id, candidates });
  lowering.candidateLists.set(body, lists);
  return { kind: "complete", value: { kind: "call", receiver: null, arguments: node.arguments.nodes.map(argument => ({ kind: "value", expression: argument.id })),
    typeArguments, candidates: { kind: "available", value: id }, resolvedSignature } };
}

function statement(lowering: Lowering, node: Hir.Statement<Syntax>): Hir.Statement<Checked> {
  return lowering.statements.get(node.id) ?? throwInvariant(invariant("A statement is not completed before its containing node."));
}

function checkedLabel(lowering: Lowering, node: Hir.Identifier<Syntax>): Hir.Identifier<Checked> {
  return { ...headerOf(node), kind: node.kind, text: node.text,
    tsonic: { core: coreOf(lowering, node.id), role: "label", target: lowering.labelTargets.get(node.id) ?? null } };
}

function variableList(lowering: Lowering, list: Hir.VariableDeclarationList<Syntax>, owner: DefId): ConversionResult<Hir.VariableDeclarationList<Checked>> {
  const declarations: Hir.VariableDeclaration<Checked>[] = [];
  for (const declaration of list.declarations.nodes) {
    const converted = variableDeclaration(lowering, declaration, owner);
    if (converted.kind !== "complete") return converted;
    declarations.push(converted.value);
  }
  return { kind: "complete", value: { ...headerOf(list), kind: list.kind,
    declarations: { loc: list.declarations.loc, nodes: declarations }, tsonic: { core: coreOf(lowering, list.id), disposal: [] } } };
}

function buildStatement(lowering: Lowering, node: Hir.Statement<Syntax>, owner: DefId): ConversionResult<Hir.Statement<Checked>> {
  switch (node.kind) {
    case "VariableStatement": {
      const list = variableList(lowering, node.declarationList, owner);
      if (list.kind !== "complete") return list;
      return { kind: "complete", value: { ...headerOf(node), kind: "VariableStatement", modifiers: lowerCheckedModifiers(node.modifiers),
        declarationList: list.value, tsonic: null } };
    }
    case "ReturnStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "ReturnStatement", expression: node.expression === null ? null : expression(lowering, node.expression), tsonic: null } };
    case "ThrowStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "ThrowStatement", expression: expression(lowering, node.expression), tsonic: null } };
    case "EmptyStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, tsonic: null } };
    case "BreakStatement": case "ContinueStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind,
        label: node.label === null ? null : checkedLabel(lowering, node.label), tsonic: null } };
    case "LabeledStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, label: checkedLabel(lowering, node.label),
        statement: statement(lowering, node.statement), tsonic: null } };
    case "IfStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "IfStatement", expression: expression(lowering, node.expression),
        thenStatement: statement(lowering, node.thenStatement),
        elseStatement: node.elseStatement === null ? null : statement(lowering, node.elseStatement), tsonic: null } };
    case "SwitchStatement": {
      const { caseBlock } = node;
      const clauses = caseBlock.clauses.nodes.map((clause): Hir.CaseOrDefaultClause<Checked> => {
        const statements = { loc: clause.statements.loc, nodes: clause.statements.nodes.map(child => statement(lowering, child)) };
        const common = { ...headerOf(clause), statements, tsonic: null };
        return clause.kind === "CaseClause" ? { ...common, kind: clause.kind, expression: expression(lowering, clause.expression) }
          : { ...common, kind: clause.kind, expression: null };
      });
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, expression: expression(lowering, node.expression),
        caseBlock: { ...headerOf(caseBlock), kind: caseBlock.kind, clauses: { loc: caseBlock.clauses.loc, nodes: clauses }, tsonic: null }, tsonic: null } };
    }
    case "WhileStatement": case "DoStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind, expression: expression(lowering, node.expression),
        statement: statement(lowering, node.statement), tsonic: null } };
    case "ForStatement": {
      const authored = node.initializer;
      let initializer: Hir.ForInitializer<Checked> | null = null;
      if (authored?.kind === "VariableDeclarationList") {
        const list = variableList(lowering, authored, owner);
        if (list.kind !== "complete") return list;
        initializer = list.value;
      } else if (authored !== null) {
        if (!isExpression(authored)) return throwInvariant(invariant("An unwritten for initializer passed the written-forms check."));
        initializer = expression(lowering, authored);
      }
      return { kind: "complete", value: { ...headerOf(node), kind: node.kind,
        initializer,
        condition: node.condition === null ? null : expression(lowering, node.condition),
        incrementor: node.incrementor === null ? null : expression(lowering, node.incrementor),
        statement: statement(lowering, node.statement), tsonic: null } };
    }
    case "ExpressionStatement":
      return { kind: "complete", value: { ...headerOf(node), kind: "ExpressionStatement", expression: expression(lowering, node.expression), tsonic: null } };
    case "Block": return { kind: "complete", value: { ...headerOf(node), kind: "Block", statements: { loc: node.statements.loc,
      nodes: node.statements.nodes.map(child => statement(lowering, child)) }, multiLine: node.multiLine, tsonic: null } };
    case "FunctionDeclaration": return node.body === null ? lowerCheckedBodylessFunction(declarationLowering(lowering), node, owner)
      : functionDeclaration(lowering, node, owner);
    case "InterfaceDeclaration": return lowerCheckedInterface(declarationLowering(lowering), node, owner);
    case "TypeAliasDeclaration": return lowerCheckedAlias(declarationLowering(lowering), node, owner);
    case "ExportDeclaration": case "ImportDeclaration": {
      const inputs = {
      core: (node: NodeId) => coreOf(lowering, node), memory: (node: NodeId) => memoryOf(lowering, node), definition: (node: NodeId) => definitionOf(lowering, node),
      binding: (node: NodeId) => bindingOccurrence(lowering.deps, { module: lowering.raw.module, node })
        ?? throwInvariant(invariant("A checked binding syntax requires its actual B1 occurrence.")),
      target: (node: NodeId): Hir.CapturedFact<Hir.ImportTarget> => {
        const link = lowering.links.get(node);
        if (link === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
        const resolution = link.resolution;
        if (resolution.kind === "unavailable") return resolution;
        const target = resolution.value;
        return { kind: "available", value: target.kind === "project" ? { target: "project", module: target.module }
          : { target: "library", module: target.module } };
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
  const bound = declared !== null || initializer === null ? null : typeFactOf(lowering, lowering.views.get(node.id)?.read
    ?? { kind: "unavailable", reason: "missing-original-component", causes: [] });
  if (bound !== null && bound.kind !== "complete") return bound;
  const body = initializer === null ? null : encodeBodyId({ owner: definition, role: "initializer", ordinal: 0 });
  if (body !== null && initializer !== null) lowering.bodies.push({ body, owner: definition, params: [], locals: [],
    root: initializer, captures: [], scopes: [], asynchronous: false, generator: false,
    candidateLists: lowering.candidateLists.get(body) ?? [], nestedBodies: [] });
  return { kind: "complete", value: { ...headerOf(node), kind: "VariableDeclaration", name: { ...headerOf(node.name), kind: "Identifier", text: node.name.text,
    tsonic: { core: coreOf(lowering, node.name.id), role: "declaration-name", declaration } }, exclamationToken: null,
    type: declared === null ? null : declared.value.node, initializer,
    tsonic: { core: coreOf(lowering, node.id), parent: owner, attributes: [], memory: memoryOf(lowering, node.id),
      declaration, declaredType: declared === null ? { kind: "available", value: null } : declared.value.type,
      inferredTypeBound: bound?.value ?? null, initializer: body } } };
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
      if (node.kind === "ObjectLiteralExpression" && child.kind === "PropertyAssignment")
        yield { kind: "expression", node: child.initializer, owner };
      else if (isExpression(child) && !(node.kind === "PropertyAccessExpression" && child === node.name))
        yield { kind: "expression", node: child, owner };
    } else if (node.kind === "Block") {
      const statement = node.statements.nodes[statementIndex++];
      if (statement === undefined || statement !== child) return throwInvariant(invariant("A block child is not its canonical statement occurrence."));
      yield { kind: "statement", node: statement, owner };
    } else if (node.kind === "LabeledStatement") {
      if (child === node.statement) yield { kind: "statement", node: node.statement, owner };
    } else if (node.kind === "ReturnStatement" || node.kind === "ThrowStatement" || node.kind === "ExpressionStatement") {
      if (child === node.expression && node.expression !== null) yield { kind: "expression", node: node.expression, owner };
    } else if (node.kind === "IfStatement") {
      if (child === node.expression) yield { kind: "expression", node: node.expression, owner };
      else if (child === node.thenStatement) yield { kind: "statement", node: node.thenStatement, owner };
      else if (child === node.elseStatement && node.elseStatement !== null) yield { kind: "statement", node: node.elseStatement, owner };
    } else if (node.kind === "SwitchStatement") {
      if (child === node.expression) yield { kind: "expression", node: node.expression, owner };
      else if (child === node.caseBlock) for (const clause of node.caseBlock.clauses.nodes) {
        if (clause.kind === "CaseClause") yield { kind: "expression", node: clause.expression, owner };
        for (const statement of clause.statements.nodes) yield { kind: "statement", node: statement, owner };
      }
    } else if (node.kind === "WhileStatement" || node.kind === "DoStatement") {
      if (child === node.expression) yield { kind: "expression", node: node.expression, owner };
      else if (child === node.statement) yield { kind: "statement", node: node.statement, owner };
    } else if (node.kind === "ForStatement") {
      if (child === node.statement) yield { kind: "statement", node: node.statement, owner };
      else if (child.kind === "VariableDeclarationList" && child === node.initializer) {
        for (const declaration of child.declarations.nodes)
          if (declaration.initializer !== null) yield { kind: "expression", node: declaration.initializer, owner };
      }
      else if (isExpression(child)) yield { kind: "expression", node: child, owner };
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
  const declarations = declarationLowering(lowering);
  const typeOf: TypeReader = (node, owner) => lowerCheckedType(declarations, node, owner);
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
        const converted = completeExpression(lowering, frame.work.node, frame.work.owner, typeOf);
        if (converted.kind !== "complete") return converted;
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
  const parameters: { readonly lowered: Hir.ParameterDeclaration<Checked>; readonly definition: DefId; readonly role: Hir.HirParam["role"];
    readonly checkedType: TyId; readonly passing: PassingMode; readonly initializer: BodyId | null }[] = [];
  for (const [index, parameter] of signatureParameters.entries()) {
    const parameterDefinition = definitionOf(lowering, parameter.id);
    const declared = parameter.type === null ? null : typeNode(lowering, parameter.type, parameterDefinition);
    if (declared !== null && declared.kind !== "complete") return declared;
    const declaredType: Hir.CapturedFact<TyId | null> = declared === null ? { kind: "available", value: null } : declared.value.type;
    const checkedParameter = rawSignature.parameters[index];
    if (checkedParameter?.declaration?.module !== lowering.raw.module || checkedParameter.declaration.node !== parameter.id)
      return throwInvariant(invariant("A parameter must retain its exact captured signature row."));
    if (checkedParameter.passing.kind !== "available")
      throw new TypeError("front: a callable parameter whose captured passing mode is unavailable is not implemented (" + checkedParameter.passing.reason + ")");
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
    const core = coreOf(lowering, parameter.id);
    const passing = checkedParameter.passing.value;
    if (core.argumentPassing.kind === "available" && core.argumentPassing.value !== null && core.argumentPassing.value.mode !== passing)
      return throwInvariant(invariant("A formal's declaration passing fact must agree with its actual signature."));
    const lowered: Hir.ParameterDeclaration<Checked> = { ...headerOf(parameter), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      name: { ...headerOf(parameter.name), kind: "Identifier", text: parameter.name.text, tsonic: { core: coreOf(lowering, parameter.name.id), role: "declaration-name", declaration: target } },
      questionToken: parameter.questionToken === null ? null : token(parameter.questionToken),
      type: declared === null ? null : declared.value.node, initializer,
      tsonic: { core, parent: definition, attributes: [], memory: memoryOf(lowering, parameter.id), declaration: target,
        declaredType, inferredTypeBound: null, initializer: initializerBody } };
    const role = initializerBody !== null ? "default" : checkedParameter.kind === "optional" ? "optional" : "required";
    parameters.push({ lowered, definition: parameterDefinition, role, checkedType: checkedType.value, passing, initializer: initializerBody });
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
      role: parameter.role, passing: parameter.passing, initializer: parameter.initializer })),
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
function referenceTargets(raw: RawModule): ReadonlyMap<NodeId, RawReference> {
  const references = new Map<NodeId, RawReference>();
  for (const reference of raw.references) {
    if (reference.occurrence.module !== raw.module || references.has(reference.occurrence.node))
      return throwInvariant(invariant("Each use must retain one complete captured target in its actual module."));
    references.set(reference.occurrence.node, reference);
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
    labelTargets: structure.labelTargets,
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
  const actualBodies: Hir.HirBody[] = [{ body: moduleBody, owner: moduleDefinition, params: [], locals: variableLocals.get(moduleBody) ?? [], root: tree, captures: [], scopes: [],
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
  const links: Hir.HirModuleLink[] = [];
  for (const statement of tree.statements.nodes) {
    if ((statement.kind !== "ImportDeclaration" && statement.kind !== "JSImportDeclaration" && statement.kind !== "ExportDeclaration")
      || statement.moduleSpecifier === null) continue;
    const link = lowering.links.get(statement.moduleSpecifier.id);
    if (link === undefined || link.declaration.module !== raw.module || link.declaration.node !== statement.id)
      return throwInvariant(invariant("The checked module edge must retain its own authored declaration."));
    links.push({ declaration: statement.id, evaluation: link.evaluation });
  }
  return { kind: "ok", diagnostics: [], value: { module: raw.module, tree, items, bodies, exports: exported.entries,
    bindings: exported.bindings, moduleLinks: links, checkerDiagnostics: raw.checkerDiagnostics, obligations: [] } };
}

function publicationRefusal(raw: RawModule, stop: ConversionStop): Result<never> {
  if (stop.kind === "literal-limit") return { kind: "refused", diagnostics: [stop.diagnostic] };
  return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
    limit: stop.dimension === "work" ? "front.typePublication.maximumWork" : "front.typePublication.maximumCreatedRecords",
    maximum: stop.maximum, site: { kind: "source", origin: raw.tree.origin },
    unit: { request: { query: "lowerModule", key: raw.module }, position: { kind: "result" } } })] };
}
