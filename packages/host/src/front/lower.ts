import type { InvariantFailure, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, NodeId, RawTypeId, SourceNodeRef, TyId } from "../ids/contract.js";
import { encodeBodyId, localId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { TypeTerm } from "../ir-types/contract.js";
import { internSignature, internType } from "../ir-types/index.js";
import type { PassingMode } from "../ir-types/contract.js";
import type { ConvertedCheckedType, LowerDeps, ModuleDefinitions, ModuleExports, RawCallableAssociation, RawCheckerViews, RawCoreCapture, RawFact, RawModule } from "./contract.js";
import { definitionRows } from "./identities.js";

type Syntax = Hir.SyntaxPhase;
type Checked = Hir.CheckedPhase;

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });

/**
 * The syntax kinds whose checked annotation is written, and the forms of them it covers: the development frontier
 * of lowering, in one place. A module holding any other kind, or a written kind in another form, is refused by the
 * one check below with a compiler-defect TypeError; no partial HIR is returned.
 */
const writtenKinds: readonly string[] = ["SourceFile", "EndOfFile", "ExportKeyword", "FunctionDeclaration", "Parameter",
  "Identifier", "NumberKeyword", "StringKeyword", "BooleanKeyword", "Block", "ReturnStatement", "BinaryExpression", "PlusToken"];

