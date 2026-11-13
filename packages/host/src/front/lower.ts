import type { InvariantFailure, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, NodeId, RawTypeId, SourceNodeRef, TyId } from "../ids/contract.js";
import { encodeBodyId, localId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";
import type { TypeTerm } from "../ir-types/contract.js";
import { internSignature, internType } from "../ir-types/index.js";
import type { ConvertedCheckedType, LowerDeps, ModuleDefinitions, ModuleExports, RawCheckerViews, RawModule } from "./contract.js";
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
  "Identifier", "NumberKeyword", "Block", "ReturnStatement", "BinaryExpression", "PlusToken"];

function unwrittenForm(node: Hir.SyntaxNode<Syntax>): string | null {
  if (!writtenKinds.includes(node.kind)) return node.kind;
  switch (node.kind) {
    case "FunctionDeclaration":
      return node.body === null ? "FunctionDeclaration without a body" : node.typeParameters !== null ? "FunctionDeclaration with type parameters" : null;
    case "Parameter":
      return node.initializer !== null ? "Parameter with an initializer" : null;
    default: return null;
  }
}

/** The one check of lowering's development frontier. */
function refuseUnwritten(tree: Hir.SyntaxNode<Syntax>): void {
  const pending: Hir.SyntaxNode<Syntax>[] = [tree];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const form = unwrittenForm(next);
    if (form !== null) throw new TypeError(`front: checked annotation not implemented: ${form}`);
    pending.push(...childrenOfSyntax(next));
  }
}

function absentCoreOf(): Hir.HirCoreCapture {
  return {
  provider: { kind: "available", value: null },
  markers: { kind: "available", value: { struct: null, field: null, defaultValue: null, jsString: false } },
  pointerType: { kind: "available", value: null }, pointerOperation: { kind: "available", value: null },
  fieldBinding: { kind: "available", value: null }, recordBinding: { kind: "available", value: null },
  attribute: { kind: "available", value: null }, safety: { kind: "available", value: null },
  argumentPassing: { kind: "available", value: null }, flowState: { kind: "available", value: null },
  };
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
  readonly bodies: Hir.HirBody[];
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
}

/** The body each node lies in: a function's body for the nodes of its block, the module's body for the rest. */
function nodeBodies(tree: Hir.SourceFile<Syntax>, moduleBody: BodyId, definitionAt: ReadonlyMap<NodeId, DefId>): ReadonlyMap<NodeId, BodyId> {
  const bodies = new Map<NodeId, BodyId>();
  const visit = (node: Hir.SyntaxNode<Syntax>, body: BodyId): void => {
    bodies.set(node.id, body);
    const definition = node.kind === "FunctionDeclaration" ? definitionAt.get(node.id) : undefined;
    childrenOfSyntax(node).forEach(child => {
      visit(child, node.kind === "FunctionDeclaration" && definition !== undefined && child === node.body
        ? encodeBodyId({ owner: definition, role: "function", ordinal: 0 }) : body);
    });
  };
  visit(tree, moduleBody);
  return bodies;
}

