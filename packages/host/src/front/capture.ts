import type { Node, Signature, SourceFile, Symbol as CheckerSymbol, Type, TypeCheckerQueries, TypeShapeQueries } from "@tsonic/tsts";
import type { InvariantFailure, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { ModuleId, NodeId } from "../ids/contract.js";
import { nodeId, rawComponentId, rawSignatureId, rawSymbolId, rawTypeId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import type { RawComponentId, RawSignatureId, RawSymbolId, RawTypeId } from "../ids/contract.js";
import type {
  CaptureDeps, CheckedProgram, RawCallableAssociation, RawCoreCapture, RawCheckedType, RawCheckerViews, RawComponent, RawComponentStep, RawFact, RawModule, RawModuleExport, RawNodeRef, RawParameter, RawReference, RawSignature, RawSymbol, RawTypeForm,
} from "./contract.js";
import { ExtensionTable, OpenedProgram } from "./handles.js";
import { captureNode, expressionKinds } from "./syntax-capture.js";
import type { SyntaxCaptureContext } from "./syntax-support.js";

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
  readonly symbols: RawSymbol[];
  readonly symbolIds: Map<CheckerSymbol, RawSymbolId>;
  readonly signatureIds: Map<Signature, RawSignatureId>;
}

interface CaptureScope {
  readonly module: ModuleId;
  readonly file: SourceFile;
  readonly checked: OpenedProgramView;
  readonly checker: TypeCheckerQueries;
  readonly shape: TypeShapeQueries;
  readonly ownNodes: ReadonlyMap<Node, NodeId>;
  readonly tables: CaptureTables;
  readonly otherNodes: Map<SourceFile, ReadonlyMap<Node, NodeId>>;
}

type OpenedProgramView = ReturnType<typeof OpenedProgram.checked>;

/** The preorder identities of a file's nodes, in the order HIR numbers them (the checker's child order). */
function preorderOf(scope: Pick<CaptureScope, "checked">, file: SourceFile): ReadonlyMap<Node, NodeId> {
  const ast = scope.checked.ast;
  const ids = new Map<Node, NodeId>();
  const visit = (node: Node): void => {
    ids.set(node, nodeId(ids.size));
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return ids;
}

function moduleOfFile(program: CheckedProgram, file: SourceFile, ast: OpenedProgramView["ast"]): ModuleId | undefined {
  return OpenedProgram.modules(program).get(ast.getFileName(file));
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
  let ids = scope.otherNodes.get(file);
  if (ids === undefined) {
    ids = preorderOf(scope, file);
    scope.otherNodes.set(file, ids);
  }
  const other = ids.get(declaration);
  return other === undefined ? null : { module, node: other };
}

function component(scope: CaptureScope, root: RawNodeRef, path: readonly RawComponentStep[]): RawComponentId {
  const id = rawComponentId(scope.tables.components.length);
  scope.tables.components.push({ id, root, path });
  return id;
}

/**
 * The captured form of a checker type. The forms written so far are the scalar ones; any other form is a defect of
 * this capture's development frontier (a compiler defect, never a user diagnostic), named with the checker's own
 * text of the type.
 */
function typeForm(scope: CaptureScope, type: Type): RawTypeForm {
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
  throw new TypeError(`front: the captured form of the checker type ${scope.checker.typeToString(type)} is not implemented`);
}

/**
 * Whether the selected inventory that core facts come from is closed and empty: the snapshot's library roles, the
 * loaded semantics modules' exports, and the safety and declaration providers of its contributions. Every core fact
 * of a node (markers, pointers, layouts, bindings, attributes, safety, argument passing, flow state, provider) is
 * supplied by an entry of that inventory; with none, each one's absence is proven for every node. With any entry,
 * no fact is proven by this capture yet: each stays not provided, never defaulted (K-3313.2).
 */
function closedInventoryEmpty(program: CheckedProgram): boolean {
  const roles = OpenedProgram.libraryData(program).flatMap(entry => entry.roles);
  const exports = ExtensionTable.semantics(OpenedProgram.table(program)).flatMap(module => module.exports);
  const contributions = OpenedProgram.contributions(program);
  return roles.length === 0 && exports.length === 0 && contributions.safetyProviders.length === 0 && contributions.declarationProviders.length === 0;
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
function rawType(scope: CaptureScope, type: Type | undefined, position: RawComponentId, authoredTypeNode: RawNodeRef | null): RawTypeId {
  if (type === undefined) return throwInvariant(invariant("The checker returned no type at a position that has one."));
  const id = rawTypeId(scope.tables.types.length);
  const form = typeForm(scope, type);
  scope.tables.types.push({
    id, component: position, authoredTypeNode, declaration: null, definitionOwner: null, definitionFacet: null,
    definitionParameters: available([]), alias: available(null), instantiatedBases: available([]), literal: available(null),
    primitive: notProvided(), form: available(form),
  });
  return id;
}

function rawSymbol(scope: CaptureScope, program: CheckedProgram, symbol: CheckerSymbol): RawSymbolId {
  const known = scope.tables.symbolIds.get(symbol);
  if (known !== undefined) return known;
  const id = rawSymbolId(scope.tables.symbols.length);
  scope.tables.symbolIds.set(symbol, id);
  const declarations = scope.checker.getSymbolDeclarations(symbol).flatMap(declaration => {
    const reference = declaration === undefined ? null : referenceTo(scope, program, declaration);
    return reference === null ? [] : [reference];
  });
  scope.tables.symbols.push({ id, name: scope.checker.getSymbolName(symbol), declarations, aliasTarget: available(null), exports: available([]) });
  return id;
}

function rawSignature(scope: CaptureScope, program: CheckedProgram, signature: Signature, owner: RawNodeRef): RawSignatureId {
  const known = scope.tables.signatureIds.get(signature);
  if (known !== undefined) return known;
  const id = rawSignatureId(scope.tables.signatures.length);
  scope.tables.signatureIds.set(signature, id);
  const declarationNode = scope.checker.getSignatureDeclaration(signature);
  const declaration = declarationNode === undefined ? null : referenceTo(scope, program, declarationNode);
  const parameters = scope.checker.getSignatureParameters(signature).map((symbol, index): RawParameter => {
    if (symbol === undefined) return throwInvariant(invariant("The checker returned an absent parameter symbol."));
    const declarations = scope.checker.getSymbolDeclarations(symbol);
    const parameterNode = declarations[0];
    const parameterReference = parameterNode === undefined ? null : referenceTo(scope, program, parameterNode);
    const position = component(scope, owner, [{ kind: "parameter", signature: id, index }]);
    return {
      declaration: parameterReference, symbol: rawSymbol(scope, program, symbol), kind: "required", component: position,
      type: rawType(scope, scope.checker.getTypeOfSymbol(symbol), position, null), acceptsOmission: false, initializer: null, passing: notProvided(),
    };
  });
  scope.tables.signatures.push({
    id, target: null, owner, declaration, kind: "call", typeParameters: available([]), receiver: available(null), parameters,
    result: available(rawType(scope, scope.checker.getReturnTypeOfSignature(signature), component(scope, owner, [{ kind: "result", signature: id }]), null)),
    composition: null,
  });
  return id;
}

/**
 * The raw capture of one module of the opened program: its syntax tree in HIR's syntax phase and the checker's
 * evidence about it. The categories of evidence written so far are those the checked annotations written so far
 * read: the views of expressions, the references of identifier uses, the symbols and signatures they name, the
 * callable associations of function declarations, and the module's export entries; the other tables are empty, and
 * lowering refuses a module that holds a kind whose checked annotation is not written (one check, in lowerModule).
 */
export function captureRawModule(deps: CaptureDeps, program: CheckedProgram, module: ModuleId): Result<RawModule> {
  if (OpenedProgram.table(program) !== deps.extensions) throw new TypeError("front: the extension table is not the one the program was opened with");
  const checked = OpenedProgram.checked(program);
  const ast = checked.ast;
  let path: string | undefined;
  OpenedProgram.modules(program).forEach((candidate, filePath) => { if (candidate === module) path = filePath; });
  const file = path === undefined ? undefined : checked.getSourceFile(path);
  if (path === undefined || file === undefined) throw new TypeError("front: the module is not a module of the opened program's snapshot");
  const original = OpenedProgram.texts(program).get(path);
  const delivered = ast.getSourceText(file);
  if (original === undefined) return throwInvariant(invariant("A module of the opened program has no captured text."));
  const displacement = original.length - delivered.length;
  if (displacement < 0 || original.slice(displacement) !== delivered) return throwInvariant(invariant("The checker's text of a module does not join its captured text."));
  if (checked.diagnostics.some(diagnostic => diagnostic !== undefined && diagnostic.file === file))
    throw new TypeError("front: the conversion of a module's checker diagnostics waits for the checker's message accessor");
  const nodes: Node[] = [];
  const context: SyntaxCaptureContext = { ast, file, module, displacement, next: node => { nodes.push(node); return nodeId(nodes.length - 1); } };
  const tree = captureNode(context, file, null);
  if (tree.kind !== "SourceFile") return throwInvariant(invariant("A module's captured tree is not a source file."));
  const ownNodes = new Map<Node, NodeId>(nodes.map((node, index) => [node, nodeId(index)]));
  const queries = checked.getSourceFileQueries(file);
  const scope: CaptureScope = { module, file, checked, checker: queries.checker, shape: queries.typeShape, ownNodes,
    tables: { types: [], components: [], signatures: [], symbols: [], symbolIds: new Map(), signatureIds: new Map() }, otherNodes: new Map() };
  const views: RawCheckerViews[] = [];
  const references: RawReference[] = [];
  const associations: RawCallableAssociation[] = [];
  nodes.forEach((node, index) => {
    const reference: RawNodeRef = { module, node: nodeId(index) };
    const kind = ast.kindName(node);
    const parent = ast.parent(node);
    const declarationName = parent !== undefined && ast.name(parent) === node;
    if (expressionKinds.includes(kind.replace(/^Kind/u, "")) && !declarationName) {
      const contextual = scope.checker.getContextualType(node);
      const symbol = scope.checker.getSymbolAtLocation(node);
      views.push({
        node: reference,
        read: available(rawType(scope, scope.checker.getTypeAtLocation(node), component(scope, reference, []), null)),
        declared: available(null),
        contextual: available(contextual === undefined ? null : rawType(scope, contextual, component(scope, reference, []), null)),
        symbol: available(symbol === undefined ? null : rawSymbol(scope, program, symbol)),
      });
      if (kind === "KindIdentifier" && symbol !== undefined) {
        scope.checker.getSymbolDeclarations(symbol).forEach(declaration => {
          const target = declaration === undefined ? null : referenceTo(scope, program, declaration);
          if (target !== null) references.push({ occurrence: reference, meaning: "value", declaration: target, module: target.module,
            project: target.module === module || OpenedProgram.modules(program).has(ast.getFileName(ast.getSourceFile(declaration) ?? file)) });
        });
      }
    }
    // An authored type annotation (the type child of its declaration): the type the checker gives that type node.
    if (parent !== undefined && ast.typeNode(parent) === node)
      rawType(scope, scope.checker.getTypeFromTypeNode(node), component(scope, reference, []), reference);
    if (callableKinds.includes(kind)) {
      const signature = scope.checker.getSignatureFromDeclaration(node);
      if (signature === undefined) return throwInvariant(invariant("The checker gave no signature for a callable declaration."));
      const advertised = rawSignature(scope, program, signature, reference);
      const body = ast.body(node);
      const parameters = ast.parameters(node).flatMap(parameter => {
        const id = parameter === undefined ? undefined : ownNodes.get(parameter);
        return id === undefined ? [] : [{ module, node: id }];
      });
      const bodyReference = body === undefined ? undefined : ownNodes.get(body);
      associations.push({
        declaration: reference, advertised: [advertised],
        body: bodyReference === undefined ? notProvided() : available({ module, node: bodyReference }),
        classParameters: available([]), advertisedParameters: [{ signature: advertised, parameters: available(parameters) }],
        bodyParameters: available(parameters), captures: available([]),
      });
    }
  });
  const empty = closedInventoryEmpty(program);
  const core = [...ownNodes.values()].map(id => coreFacts({ module, node: id }, empty));
  const exports: RawModuleExport[] = [];
  const moduleSymbol = scope.checker.getSymbolAtLocation(file);
  if (moduleSymbol !== undefined) scope.checker.getExportsOfModule(moduleSymbol).forEach(exported => {
    if (exported === undefined) return;
    scope.checker.getSymbolDeclarations(exported).forEach(declaration => {
      const target = declaration === undefined ? null : referenceTo(scope, program, declaration);
      if (target !== null) exports.push({ name: scope.checker.getSymbolName(exported), declaration: target, module: target.module });
    });
  });
  const raw: RawModule = {
    module, tree,
    types: { types: scope.tables.types, components: scope.tables.components, signatures: scope.tables.signatures, members: [],
      symbols: scope.tables.symbols, candidates: [], dataLayouts: [], memoryLayouts: [], memoryFields: [] },
    checkerViews: views, calls: [], callableAssociations: associations, providerDeclarations: [], references, links: [], exports,
    implementations: [], heritage: [], constructors: [], enums: [], propertyNames: [], memberUses: [], protocols: [], storage: [], core,
    checkerDiagnostics: [], diagnosticCoverage: [],
  };
  return { kind: "ok", value: raw, diagnostics: [] };
}

/** The tree's kinds, for the one check of lowering (re-exported so lowering and capture name one source). */
export type CapturedTree = Hir.SourceFile<Hir.SyntaxPhase>;