function unwrittenForm(node: Hir.SyntaxNode<Syntax>): string | null {
  if (!writtenKinds.includes(node.kind)) return node.kind;
  switch (node.kind) {
    case "FunctionDeclaration":
      return node.body === null ? "FunctionDeclaration without a body" : node.typeParameters !== null ? "FunctionDeclaration with type parameters" : null;
    // Only required parameters are written: capture's signature rows state every parameter as required.
    case "Parameter":
      return node.initializer !== null ? "Parameter with an initializer" : node.questionToken !== null ? "optional Parameter"
        : node.dotDotDotToken !== null ? "rest Parameter" : null;
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
 * A node's core facts as capture supplied them (K-3313.2): a proven absence stays a proven absence, a fact not
 * provided stays not provided. A present fact is a development frontier of this lowering, refused by name.
 */
function coreOf(lowering: Lowering, node: NodeId): Hir.HirCoreCapture {
  const raw = lowering.core.get(node);
  if (raw === undefined) return throwInvariant(invariant("A node of a lowered module has no captured core facts."));
  const absent = <Value>(fact: RawFact<Value | null>, name: string): Hir.CapturedFact<null> => {
    if (fact.kind === "unavailable") return { kind: "unavailable", reason: fact.reason === "checker-error" || fact.reason === "parameter-dependent" ? fact.reason : "not-provided" };
    if (fact.value !== null) throw new TypeError(`front: the lowering of a present core fact (${name}) is not implemented`);
    return { kind: "available", value: null };
  };
  const markers: Hir.CapturedFact<Hir.HirMarkersCapture> = raw.markers.kind === "unavailable" ? { kind: "unavailable", reason: "not-provided" }
    : raw.markers.value.struct === null && raw.markers.value.field === null && raw.markers.value.defaultValue === null && !raw.markers.value.jsString
      ? { kind: "available", value: { struct: null, field: null, defaultValue: null, jsString: false } }
      : (() => { throw new TypeError("front: the lowering of present markers is not implemented"); })();
  const passing = raw.argumentPassing;
  const argumentPassing: Hir.CapturedFact<Hir.HirArgumentPassingCapture | null> = passing.kind === "unavailable" ? absent(passing, "argument passing")
    : passing.value === null ? { kind: "available", value: null }
    : passing.value.role === "declaration" ? { kind: "available", value: { role: "declaration", mode: passing.value.mode } }
    : (() => { throw new TypeError("front: the lowering of an argument's passing capture is not implemented"); })();
  return {
    provider: absent(raw.provider, "provider"), markers, pointerType: absent(raw.pointerType, "pointer type"),
    pointerOperation: absent(raw.pointerOperation, "pointer operation"), fieldBinding: absent(raw.fieldBinding, "field binding"),
    recordBinding: absent(raw.recordBinding, "record binding"), attribute: absent(raw.attribute, "attribute"), safety: absent(raw.safety, "safety"),
    argumentPassing, flowState: absent(raw.flowState, "flow state"),
  };
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
 * \`any\`, \`unknown\` and \`never\` as intrinsics. Any other form was already refused by capture.
 */
export function convertRawType(deps: LowerDeps, raw: RawModule, type: RawTypeId, sourceNodeOf: (node: NodeId) => SourceNodeRef): Result<ConvertedCheckedType> {
  const row = raw.types.types[type];
  if (row === undefined) return throwInvariant(invariant("A raw type identity names no row of its module's type table."));
  const component = raw.types.components[row.component];
  if (component === undefined || row.form.kind !== "available" || row.form.value.kind !== "scalar")
    return throwInvariant(invariant("A raw type row lacks the form or position capture gave it."));
  const scalar = row.form.value.scalar;
  const term: TypeTerm | null = scalar === "number" ? { kind: "primitive", primitive: "float64" } : scalar === "string" ? { kind: "string" }
    : scalar === "boolean" ? { kind: "primitive", primitive: "bool" }
    : scalar === "bigint" || scalar === "any" || scalar === "unknown" || scalar === "never" ? { kind: "intrinsic", intrinsic: scalar } : null;
  if (term === null) throw new TypeError(`front: the conversion of the checker scalar ${scalar} is not implemented`);
  const category = scalar === "number" ? "number" : scalar === "string" ? "string" : scalar === "boolean" ? "boolean" : scalar === "bigint" ? "bigint" : null;
  const id = internType(deps.types, term);
  return { kind: "ok", diagnostics: [], value: { type: id, evidence: {
    type: id, component: sourceNodeOf(component.root.node),
    category: category === null ? { kind: "dynamic" } : { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null } } };
}

/** The definition identities of one module, read from its raw tree alone. */
export function lowerDefinitions(raw: RawModule): Result<ModuleDefinitions> {
  return { kind: "ok", diagnostics: [], value: { module: raw.module, rows: definitionRows(raw.module, raw.tree) } };
}

/** The export entries of one module: per exported name its declaration group, in canonical declaration order. */
export function lowerExports(deps: LowerDeps, raw: RawModule): Result<ModuleExports> {
  const groups = new Map<string, { readonly module: string; readonly node: NodeId; readonly definition: DefId }[]>();
  raw.exports.forEach(entry => {
    const group = groups.get(entry.name) ?? [];
    group.push({ module: entry.declaration.module, node: entry.declaration.node, definition: deps.definitionOf(entry.declaration) });
    groups.set(entry.name, group);
  });
  const names = [...groups.keys()].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  return { kind: "ok", diagnostics: [], value: { module: raw.module, entries: names.map(name => ({ name,
    definitions: (groups.get(name) ?? []).sort((left, right) => left.module < right.module ? -1 : left.module > right.module ? 1 : left.node - right.node)
      .map(member => member.definition) })) } };
}

interface Lowering {
  readonly deps: LowerDeps;
  readonly raw: RawModule;
  readonly definitionAt: ReadonlyMap<NodeId, DefId>;
  readonly views: ReadonlyMap<NodeId, RawCheckerViews>;
  readonly references: ReadonlyMap<NodeId, NodeId>;
  readonly locals: Map<NodeId, LocalRef>;
  readonly associations: ReadonlyMap<NodeId, RawCallableAssociation>;
  readonly authoredTypes: ReadonlyMap<NodeId, RawTypeId>;
  readonly bodies: Hir.HirBody[];
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly bodyParent: ReadonlyMap<BodyId, BodyId>;
  readonly captures: Map<BodyId, LocalRef[]>;
  readonly core: ReadonlyMap<NodeId, RawCoreCapture>;
}

interface NodeBodies {
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  /** The directly enclosing body of each function body. */
  readonly bodyParent: ReadonlyMap<BodyId, BodyId>;
  /** The bodies each body directly encloses, in preorder of their roots. */
  readonly children: ReadonlyMap<BodyId, readonly BodyId[]>;
}

/** The body each node lies in: a function's body for the nodes of its block, the module's body for the rest. */
function nodeBodies(tree: Hir.SourceFile<Syntax>, moduleBody: BodyId, definitionAt: ReadonlyMap<NodeId, DefId>): NodeBodies {
  const bodies = new Map<NodeId, BodyId>();
  const bodyParent = new Map<BodyId, BodyId>();
  const children = new Map<BodyId, BodyId[]>();
  const visit = (node: Hir.SyntaxNode<Syntax>, body: BodyId): void => {
    bodies.set(node.id, body);
    const definition = node.kind === "FunctionDeclaration" ? definitionAt.get(node.id) : undefined;
    childrenOfSyntax(node).forEach(child => {
      if (node.kind === "FunctionDeclaration" && definition !== undefined && child === node.body) {
        const inner = encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
        bodyParent.set(inner, body);
        const siblings = children.get(body) ?? [];
        siblings.push(inner);
        children.set(body, siblings);
        visit(child, inner);
      } else visit(child, body);
    });
  };
  visit(tree, moduleBody);
  return { bodyOf: bodies, bodyParent, children };
}

function headerOf<P extends Hir.Phase>(node: Hir.NodeHeader): Hir.NodeHeader & Record<never, P> {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

function typeOf(lowering: Lowering, type: RawTypeId): TyId {
  const converted = convertRawType(lowering.deps, lowering.raw, type, node => ({ kind: "body", value: {
    body: lowering.bodyOf.get(node) ?? throwInvariant(invariant("A node of a lowered module lies in no body.")), node } }));
  return converted.kind === "ok" ? converted.value.type : throwInvariant(invariant("A scalar type conversion was refused."));
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
function resolutionOf(lowering: Lowering, use: NodeId, declaration: NodeId | undefined): Hir.HirResolution {
  if (declaration === undefined || (!lowering.locals.has(declaration) && !lowering.definitionAt.has(declaration))) return { kind: "unresolved", checkerDiagnostic: null };
  const target = targetOf(lowering, declaration);
  if (target.kind === "definition") return { kind: "definition", definition: target.definition, aliases: [] };
  for (let body = lowering.bodyOf.get(use); body !== undefined && body !== target.local.body; body = lowering.bodyParent.get(body)) {
    const recorded = lowering.captures.get(body) ?? [];
    if (!recorded.some(entry => entry.body === target.local.body && entry.local === target.local.local)) recorded.push(target.local);
    lowering.captures.set(body, recorded);
  }
  return { kind: "local", local: target.local };
}

function definitionOf(lowering: Lowering, node: NodeId): DefId {
  const definition = lowering.definitionAt.get(node);
  return definition ?? throwInvariant(invariant("A declaration node of a written kind has no definition identity."));
}

function valueOf(lowering: Lowering, node: NodeId): Hir.CheckedValue {
  const views = lowering.views.get(node);
  if (views === undefined || views.read.kind !== "available" || views.contextual.kind !== "available")
    return throwInvariant(invariant("An expression of a written kind has no checker views."));
  return {
    views: { read: { kind: "available", value: typeOf(lowering, views.read.value) }, declared: { kind: "available", value: null },
      contextual: { kind: "available", value: views.contextual.value === null ? null : typeOf(lowering, views.contextual.value) } },
    place: { kind: "available", value: null }, memory: { kind: "available", value: null }, observation: { kind: "available", value: null },
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
    case "Identifier": {
      const resolution = resolutionOf(lowering, node.id, lowering.references.get(node.id));
      return { ...headerOf(node), kind: "Identifier", text: node.text, tsonic: { core: coreOf(lowering, node.id), role: "value", value: valueOf(lowering, node.id), resolution } };
    }
    case "BinaryExpression":
      if (node.operatorToken.kind !== "PlusToken") return throwInvariant(invariant("A binary operator of an unwritten kind passed the written-kinds check."));
      return { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left: expression(lowering, node.left), type: null,
        operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
        tsonic: { core: coreOf(lowering, node.id), role: "arithmetic", value: valueOf(lowering, node.id) } };
    default: return throwInvariant(invariant("An expression of an unwritten kind passed the written-kinds check."));
  }
}

function statement(lowering: Lowering, node: Hir.Statement<Syntax>, owner: DefId): Hir.Statement<Checked> {
  switch (node.kind) {
    case "ReturnStatement":
      return { ...headerOf(node), kind: "ReturnStatement", expression: node.expression === null ? null : expression(lowering, node.expression), tsonic: null };
    case "Block": return block(lowering, node, owner);
    case "FunctionDeclaration": return functionDeclaration(lowering, node, owner);
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
  if (association === undefined || association.advertised.length !== 1 || rawSignature === undefined || rawSignature.parameters.length !== node.parameters.nodes.length)
    return throwInvariant(invariant("A function of a written form has no captured signature with one row per parameter."));
  if (rawSignature.result.kind !== "available") throw new TypeError("front: a function whose checked result type is not captured is not implemented");
  const resultType = typeOf(lowering, rawSignature.result.value);
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
    if (parameter.name.kind !== "Identifier") return throwInvariant(invariant("A parameter of a written form has no identifier name."));
    const target = targetOf(lowering, parameter.id);
    const lowered: Hir.ParameterDeclaration<Checked> = { ...headerOf(parameter), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      name: { ...headerOf(parameter.name), kind: "Identifier", text: parameter.name.text, tsonic: { core: coreOf(lowering, parameter.name.id), role: "declaration-name", declaration: target } },
      questionToken: null, type: declared === null ? null : declared.node, initializer: null,
      tsonic: { core: coreOf(lowering, parameter.id), parent: definition, attributes: [], memory: { kind: "available", value: null }, declaration: target,
        declaredType: { kind: "available", value: declaredType }, initializer: null } };
    return { lowered, definition: parameterDefinition, checkedType, passing: passingOf(lowering, parameter.id) };
  });
  const returnType = node.type === null ? null : typeNode(lowering, node.type).node;
  const item = (target: NodeId, itemOwner: DefId): SourceNodeRef => ({ kind: "item", value: { owner: itemOwner, node: target } });
  const signature = internSignature(lowering.deps.types, {
    declaration: definition, owner: item(node.id, definition), composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: parameters.map(parameter => ({ declaration: parameter.definition, kind: "required", type: parameter.checkedType, passing: parameter.passing, initializer: null })),
    result: resultType,
  });
  const loweredBody = block(lowering, bodyNode, definition);
  lowering.bodies.push({
    body, owner: definition,
    params: parameters.map((parameter, index) => ({ local: localId(index), declaration: parameter.definition, role: "required", passing: parameter.passing, initializer: null })),
    locals: parameters.map((parameter, index) => ({ id: localId(index), declaration: item(parameter.lowered.id, parameter.definition),
      name: parameter.lowered.name.kind === "Identifier" ? parameter.lowered.name.text : "", role: "parameter",
      checkerSlot: { kind: "available", value: parameter.checkedType }, capturedFrom: null, mutable: true })),
    root: loweredBody, captures: [], scopes: [], asynchronous: false, generator: false, candidateLists: [], nestedBodies: [],
  });
  const name = node.name;
  return { ...headerOf(node), kind: "FunctionDeclaration", modifiers: modifiers(node.modifiers), typeParameters: null,
    parameters: { loc: node.parameters.loc, nodes: parameters.map(parameter => parameter.lowered) }, type: returnType, fullSignature: null, asteriskToken: null,
    body: loweredBody,
    name: name === null ? null : { ...headerOf(name), kind: "Identifier", text: name.text, tsonic: { core: coreOf(lowering, name.id), role: "declaration-name", declaration: targetOf(lowering, node.id) } },
    tsonic: { core: coreOf(lowering, node.id), parent: owner, attributes: [], memory: { kind: "available", value: null }, definition, parameters: [],
      // One API body endpoint with its real body: a written function is not overloaded (an overload family is refused
      // by the written-kinds check, as a FunctionDeclaration without a body), so it has no advertised row (K-3312.1).
      signatures: [{ declaration: definition, role: "api-body", signature, body }], body } };
}

/**
 * The checked module of one raw capture. The written kinds and forms are the only ones lowered; a module holding
 * any other is refused at once by the one check of the development frontier.
 */
export function lowerRawModule(deps: LowerDeps, raw: RawModule): Result<Hir.HirModule> {
  refuseUnwritten(raw.tree);
  const rows = definitionRows(raw.module, raw.tree);
  const definitionAt = new Map<NodeId, DefId>(rows.map(row => [row.node, deps.definitionOf({ module: raw.module, node: row.node })]));
  const moduleDefinition = definitionAt.get(raw.tree.id) ?? throwInvariant(invariant("A module has no definition identity."));
  const moduleBody: BodyId = encodeBodyId({ owner: moduleDefinition, role: "module", ordinal: 0 });
  const structure = nodeBodies(raw.tree, moduleBody, definitionAt);
  const lowering: Lowering = {
    deps, raw, definitionAt, bodyOf: structure.bodyOf, bodyParent: structure.bodyParent, captures: new Map(),
    core: new Map(raw.core.filter(entry => entry.node.module === raw.module).map(entry => [entry.node.node, entry])),
    views: new Map(raw.checkerViews.filter(view => view.node.module === raw.module).map(view => [view.node.node, view])),
    references: new Map(raw.references.filter(reference => reference.declaration.module === raw.module).map(reference => [reference.occurrence.node, reference.declaration.node])),
    locals: new Map(), bodies: [],
    associations: new Map(raw.callableAssociations.filter(entry => entry.declaration.module === raw.module).map(entry => [entry.declaration.node, entry])),
    authoredTypes: new Map(raw.types.types.flatMap((row): [NodeId, RawTypeId][] => row.authoredTypeNode !== null && row.authoredTypeNode.module === raw.module ? [[row.authoredTypeNode.node, row.id]] : [])),
  };
  const tree: Hir.SourceFile<Checked> = { ...headerOf(raw.tree), kind: "SourceFile",
    statements: { loc: raw.tree.statements.loc, nodes: raw.tree.statements.nodes.map(child => statement(lowering, child, moduleDefinition)) },
    endOfFileToken: token(raw.tree.endOfFileToken), languageVariant: raw.tree.languageVariant, scriptKind: raw.tree.scriptKind,
    commentDirectives: raw.tree.commentDirectives, pragmas: raw.tree.pragmas, checkJsDirective: raw.tree.checkJsDirective,
    tsonic: { core: coreOf(lowering, raw.tree.id), parent: null, attributes: [], memory: { kind: "available", value: null }, definition: moduleDefinition, body: moduleBody } };
  // Each body's captures, and its nested bodies: the bodies it directly encloses, in preorder, as the body walk recorded them.
  const bodies: Hir.HirBody[] = [{ body: moduleBody, owner: moduleDefinition, params: [], locals: [], root: tree, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] }, ...lowering.bodies]
    .map(body => ({ ...body, captures: lowering.captures.get(body.body) ?? [], nestedBodies: structure.children.get(body.body) ?? [] }))
    .sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  const items = rows.filter(row => row.node !== raw.tree.id).map(row => ({ definition: definitionOf(lowering, row.node), node: row.node }))
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  return { kind: "ok", diagnostics: [], value: { module: raw.module, tree, items, bodies, checkerDiagnostics: [], obligations: [] } };
}