function headerOf<P extends Hir.Phase>(node: Hir.NodeHeader): Hir.NodeHeader & Record<never, P> {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

function typeOf(lowering: Lowering, type: RawTypeId): TyId {
  const converted = convertRawType(lowering.deps, lowering.raw, type, node => ({ kind: "body", value: {
    body: lowering.bodyOf.get(node) ?? throwInvariant(invariant("A node of a lowered module lies in no body.")), node } }));
  return converted.kind === "ok" ? converted.value.type : throwInvariant(invariant("A scalar type conversion was refused."));
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

function typeNode(lowering: Lowering, node: Hir.TypeNode<Syntax>): Hir.TypeNode<Checked> {
  if (node.kind !== "NumberKeyword") return throwInvariant(invariant("A type node of an unwritten kind passed the written-kinds check."));
  const views = lowering.views.get(node.id);
  const type = views !== undefined && views.read.kind === "available" ? typeOf(lowering, views.read.value)
    : internType(lowering.deps.types, { kind: "primitive", primitive: "float64" });
  return { ...headerOf(node), kind: node.kind, tsonic: { core: absentCoreOf(), type: { kind: "available", value: type }, referencedDefinitions: [] } };
}

function expression(lowering: Lowering, node: Hir.Expression<Syntax>): Hir.Expression<Checked> {
  switch (node.kind) {
    case "Identifier": {
      const target = lowering.references.get(node.id);
      const local = target === undefined ? undefined : lowering.locals.get(target);
      const definition = target === undefined ? undefined : lowering.definitionAt.get(target);
      const resolution: Hir.HirResolution = local !== undefined ? { kind: "local", local }
        : definition !== undefined ? { kind: "definition", definition, aliases: [] } : { kind: "unresolved", checkerDiagnostic: null };
      return { ...headerOf(node), kind: "Identifier", text: node.text, tsonic: { core: absentCoreOf(), role: "value", value: valueOf(lowering, node.id), resolution } };
    }
    case "BinaryExpression":
      if (node.operatorToken.kind !== "PlusToken") return throwInvariant(invariant("A binary operator of an unwritten kind passed the written-kinds check."));
      return { ...headerOf(node), kind: "BinaryExpression", modifiers: null, left: expression(lowering, node.left), type: null,
        operatorToken: token(node.operatorToken), right: expression(lowering, node.right),
        tsonic: { core: absentCoreOf(), role: "arithmetic", value: valueOf(lowering, node.id) } };
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
  const signatureParameters = node.parameters.nodes.map((parameter, index) => {
    lowering.locals.set(parameter.id, { body, local: localId(index) });
    return parameter;
  });
  const parameters = signatureParameters.map((parameter, index) => {
    const parameterDefinition = definitionOf(lowering, parameter.id);
    const declared = parameter.type === null ? null : typeNode(lowering, parameter.type);
    const declaredType = declared !== null && "tsonic" in declared && declared.tsonic !== null && "type" in declared.tsonic &&
      declared.tsonic.type.kind === "available" ? declared.tsonic.type.value : null;
    if (parameter.name.kind !== "Identifier") return throwInvariant(invariant("A parameter of a written form has no identifier name."));
    const local: LocalRef = { body, local: localId(index) };
    const lowered: Hir.ParameterDeclaration<Checked> = { ...headerOf(parameter), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      name: { ...headerOf(parameter.name), kind: "Identifier", text: parameter.name.text, tsonic: { core: absentCoreOf(), role: "declaration-name", declaration: { kind: "local", local } } },
      questionToken: null, type: declared, initializer: null,
      tsonic: { core: absentCoreOf(), parent: definition, attributes: [], memory: { kind: "available", value: null }, declaration: { kind: "local", local },
        declaredType: { kind: "available", value: declaredType }, initializer: null } };
    return { lowered, definition: parameterDefinition, declaredType };
  });
  const returnType = node.type === null ? null : typeNode(lowering, node.type);
  const resultType = returnType !== null && "tsonic" in returnType && returnType.tsonic !== null && "type" in returnType.tsonic &&
    returnType.tsonic.type.kind === "available" ? returnType.tsonic.type.value : throwInvariant(invariant("A function of a written form has no declared result type."));
  const item = (target: NodeId, itemOwner: DefId): SourceNodeRef => ({ kind: "item", value: { owner: itemOwner, node: target } });
  const signature = internSignature(lowering.deps.types, {
    declaration: definition, owner: item(node.id, definition), composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: parameters.map(parameter => ({ declaration: parameter.definition, kind: "required", type: parameter.declaredType ?? resultType, passing: "by-value", initializer: null })),
    result: resultType,
  });
  const loweredBody = block(lowering, bodyNode, definition);
  lowering.bodies.push({
    body, owner: definition,
    params: parameters.map((parameter, index) => ({ local: localId(index), declaration: parameter.definition, role: "required", passing: "by-value", initializer: null })),
    locals: parameters.map((parameter, index) => ({ id: localId(index), declaration: item(parameter.lowered.id, parameter.definition),
      name: parameter.lowered.name.kind === "Identifier" ? parameter.lowered.name.text : "", role: "parameter",
      checkerSlot: { kind: "available", value: parameter.declaredType ?? resultType }, capturedFrom: null, mutable: true })),
    root: loweredBody, captures: [], scopes: [], asynchronous: false, generator: false, candidateLists: [], nestedBodies: [],
  });
  const name = node.name;
  return { ...headerOf(node), kind: "FunctionDeclaration", modifiers: modifiers(node.modifiers), typeParameters: null,
    parameters: { loc: node.parameters.loc, nodes: parameters.map(parameter => parameter.lowered) }, type: returnType, fullSignature: null, asteriskToken: null,
    body: loweredBody,
    name: name === null ? null : { ...headerOf(name), kind: "Identifier", text: name.text, tsonic: { core: absentCoreOf(), role: "declaration-name", declaration: { kind: "definition", definition } } },
    tsonic: { core: absentCoreOf(), parent: owner, attributes: [], memory: { kind: "available", value: null }, definition, parameters: [],
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
  const lowering: Lowering = {
    deps, raw, definitionAt, bodyOf: nodeBodies(raw.tree, moduleBody, definitionAt),
    views: new Map(raw.checkerViews.filter(view => view.node.module === raw.module).map(view => [view.node.node, view])),
    references: new Map(raw.references.filter(reference => reference.declaration.module === raw.module).map(reference => [reference.occurrence.node, reference.declaration.node])),
    locals: new Map(), bodies: [],
  };
  const tree: Hir.SourceFile<Checked> = { ...headerOf(raw.tree), kind: "SourceFile",
    statements: { loc: raw.tree.statements.loc, nodes: raw.tree.statements.nodes.map(child => statement(lowering, child, moduleDefinition)) },
    endOfFileToken: token(raw.tree.endOfFileToken), languageVariant: raw.tree.languageVariant, scriptKind: raw.tree.scriptKind,
    commentDirectives: raw.tree.commentDirectives, pragmas: raw.tree.pragmas, checkJsDirective: raw.tree.checkJsDirective,
    tsonic: { core: absentCoreOf(), parent: null, attributes: [], memory: { kind: "available", value: null }, definition: moduleDefinition, body: moduleBody } };
  const functionBodies = [...lowering.bodies];
  const bodies: Hir.HirBody[] = [{ body: moduleBody, owner: moduleDefinition, params: [], locals: [], root: tree, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: functionBodies.map(body => body.body) }, ...functionBodies]
    .sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  const items = rows.filter(row => row.node !== raw.tree.id).map(row => ({ definition: definitionOf(lowering, row.node), node: row.node }))
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  return { kind: "ok", diagnostics: [], value: { module: raw.module, tree, items, bodies, checkerDiagnostics: [], obligations: [] } };
}
