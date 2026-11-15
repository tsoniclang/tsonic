import type { ArgumentPassingFact, Diagnostic as CheckerDiagnostic, Node, ResolvedAliasTarget, Signature, SourceFile, Symbol as CheckerSymbol, Type, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
import { argumentPassingFactKey, getDiagnosticRunMembers, providerVirtualDeclarationFactKey, TypeFlagsUniqueESSymbol } from "@tsonic/tsts";
import type { CheckerDiagnosticRef, Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { ModuleId, NodeId } from "../ids/contract.js";
import { nodeId, rawCandidateListId, rawComponentId, rawMemberTableId, rawSignatureId, rawSymbolId, rawTypeId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import type { RawComponentId, RawSignatureId, RawSymbolId, RawTypeId } from "../ids/contract.js";
import type {
  CaptureDeps, CheckedProgram, RawArgumentBinding, RawAuthoredArgument, RawBinding, RawBindingTarget, RawCallSelection, RawCallableAssociation, RawCandidateList, RawCoreCapture, RawCheckedType, RawCheckerViews, RawComponent, RawComponentStep, RawDiagnosticCoverage, RawFact, RawIndexSignature, RawLiteral, RawMember, RawMemberOrigin, RawMemberKey, RawMemberTable, RawMemberUse, RawModule, RawModuleExport, RawModuleLink, RawNodeRef, RawParameter, RawPropertyName, RawProviderDeclaration, RawReference, RawSignature, RawSymbol, RawTypeArgument, RawTypeForm,
} from "./contract.js";
import { ExtensionTable, OpenedProgram } from "./handles.js";
import type { FileNumbering, FileSyntaxEntry } from "./handles.js";
import { captureNode, expressionKinds, typeNodeKinds } from "./syntax-capture.js";
import type { SyntaxCaptureContext } from "./syntax-support.js";
import { isModuleBindingKind } from "../ir-hir/index.js";
import { captureCheckerDiagnostic } from "./diagnostics.js";

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
  readonly activeTypes: Map<Type, RawTypeId>;
  nextType: number;
  nextMember: number;
  readonly pending: CaptureTask[];
}

type CaptureTask =
  | { readonly kind: "type"; readonly id: RawTypeId; readonly type: Type; readonly position: RawComponentId; readonly authoredTypeNode: RawNodeRef | null }
  | { readonly kind: "leave-type"; readonly type: Type }
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
  readonly diagnosticRoots: Map<CheckerDiagnostic, CheckerDiagnosticRef>;
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
  const ids = new Map<Node, NodeId>();
  const parents = new Map<Node, NodeId | null>();
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
  const numbering: FileNumbering = { nodes, ids, parents };
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
function capturedPropertyKey(scope: CaptureScope, node: Node | undefined): RawMemberKey | null {
  const selected = node === undefined ? undefined : scope.checker.getEffectivePropertyName(node);
  if (selected?.kind === "string") return { kind: "text", value: selected.name };
  if (selected?.kind === "numeric") {
    const value = scope.shape.getNumericLiteralTypeValue(selected.type);
    if (typeof value !== "number") return throwInvariant(invariant("A selected numeric property key requires its actual checker number evidence."));
    return { kind: "numeric", value: { kind: "checker-value", value } };
  }
  if (selected?.kind !== "unique-symbol") return null;
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

function capturedMembers(scope: CaptureScope, properties: ReturnType<TypeShapeQueries["getPropertyInfos"]>, position: RawComponentId): readonly RawMember[] | null {
  const parent = scope.tables.components[position];
  if (parent === undefined) return throwInvariant(invariant("A member inventory requires its actual captured source component."));
  const members: RawMember[] = [];
  for (let index = 0; index < properties.length; index += 1) {
    if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
    const property = properties[index];
    if (property === undefined) return throwInvariant(invariant("A selected property inventory must retain every actual row."));
    if (property.mapped !== undefined) throw new TypeError("front: mapped property origin transport requires its actual selected mapped component");
    const primary = scope.checker.getSymbolValueDeclaration(property.symbol);
    if (primary === undefined) throw new TypeError("front: a property without an actual source value declaration requires its original synthetic member association");
    const name = scope.checked.ast.name(primary);
    const key = capturedPropertyKey(scope, name);
    if (scope.meter.refusal !== null) return null;
    if (key === null) throw new TypeError("front: a member requires its actual selected source property-key evidence");
    const origin = referenceTo(scope, scope.program, primary);
    if (scope.meter.refusal !== null) return null;
    if (origin === null) return throwInvariant(invariant("A property value declaration must retain its actual admitted source identity."));
    const declarations: RawNodeRef[] = [];
    const getters: RawNodeRef[] = [];
    const setters: RawNodeRef[] = [];
    const setterNodes: Node[] = [];
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
        if (kind !== "KindVariableDeclaration" && kind !== "KindFunctionDeclaration" && kind !== "KindModuleDeclaration" && kind !== "KindPropertyDeclaration"
          && kind !== "KindPropertySignature" && kind !== "KindMethodDeclaration" && kind !== "KindMethodSignature"
          && kind !== "KindGetAccessor" && kind !== "KindSetAccessor")
          throw new TypeError(`front: property origin transport for the actual ${kind} declaration is not implemented`);
        const reference = referenceTo(scope, scope.program, source);
        if (scope.meter.refusal !== null) return null;
        if (reference === null) return throwInvariant(invariant("A property origin requires its actual admitted source declaration."));
        declarations.push(reference);
        if (kind === "KindGetAccessor") getters.push(reference);
        if (kind === "KindSetAccessor") { setters.push(reference); setterNodes.push(source); }
        method ||= kind === "KindMethodDeclaration" || kind === "KindMethodSignature";
        if (kind !== "KindSetAccessor") {
          if (!admit(scope, "facts")) return null;
          origins.push({ kind: "declaration", declaration: reference, access: "read" });
        }
        if (!property.readonly && kind !== "KindGetAccessor") {
          if (!admit(scope, "facts")) return null;
          origins.push({ kind: "declaration", declaration: reference, access: "write" });
        }
      }
    }
    if (declarations.length === 0 || !seen.has(primary))
      throw new TypeError("front: a member requires its actual declared or synthetic origin association");
    const readType = (type: Type, access: "read" | "write", declaration: RawNodeRef): RawTypeId | null => {
      for (let part = 0; part < parent.path.length; part += 1) if (!admit(scope, "edges")) return null;
      return rawType(scope, () => type, component(scope, parent.root,
        [...parent.path, { kind: "member", declaration, access }]), null);
    };
    const read = readType(property.type, "read", origin);
    if (read === null) return null;
    let write: RawTypeId | null = null;
    if (!property.readonly) {
      let type = property.type;
      let declaration = origin;
      const setter = setterNodes[0];
      if (setter !== undefined) {
        if (!admit(scope, "edges")) return null;
        const signature = scope.shape.getDeclarationSignatureInfo(setter);
        const parameter = signature?.parameters[0];
        if (signature === undefined || signature.parameters.length !== 1 || parameter === undefined)
          throw new TypeError("front: an accessor write requires its actual selected setter parameter type");
        type = parameter.type;
        declaration = setters[0] ?? throwInvariant(invariant("A selected setter retains its actual captured source declaration."));
      } else if (getters.length !== 0) throw new TypeError("front: a writable accessor requires its actual setter association");
      write = readType(type, "write", declaration);
      if (write === null) return null;
    }
    members.push({ key, name: property.name, origins, declarations, getters, setters,
      optional: property.optional, readonly: property.readonly, read: available(read), write: available(write),
      readKind: getters.length !== 0 || setters.length !== 0 ? "accessor" : method ? "method" : "property" });
  }
  return members;
}

function typeForm(scope: CaptureScope, type: Type, position: RawComponentId): RawTypeForm | null {
  const shape = scope.shape;
  const symbol = scope.checker.getTypeSymbol(type);
  const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
  for (const declaration of declarations) {
    if (!admit(scope, "edges")) return null;
    if (declaration === undefined) return throwInvariant(invariant("A type's declaration inventory cannot contain an absent row."));
    if (scope.checked.ast.kindName(declaration) !== "KindTypeParameter") continue;
    if (declarations.length !== 1)
      throw new TypeError("front: a merged type parameter requires its actual selected declaration association");
    const ast = scope.checked.ast;
    const parameter = referenceTo(scope, scope.program, declaration);
    if (scope.meter.refusal !== null) return null;
    if (parameter === null) return throwInvariant(invariant("A checked type parameter declaration must belong to the actual captured source domain."));
    const selected = ast.as.AsTypeParameterDeclaration(declaration);
    if (selected === undefined) return throwInvariant(invariant("A checked type parameter must retain its actual syntax payload."));
    const read = (node: Node | undefined): RawTypeId | null => {
      if (node === undefined) return null;
      const source = referenceTo(scope, scope.program, node);
      return source === null ? null : rawType(scope, () => scope.checker.getTypeFromTypeNode(node), component(scope, source, []), source);
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
    if (shape.isStringLike(type)) return { kind: "scalar", scalar: "string" };
    if (shape.isBigIntLike(type)) return { kind: "scalar", scalar: "bigint" };
    if (shape.isSymbolLike(type)) return { kind: "scalar", scalar: "symbol" };
    if (shape.isAny(type)) return { kind: "scalar", scalar: "any" };
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
    const members: RawTypeId[] = [];
    for (let index = 0; index < actual.length; index += 1) {
      if (!admit(scope, "edges")) return null;
      const member = actual[index];
      if (member === undefined) return throwInvariant(invariant("A checked composite type cannot contain a missing member."));
      for (let part = 0; part < parent.path.length; part += 1) if (!admit(scope, "edges")) return null;
      const path: readonly RawComponentStep[] = [...parent.path,
        { kind: kind === "union" ? "union-member" : "intersection-member", index }];
      const captured = rawType(scope, () => member, component(scope, parent.root, path), null);
      if (captured === null) return null;
      members.push(captured);
    }
    return { kind, members };
  }
  if (symbol !== undefined && declarations.length === 1) {
    const declaration = declarations[0];
    if (declaration !== undefined && scope.checked.ast.kindName(declaration) === "KindInterfaceDeclaration") {
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
      const parent = scope.tables.components[position];
      if (parent === undefined) return throwInvariant(invariant("A declared type requires its actual captured component."));
      const arguments_: RawTypeArgument[] = [];
      for (let index = 0; index < infos.length; index += 1) {
        if (!admit(scope, "edges")) return null;
        const info = infos[index];
        const parameter = parameters[index];
        if (info === undefined || parameter === undefined) return throwInvariant(invariant("An interface's checked arguments must match its actual ordered parameters."));
        for (let part = 0; part < parent.path.length; part += 1) if (!admit(scope, "edges")) return null;
        const argument = rawType(scope, () => info.argument,
          component(scope, parent.root, [...parent.path, { kind: "argument-place", index }]), null);
        if (argument === null) return null;
        arguments_.push({ parameter, declaration: null, argument: available(argument), explicitTypeNode: null, defaultTypeNode: null, scope: info.scope });
      }
      if (arguments_.length !== parameters.length) return throwInvariant(invariant("Every selected interface parameter requires its actual checked argument."));
      return { kind: "declared", declaration: source, facet: "instance", parameters, arguments: arguments_, definition: null,
        extent: scope.emptyCoreInventory ? available(null) : notProvided() };
    }
  }
  const calls = shape.getCallSignatures(type);
  const constructs = shape.getConstructSignatures(type);
  const selectedIndexes = shape.getIndexInfos(type);
  if (!admit(scope, "edges")) return null;
  const properties = shape.getPropertyInfos(type);
  if (calls.length !== 0 || constructs.length !== 0 || selectedIndexes.length !== 0 || properties.length !== 0) {
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
    const indexes: RawIndexSignature[] = [];
    const parent = scope.tables.components[position];
    if (parent === undefined) return throwInvariant(invariant("An index inventory requires its actual captured type component."));
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
      for (let part = 0; part < parent.path.length; part += 1) if (!admit(scope, "edges")) return null;
      const key = rawTypeId(scope.tables.nextType);
      const capturedKey = rawType(scope, () => selected.keyType,
        component(scope, parent.root, [...parent.path, { kind: "index-key", origin, key }]), null);
      if (capturedKey === null) return null;
      if (capturedKey !== key) return throwInvariant(invariant("An index selector must retain its actual captured row key."));
      for (let part = 0; part < parent.path.length; part += 1) if (!admit(scope, "edges")) return null;
      const value = rawType(scope, () => selected.valueType,
        component(scope, parent.root, [...parent.path, { kind: "index-value", origin, key }]), null);
      if (value === null) return null;
      indexes.push({ origin, key, value, readonly: selected.readonly });
    }
    const members = capturedMembers(scope, properties, position);
    if (members === null) return null;
    scope.tables.members[inventory] = { id: inventory, component: position, members, indexes, elementBinders: available([]),
      calls: callSignatures, constructs: constructSignatures };
    return { kind: "structure", inventory };
  }
  throw new TypeError(`front: the captured form of the checker type ${scope.checker.typeToString(type)} is not implemented`);
}

function capturedMemberUse(scope: CaptureScope, node: Node, occurrence: RawNodeRef): RawMemberUse | null {
  if (!admit(scope, "facts")) return null;
  const info = scope.checker.getResolvedPropertyAccessInfo(node);
  if (info === undefined || info.kind !== "member" || info.expression !== node)
    throw new TypeError("front: a property access requires its actual selected member answer");
  if (info.optionalChain || info.selectedIndex !== undefined)
    throw new TypeError("front: selected optional or index-backed property transport is not implemented");
  const receiver = referenceTo(scope, scope.program, info.receiver.expression);
  if (scope.meter.refusal !== null) return null;
  if (receiver === null) return throwInvariant(invariant("A selected member receiver requires its actual source occurrence."));
  const receiverComponent = component(scope, receiver, []);
  const receiverType = rawType(scope, () => info.receiver.type, receiverComponent, null);
  if (receiverType === null || receiverComponent === null) return null;
  captureFacts(scope);
  if (scope.meter.refusal !== null) return null;
  const form = scope.tables.types[receiverType]?.form;
  if (form?.kind !== "available" || form.value.kind !== "structure")
    throw new TypeError("front: selected member transport requires its actual receiver member inventory");
  const inventory = scope.tables.members[form.value.inventory];
  if (inventory === undefined) return throwInvariant(invariant("A selected member retains its actual receiver inventory."));
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
  let memberIndex: number | null = null;
  for (let index = 0; index < inventory.members.length; index += 1) {
    if (!admit(scope, "edges")) return null;
    const member = inventory.members[index];
    if (member === undefined) return throwInvariant(invariant("A selected member inventory must be dense."));
    for (const declaration of member.declarations) {
      if (!admit(scope, "edges")) return null;
      if (declaration.module !== selected.module || declaration.node !== selected.node) continue;
      if (memberIndex !== null && memberIndex !== index)
        return throwInvariant(invariant("The selected declaration cannot identify competing receiver members."));
      memberIndex = index;
    }
  }
  if (memberIndex === null) throw new TypeError("front: the selected declaration is missing from its actual receiver member inventory");
  const readDeclaration = source(info.selectedReadDeclaration);
  if (scope.meter.refusal !== null) return null;
  const writeDeclaration = source(info.selectedWriteDeclaration);
  if (scope.meter.refusal !== null) return null;
  const read = info.sourceReadType === undefined ? null : component(scope, occurrence, []);
  if (scope.meter.refusal !== null) return null;
  if (info.sourceReadType !== undefined && rawType(scope, () => info.sourceReadType, read, null) === null) return null;
  const write = info.sourceWriteType === undefined ? null : component(scope, occurrence, []);
  if (scope.meter.refusal !== null) return null;
  if (info.sourceWriteType !== undefined && rawType(scope, () => info.sourceWriteType, write, null) === null) return null;
  if (!admit(scope, "facts") || !admit(scope, "edges")) return null;
  const member = inventory.members[memberIndex];
  if (member === undefined) return throwInvariant(invariant("The selected member row must remain in its actual inventory."));
  const readDeclarations = readDeclaration === null ? [] : [readDeclaration];
  const writeDeclarations = writeDeclaration === null ? [] : [writeDeclaration];
  return { occurrence, receiver, receiverComponent, key: null, access: info.accessMode, callCallee: info.callCallee,
    optionalChain: info.optionalChain, chainContinuation: false, selectedDeclaration: selected,
    selectedDeclarations: member.declarations, readDeclarations, writeDeclarations, read, write,
    arms: [{ kind: "member", receiver: receiverComponent, member: { table: inventory.id, index: memberIndex },
      readDeclarations, writeDeclarations }] };
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
  if (!admit(scope, "facts")) return null;
  return { node: reference, identity: { module: provider, exportId: fact.exportId,
    memberId: fact.memberId ?? null, signatureId: fact.signatureId ?? null }, wellKnownDeclaration: notProvided() };
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
    if (next.kind === "leave-type") {
      scope.tables.activeTypes.delete(next.type);
    } else if (next.kind === "signature") captureSignature(scope, next.id, next.signature, next.owner, next.signatureKind);
    else if (next.kind === "signature-parameter") captureSignatureParameter(scope, next.draft, next.index);
    else {
      const ancestor = scope.tables.activeTypes.get(next.type);
      let form: RawFact<RawTypeForm>;
      let literal: RawLiteral | null = null;
      if (scope.shape.isError(next.type)) form = { kind: "unavailable", reason: "missing-original-component", causes: [] };
      else {
        const boolean = scope.shape.getBooleanLiteralTypeValue(next.type);
        const string = scope.shape.getStringLiteralTypeValue(next.type);
        if (boolean !== undefined) literal = { kind: "boolean", value: boolean };
        else if (string !== undefined) literal = { kind: "string", value: string };
        else if ((next.type.flags & TypeFlagsUniqueESSymbol) !== 0) {
          const symbol = scope.checker.getTypeSymbol(next.type);
          const declarations = symbol === undefined ? [] : scope.checker.getSymbolDeclarations(symbol);
          if (!admit(scope, "edges")) return;
          const declaration = declarations[0];
          if (declarations.length !== 1 || declaration === undefined)
            return throwInvariant(invariant("A unique symbol must retain its one actual checked declaration."));
          const source = referenceTo(scope, scope.program, declaration);
          if (scope.meter.refusal !== null) return;
          if (source === null) return throwInvariant(invariant("A unique symbol's declaration must belong to the admitted source domain."));
          literal = { kind: "symbol", declaration: source };
        }
        const base = literal === null ? next.type : scope.shape.getBaseTypeOfLiteralType(next.type);
        if (base === undefined) return throwInvariant(invariant("A captured literal type requires its actual SDK base type."));
        let captured: RawTypeForm | null;
        if (ancestor === undefined) {
          scope.tables.activeTypes.set(next.type, next.id);
          scope.tables.pending.push({ kind: "leave-type", type: next.type });
          captured = typeForm(scope, base, next.position);
        } else {
          const original = scope.tables.types[ancestor];
          if (original?.form.kind !== "available")
            return throwInvariant(invariant("A native type backedge requires its actual available captured ancestor form."));
          captured = original.form.value;
        }
        if (captured === null) return;
        form = available(captured);
      }
      scope.tables.types[next.id] = {
        id: next.id, component: next.position, authoredTypeNode: next.authoredTypeNode, declaration: null, definitionOwner: null, definitionFacet: null,
        definitionParameters: available([]), alias: available(null), instantiatedBases: available([]), literal: available(literal),
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
  if (symbol === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
  const step = scope.checker.getAliasStep(symbol);
  if (step === undefined) return { kind: "unavailable", reason: "incomplete-association", causes: [] };
  if (step.kind === "unresolved") return aliasFailure(scope, step.cause);
  const targetSymbol = step.kind === "symbol" ? step.symbol : step.exportAssignment;
  return symbolTarget(scope, targetSymbol, step.kind === "exported-value-member" ? step.member : null);
}

function aliasFailure(scope: CaptureScope, diagnostic: CheckerDiagnostic): Extract<RawFact<never>, { readonly kind: "unavailable" }> | null {
  if (!admit(scope, "facts")) return null;
  const root = scope.diagnosticRoots.get(diagnostic);
  if (root === undefined) return throwInvariant(invariant("An actual alias failure must retain membership in its original published checker diagnostic run."));
  return { kind: "unavailable", reason: "checker-error", causes: [{ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: root } }] };
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
    const failed = memberTarget?.kind === "unresolved" ? aliasFailure(scope, memberTarget.cause) : null;
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
  const displacement = input.displacement;
  // The syntax capture takes each node's identity from the numbering, and must reach the nodes in its order.
  const context: SyntaxCaptureContext = { ast, file, module, displacement, numbering: own.numbering };
  const tree = captureNode(context, file, null);
  if (tree.kind !== "SourceFile") return throwInvariant(invariant("A module's captured tree is not a source file."));
  const queries = checked.getSourceFileQueries(file);
  const scope: CaptureScope = { deps, program, path, meter: { facts: 0, edges: 0, refusal: null }, module, file, checked, checker: queries.checker,
    shape: queries.typeShape, ownNodes, emptyCoreInventory: closedInventoryEmpty(program), diagnosticRoots: new Map(),
    tables: { types: [], components: [], signatures: [], members: [], candidates: [], symbols: [], symbolIds: new Map(), signatureIds: new Map(), activeTypes: new Map(), nextType: 0, nextMember: 0, pending: [] } };
  const checkerDiagnostics: Diagnostic[] = [];
  const diagnosticCoverage: RawDiagnosticCoverage[] = [];
  for (const diagnostic of checked.diagnostics) {
    if (diagnostic === undefined) return throwInvariant(invariant("The checker returned an absent published diagnostic."));
    if (diagnostic.file !== file) continue;
    const captured = captureCheckerDiagnostic(program, diagnostic, () => admit(scope, "facts"));
    if (captured === null) break;
    const index = checkerDiagnostics.length;
    checkerDiagnostics.push(captured);
    const members = getDiagnosticRunMembers(diagnostic);
    for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
      if (!admit(scope, "facts")) break;
      const member = members[memberIndex];
      if (member === undefined) return throwInvariant(invariant("A published checker diagnostic run cannot contain an absent original member."));
      if (scope.diagnosticRoots.has(member)) return throwInvariant(invariant("An original checker diagnostic cannot belong to two published roots."));
      scope.diagnosticRoots.set(member, { module, index });
    }
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
  const propertyNames: RawPropertyName[] = [];
  const memberUses: RawMemberUse[] = [];
  let declarationNameRoot: NodeId | null = null;
  capture: for (const [index, node] of nodes.entries()) {
    const reference: RawNodeRef = { module, node: nodeId(index) };
    const kind = ast.kindName(node);
    const parent = ast.parent(node);
    const parentId = own.numbering.parents.get(node);
    if (declarationNameRoot !== null && (parentId === null || parentId === undefined || parentId < declarationNameRoot)) declarationNameRoot = null;
    const declarationName = parent !== undefined && ast.name(parent) === node;
    if (kind === "KindComputedPropertyName") {
      if (parent !== undefined && (ast.kindName(parent) === "KindPropertySignature" || ast.kindName(parent) === "KindMethodSignature"))
        declarationNameRoot = reference.node;
      if (!admit(scope, "facts")) break;
      const selected = capturedPropertyKey(scope, node);
      let key: RawFact<RawMemberKey | null> = { kind: "unavailable", reason: "missing-original-component", causes: [] };
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
    if (kind === "KindVariableDeclaration") {
      const read = rawType(scope, () => scope.checker.getTypeAtLocation(node), component(scope, reference, []), null);
      if (read === null) break;
      const name = ast.name(node);
      const symbol = name === undefined ? undefined : scope.checker.getSymbolAtLocation(name);
      const symbolId = symbol === undefined ? null : rawSymbol(scope, symbol);
      if (symbol !== undefined && symbolId === null) break;
      if (!admit(scope, "facts")) break;
      views.push({ node: reference, read: available(read), declared: available(null), contextual: available(null), symbol: available(symbolId) });
    }
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
    if (typeNodeKinds.includes(kind.replace(/^Kind/u, "")) &&
      rawType(scope, () => scope.checker.getTypeFromTypeNode(node), component(scope, reference, []), reference) === null) break;
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
    if (kind === "KindPropertyAccessExpression" && declarationNameRoot === null) {
      const use = capturedMemberUse(scope, node, reference);
      if (use === null) break;
      memberUses.push(use);
    }
    if (kind === "KindCallExpression") {
      const call = captureCall(scope, node, reference);
      if (call === null) break;
      calls.push(call);
    }
  }
  const core: RawCoreCapture[] = [];
  const providerDeclarations: RawProviderDeclaration[] = [];
  for (const [node, id] of ownNodes) {
    if (!admit(scope, "facts")) break;
    const reference = { module, node: id };
    const provider = providerDeclaration(scope, node, reference);
    if (provider === null) break;
    if (provider !== undefined) {
      providerDeclarations.push(provider);
    }
    const base = coreFacts(reference, scope.emptyCoreInventory);
    const row = provider === undefined ? base : { ...base, provider: available(provider.identity) };
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
    checkerViews: views, calls, callableAssociations: associations, providerDeclarations, references, links, exports, bindings,
    implementations: [], heritage: [], constructors: [], enums: [], propertyNames, memberUses, protocols: [], storage: [], core,
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
