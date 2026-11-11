import type { Violation } from "../diag/contract.js";
import type { BodyId, DefId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { ExactRational, LiteralTypeValue, LiteralValue } from "../ir-types/contract.js";
import { encodeDefId } from "../ids/index.js";
import type { AwaitExpression, BinaryOperator, CheckedPhase, DeclarationKind, ForInStatement, ForOfStatement, HirBinaryOperator, HirBody, HirCandidateList, HirModule, HirNode, HirRule, HirSite, HirUnaryOperator, HirVerificationContext, SpreadElement, VerifyHir, YieldExpression } from "./contract.js";
import type { HirDataRoot, HirInventory, HirNodeEntry, HirReport } from "./verify-syntax.js";
import { walkHirData } from "./verify-syntax.js";
import { hirBodyData, hirDiagnosticsData, hirItemsData, hirNodeData, hirObligationsData } from "./text-data.js";
import { createHirIdentityPaths, hirLexicalBodyRanges, localSourceEntry, localSourceNode, sourceNodeExists, sourceNodeData, validHirIndex, verifyBindingVectors, verifyHirReferences } from "./verify-bindings.js";
import type { HirBindingRequest, HirIdentityPaths } from "./verify-bindings.js";
import { createHirSchema, verifyHirCaptures, verifyHirPlaces } from "./verify-captures.js";
import type { HirCaptureReaders } from "./verify-captures.js";
import { syntaxChildEdges } from "./children.js";
import { hirChildPath, hirDataPathText } from "./walk.js";
import type { HirDataPath } from "./walk.js";

type NodeFrame = (
  | { readonly kind: "enter"; readonly node: HirNode; readonly parent: HirNodeEntry | null; readonly path: HirDataPath; readonly member: boolean }
  | { readonly kind: "leave"; readonly node: HirNode; readonly entry: HirNodeEntry | null }
) & { readonly next: NodeFrame | null };

export function createHirInventory(module: HirModule): HirInventory {
  const nodes: HirNode[] = [];
  const entries: HirNodeEntry[] = [];
  const entriesByNode = new Map<HirNode, HirNodeEntry>();
  const nodesById = new Map<number, HirNode>();
  const entriesById = new Map<number, HirNodeEntry>();
  const receivers: { readonly access: HirNodeEntry; readonly expression: HirNodeEntry }[] = [];
  const recordReceiver = (parent: HirNodeEntry | null, child: HirNodeEntry): void => {
    if (parent !== null && (parent.node.kind === "PropertyAccessExpression" || parent.node.kind === "ElementAccessExpression") &&
      parent.node.expression === child.node) receivers.push({ access: parent, expression: child });
  };
  const starts = new Map<HirNode, number>();
  const ends = new Map<HirNode, number>();
  const parents = new Map<HirNode, HirNode | null>();
  const owners = new Map<HirNode, HirBody>();
  const itemOwners = new Map<HirNode, DefId>();
  const itemDefinitions = new Map<number, DefId>();
  for (const item of module.items) if (!itemDefinitions.has(item.node)) itemDefinitions.set(item.node, item.definition);
  const bodies = new Map<BodyId, HirBody>();
  const roots = new Map<HirNode, HirBody>();
  const bodyParents = new Map<HirBody, HirBody | null>();
  const repeated: HirNodeEntry[] = [];
  const active = new Set<HirNode>();
  const outside = new Set<HirNode>();
  for (const body of module.bodies) {
    if (!bodies.has(body.body)) bodies.set(body.body, body);
    if (!roots.has(body.root)) roots.set(body.root, body);
  }
  const bodyRoots = module.bodies.reduceRight<NodeFrame | null>((next, body, index) => ({
    kind: "enter", node: body.root, parent: null, member: false,
    path: hirChildPath({ parent: null, field: "bodies" }, [index, "root"]), next,
  }), null);
  let pending: NodeFrame | null = { kind: "enter", node: module.tree, parent: null, member: true,
    path: { parent: null, field: "tree" }, next: bodyRoots };
  while (pending !== null) {
    const frame = pending;
    pending = pending.next;
    if (frame.kind === "leave") {
      active.delete(frame.node);
      if (frame.entry === null) continue;
      frame.entry.end = nodes.length;
      ends.set(frame.entry.node, nodes.length);
      const parent = frame.entry.parent;
      if (parent !== null && parent.body === frame.entry.body) {
        parent.required[0] += frame.entry.required[0];
        parent.required[1] += frame.entry.required[1];
        parent.required[2] += frame.entry.required[2];
      }
      continue;
    }
    if (active.has(frame.node)) throw new TypeError(`Syntax child cycle at ${hirDataPathText(frame.path)}`);
    const previous = entriesByNode.get(frame.node);
    if (previous !== undefined) {
      if (frame.member) { repeated.push(previous); recordReceiver(frame.parent, previous); }
      continue;
    }
    if (!frame.member) {
      if (outside.has(frame.node)) continue;
      outside.add(frame.node);
      active.add(frame.node);
      pending = syntaxChildEdges(frame.node).reduceRight<NodeFrame | null>((next, child) => ({
        kind: "enter", node: child.node, parent: null, member: false,
        path: hirChildPath(frame.path, child.fields), next,
      }), { kind: "leave", node: frame.node, entry: null, next: pending });
      continue;
    }
    const declaredBody = roots.get(frame.node);
    const inheritedBody = frame.parent === null ? null : frame.parent.body;
    const body = declaredBody ?? inheritedBody;
    const item = itemDefinitions.get(frame.node.id) ?? (frame.parent === null ? module.tree.tsonic.definition : frame.parent.item);
    if (declaredBody !== undefined) bodyParents.set(declaredBody, inheritedBody);
    const entry: HirNodeEntry = { node: frame.node, ordinal: nodes.length, parent: frame.parent, body, item,
      source: body === null ? { kind: "item", value: { owner: item, node: frame.node.id } } :
        { kind: "body", value: { body: body.body, node: frame.node.id } }, end: nodes.length,
      required: [Number(writeFitOf(frame.node) !== null), Number(operationOf(frame.node) !== null),
        Number(frame.node.kind === "ElementAccessExpression")] };
    entriesByNode.set(frame.node, entry);
    active.add(frame.node);
    entries.push(entry);
    recordReceiver(frame.parent, entry);
    starts.set(frame.node, nodes.length);
    parents.set(frame.node, frame.parent === null ? null : frame.parent.node);
    itemOwners.set(frame.node, item);
    nodes.push(frame.node);
    if (!nodesById.has(frame.node.id)) {
      nodesById.set(frame.node.id, frame.node);
      entriesById.set(frame.node.id, entry);
    }
    if (body !== null) owners.set(frame.node, body);
    const following: NodeFrame = { kind: "leave", node: frame.node, entry, next: pending };
    pending = syntaxChildEdges(frame.node).reduceRight<NodeFrame | null>((next, child) => ({
      kind: "enter", node: child.node, parent: entry, member: true, path: hirChildPath(frame.path, child.fields), next,
    }), following);
  }
  return { nodes: Object.freeze(nodes), entries: Object.freeze(entries), nodesById, entriesById, receivers: Object.freeze(receivers),
    starts, ends, parents, owners, itemOwners, bodies, bodyParents,
    repeated: Object.freeze(repeated) };
}

function containsHirNode(outer: HirNodeEntry, inner: HirNodeEntry): boolean {
  return inner.ordinal >= outer.ordinal && inner.ordinal < outer.end;
}

function validRange(start: number, end: number): boolean {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 &&
    !Object.is(start, -0) && !Object.is(end, -0) && end >= start;
}

function syntaxViolations(module: HirModule, inventory: HirInventory, report: HirReport): void {
  inventory.entries.forEach(entry => {
    const { node, ordinal, parent, body } = entry;
    const site: HirSite = { kind: "node", node: entry.source };
    if (!Object.is(node.id, ordinal)) report("node-dense-preorder", site, "id must equal module preorder position");
    if (!Object.is(node.parent, parent === null ? null : parent.node.id)) report("lexical-parent", site, "parent must be the actual syntactic parent");
    if (node.origin.module !== module.module) report("module-owner", site, "origin must name this module");
    if (!validRange(node.loc.pos, node.loc.end)) report("origin-range", site, "invalid syntax range");
    if (!validHirIndex(node.origin.length) || !validRange(node.origin.start, node.origin.start + node.origin.length))
      report("origin-range", site, "invalid origin range");
    if (body !== null && (node.loc.pos < body.root.loc.pos || node.loc.end > body.root.loc.end))
      report("node-in-body-range", site, "syntax must remain inside its body root range");
    if (node.kind === "LiteralType" && node.literal.kind === "PrefixUnaryExpression" &&
      ((node.literal.operator !== "PlusToken" && node.literal.operator !== "MinusToken") ||
        (node.literal.operand.kind !== "NumericLiteral" && node.literal.operand.kind !== "BigIntLiteral")))
      report("literal-type-child", site, "literal unary child requires a numeric literal and unary plus or minus");
  });
  for (const entry of inventory.repeated)
    report("node-dense-preorder", { kind: "node", node: entry.source }, "syntax node occurs more than once");
}

function declarationViolations(module: HirModule, inventory: HirInventory, paths: HirIdentityPaths, report: HirReport): void {
  const seen = new Set<string>();
  const definitions = new Set<DefId>([module.tree.tsonic.definition, ...module.items.map(item => item.definition)]);
  let previous: string | null = null;
  for (const item of module.items) {
    const site: HirSite = { kind: "definition", definition: item.definition };
    if (seen.has(item.definition)) report("definition-unique", site, "definition occurs more than once");
    seen.add(item.definition);
    if (previous !== null && item.definition <= previous) report("stable-order", site, "definitions must be in identity order");
    previous = item.definition;
    const path = paths.definitionPathOf(item.definition);
    if (path.kind === "known" && path.value.module !== module.module) report("module-owner", site, "definition must belong to this module");
    const node = inventory.nodesById.get(item.node);
    if (node === undefined) { report("node-reference", site, "definition node does not exist"); continue; }
    const metadata = node.tsonic;
    const directDefinition = metadata !== null && "definition" in metadata && typeof metadata.definition === "string"
      ? metadata.definition : metadata !== null && "declaration" in metadata && typeof metadata.declaration !== "string" &&
        metadata.declaration !== null && metadata.declaration.kind === "definition" ? metadata.declaration.definition : null;
    if (!declarationKinds.some(kind => kind === node.kind) || (directDefinition !== null && directDefinition !== item.definition))
      report("definition-reference", site, "declaration entry must match its actual node definition");
    if (metadata !== null && "parent" in metadata) {
      const parent = metadata.parent;
      if (parent !== null && !definitions.has(parent))
        report("definition-parent", site, "declaration parent must exist in this module");
      if (path.kind === "known") {
        const parentPath = parent === null ? null : paths.definitionPathOf(parent);
        if (parentPath !== null && parentPath.kind === "known" &&
          (parentPath.value.module !== path.value.module || parentPath.value.segments.length >= path.value.segments.length ||
            encodeDefId({ module: path.value.module,
              segments: path.value.segments.slice(0, parentPath.value.segments.length) }) !== parent))
          report("definition-parent", site, "declaration parent must be a proper definition path prefix");
      }
    }
  }
}

const declarationKinds: readonly DeclarationKind[] = Object.freeze([
  "VariableDeclaration", "Parameter", "BindingElement", "MissingDeclaration", "FunctionDeclaration", "ClassDeclaration",
  "ClassExpression", "InterfaceDeclaration", "TypeAliasDeclaration", "JSTypeAliasDeclaration", "EnumMember", "EnumDeclaration",
  "ImportDeclaration", "JSImportDeclaration", "NamespaceImport", "ExportAssignment", "NamespaceExportDeclaration", "NamespaceExport",
  "ExportSpecifier", "CallSignature", "ConstructSignature", "Constructor", "GetAccessor", "SetAccessor", "IndexSignature",
  "MethodSignature", "MethodDeclaration", "PropertySignature", "PropertyDeclaration", "SemicolonClassElement", "ClassStaticBlockDeclaration",
  "NoSubstitutionTemplateLiteral", "BinaryExpression", "ArrowFunction", "FunctionExpression", "CallExpression", "ObjectLiteralExpression",
  "SpreadAssignment", "PropertyAssignment", "ShorthandPropertyAssignment", "MappedType", "TypeLiteral", "NamedTupleMember", "FunctionType",
  "ConstructorType", "JsxAttributes", "JsxAttribute", "JSDocSignature", "SourceFile", "ModuleDeclaration", "ImportEqualsDeclaration",
  "ExportDeclaration", "ImportClause", "ImportSpecifier", "TypeParameter", "JSDocTypeLiteral",
]);

interface HirCandidateArena {
  readonly body: HirBody;
  readonly lists: readonly HirCandidateList[];
}

function bodyViolations(module: HirModule, inventory: HirInventory, paths: HirIdentityPaths, report: HirReport): readonly HirCandidateArena[] {
  const arenas: HirCandidateArena[] = [];
  const lexicalRanges = hirLexicalBodyRanges(module, inventory, paths);
  const lexicalBodies = new Map<BodyId, typeof lexicalRanges[number]>();
  for (const range of lexicalRanges) if (!lexicalBodies.has(range.body.body)) lexicalBodies.set(range.body.body, range);
  const definitions = new Set<DefId>([module.tree.tsonic.definition, ...module.items.map(item => item.definition)]);
  const seen = new Set<BodyId>();
  const actualNested = new Map<HirBody, BodyId[]>();
  for (const [body, parent] of inventory.bodyParents) {
    if (parent === null) continue;
    const previous = actualNested.get(parent);
    if (previous === undefined) actualNested.set(parent, [body.body]);
    else previous.push(body.body);
  }
  let previousBody: BodyId | null = null;
  for (const inner of lexicalRanges) {
    const body = inner.body;
    const site: HirSite = { kind: "body", body: body.body };
    if (seen.has(body.body)) report("body-unique", site, "body occurs more than once");
    seen.add(body.body);
    if (previousBody !== null && body.body <= previousBody) report("stable-order", site, "bodies must be in identity order");
    previousBody = body.body;
    const path = paths.bodyPathOf(body.body);
    if (path.kind === "known" && path.value.owner !== body.owner || !definitions.has(body.owner) ||
      !inventory.starts.has(body.root) || inventory.owners.get(body.root) !== body)
      report("body-owner", site, "body identity, owner and actual module subtree must agree");
    const nested = actualNested.get(body) ?? [];
    if (body.nestedBodies.length !== nested.length || body.nestedBodies.some((identity, ordinal) => identity !== nested[ordinal]))
      report("body-owner", site, "nested bodies must be the actual direct body roots in preorder");
    const captured = new Map<BodyId, Set<number>>();
    for (const reference of body.captures) {
      const previous = captured.get(reference.body);
      if (previous === undefined) captured.set(reference.body, new Set([reference.local]));
      else previous.add(reference.local);
    }
    const parameterLocals: number[] = [];
    for (const [ordinal, local] of body.locals.entries()) {
      if (!Object.hasOwn(body.locals, ordinal)) {
        report("local-dense", site, "local id must equal its declaration position");
        continue;
      }
      if (!Object.is(local.id, ordinal)) report("local-dense", site, "local id must equal its declaration position");
      if (local.role === "parameter") parameterLocals.push(local.id);
      if (local.role === "capture") {
        if (local.capturedFrom === null || !captured.get(local.capturedFrom.body)?.has(local.capturedFrom.local))
          report("capture-owner", site, "capture local must name a declared outer capture");
      } else if (local.capturedFrom !== null) report("capture-owner", site, "noncapture local cannot have capturedFrom");
    }
    if (parameterLocals.length !== body.params.length || body.params.some((parameter, ordinal) =>
      !Object.is(parameter.local, parameterLocals[ordinal])))
      report("parameter-order", site, "parameters must name every parameter local in declaration order");
    body.params.forEach((parameter, ordinal) => {
      if ((parameter.role === "this" && ordinal !== 0) || (parameter.role === "rest" && ordinal !== body.params.length - 1))
        report("parameter-order", site, "this must be first and rest must be last");
      if (parameter.initializer !== null) {
        const initializer = inventory.bodies.get(parameter.initializer);
        const identity = paths.bodyPathOf(parameter.initializer);
        if (initializer === undefined || initializer.owner !== parameter.declaration || identity.kind !== "known" ||
          identity.value.role !== "default-argument") report("body-owner", site, "parameter initializer must be its own default-argument body");
      }
    });
    const captureKeys = new Set<string>();
    for (const capture of body.captures) {
      const key = `${capture.body.length}:${capture.body}:${capture.local}`;
      const outer = lexicalBodies.get(capture.body);
      if (captureKeys.has(key) || outer === undefined || outer.body === body ||
        inner.start < outer.start || inner.start >= outer.end)
        report("capture-owner", site, "capture must name one distinct enclosing body's local");
      captureKeys.add(key);
      if (outer !== undefined && (!Number.isSafeInteger(capture.local) || capture.local < 0 ||
        Object.is(capture.local, -0) || outer.body.locals[capture.local] === undefined))
        report("local-reference", site, "capture local does not exist in its named body");
    }
    const scopes = new Map<number, typeof body.scopes[number]>();
    for (const scope of body.scopes) scopes.set(scope.node, scope);
    let previousScope = -1;
    for (const scope of body.scopes) {
      const node = inventory.entriesById.get(scope.node);
      if (scope.node <= previousScope) report("stable-order", site, "scopes must be distinct and in preorder");
      previousScope = scope.node;
      if (node === undefined || node.body !== body) report("node-reference", site, "scope must name a node of this body");
      if (scope.parent !== null) {
        const parent = scopes.get(scope.parent);
        const parentNode = inventory.entriesById.get(scope.parent);
        if (parent === undefined || parentNode === undefined || node === undefined || parent.node >= scope.node ||
          !containsHirNode(parentNode, node)) report("scope-parent", site, "scope parent must be an earlier enclosing scope");
      }
    }
    const lists: HirCandidateList[] = [];
    for (const [ordinal, list] of body.candidateLists.entries()) {
      if (!Object.hasOwn(body.candidateLists, ordinal)) {
        report("candidate-list-dense", site, "candidate list id must equal its arena position");
        continue;
      }
      lists.push(list);
      if (!Object.is(list.id, ordinal)) report("candidate-list-dense", site, "candidate list id must equal its arena position");
      let previousCandidate = -1;
      for (const candidate of list.candidates) {
        if (!Number.isSafeInteger(candidate.ordinal) || candidate.ordinal < 0 || Object.is(candidate.ordinal, -0) || candidate.ordinal <= previousCandidate)
          report("candidate-original-order", site, "candidate ordinals must retain distinct original order");
        previousCandidate = candidate.ordinal;
      }
    }
    arenas.push({ body, lists });
  }
  return arenas;
}

function verificationRoots(module: HirModule, inventory: HirInventory): readonly HirDataRoot[] {
  const moduleSite: HirSite = { kind: "module", module: module.module };
  const roots: HirDataRoot[] = [
    { work: hirItemsData(module.items), site: moduleSite, node: null, body: null },
    { work: hirDiagnosticsData(module.checkerDiagnostics), site: moduleSite, node: null, body: null },
    { work: hirObligationsData(module.obligations), site: moduleSite, node: null, body: null },
  ];
  for (const entry of inventory.entries) roots.push({ work: hirNodeData(entry.node),
    site: { kind: "node", node: entry.source }, node: entry.node, body: entry.body });
  for (const body of module.bodies) roots.push({ work: hirBodyData(body),
    site: { kind: "body", body: body.body }, node: null, body });
  return roots;
}

type HirProtocolNode = AwaitExpression<CheckedPhase> | SpreadElement<CheckedPhase> | YieldExpression<CheckedPhase> |
  ForInStatement<CheckedPhase> | ForOfStatement<CheckedPhase>;

interface HirProtocolSyntax {
  readonly kind: "await" | "spread" | "yield" | "delegate" | "iterate";
  readonly subject: NodeId | null;
  readonly asynchronous: boolean | null;
}

function protocolSyntax(node: HirProtocolNode): HirProtocolSyntax {
  switch (node.kind) {
    case "AwaitExpression": return { kind: "await", subject: node.expression.id, asynchronous: null };
    case "SpreadElement": return { kind: "spread", subject: node.expression.id, asynchronous: null };
    case "YieldExpression": return { kind: node.asteriskToken === null ? "yield" : "delegate",
      subject: node.expression === null ? null : node.expression.id, asynchronous: null };
    case "ForInStatement": return { kind: "iterate", subject: node.expression.id, asynchronous: false };
    case "ForOfStatement": return { kind: "iterate", subject: node.expression.id, asynchronous: node.awaitModifier !== null };
  }
}

function verifyProtocol(node: HirProtocolNode, site: HirSite, report: HirReport): void {
  const captured = node.tsonic.protocol;
  if (captured.kind === "unavailable" || captured.value === null) return;
  const protocol = captured.value;
  const expected = protocolSyntax(node);
  if (protocol.kind !== expected.kind) report("protocol-kind", site, "protocol must match its syntactic operation");
  if (!Object.is(protocol.subject, expected.subject))
    report("protocol-kind", site, "protocol subject must be the actual syntactic operand");
  if (expected.asynchronous !== null && (protocol.kind === "iterate" || protocol.kind === "spread") &&
    protocol.asynchronous !== expected.asynchronous)
    report("protocol-kind", site, "iteration protocol must retain authored asynchronous mode");
}

function candidateViolations(inventory: HirInventory, context: HirVerificationContext,
  arenas: readonly HirCandidateArena[], requests: HirBindingRequest[], report: HirReport): void {
  const memberships = new Map<DefId, Map<DefId, Set<number>>>();
  for (const { body, lists } of arenas) {
    const site: HirSite = { kind: "body", body: body.body };
    for (const list of lists) for (const candidate of list.candidates) {
      if (candidate.bindings.kind === "available")
        requests.push({ kind: "definition", definition: candidate.declaration, vector: candidate.bindings.value, site });
      if (candidate.appliedSignature.kind === "available") {
        const signature = validHirIndex(candidate.appliedSignature.value)
          ? context.types.signatures[candidate.appliedSignature.value] : undefined;
        if (signature !== undefined && signature.declaration !== null && signature.declaration !== candidate.declaration)
          report("candidate-endpoints", site, "applied signature must retain the candidate declaration");
      }
      if (candidate.contributions.length > 0) {
        let allowed = memberships.get(candidate.declaration);
        if (allowed === undefined) {
          allowed = new Map();
          const scope = context.bindingScopeOf(candidate.declaration);
          if (scope !== null) for (const family of [scope.classParameters, scope.methodParameters, scope.capturedParameters])
            for (const parameter of family) {
              const previous = allowed.get(parameter.owner);
              if (previous === undefined) allowed.set(parameter.owner, new Set([parameter.index]));
              else previous.add(parameter.index);
            }
          memberships.set(candidate.declaration, allowed);
        }
        for (const contribution of candidate.contributions) if (!validHirIndex(contribution.parameter.index) ||
          !allowed.get(contribution.parameter.owner)?.has(contribution.parameter.index))
          report("contribution-parameter", site, "contribution must name an actual candidate type parameter");
      }
    }
  }
  for (const entry of inventory.entries) {
    const node = entry.node;
    const metadata = node.tsonic;
    const site: HirSite = { kind: "node", node: entry.source };
    if (metadata !== null && "body" in metadata && metadata.body !== null) {
      const body = inventory.bodies.get(metadata.body);
      const root = node.kind === "SourceFile" ? node : "body" in node ? node.body : null;
      if (body === undefined || body.root !== root || "definition" in metadata && body.owner !== metadata.definition)
        report("body-owner", site, "body metadata must retain its exact owner and syntax root");
    }
    if (metadata !== null && "initializer" in metadata && metadata.initializer !== null) {
      const body = inventory.bodies.get(metadata.initializer);
      const root = "initializer" in node ? node.initializer : null;
      if (body === undefined || body.root !== root)
        report("body-owner", site, "initializer body must retain its actual syntax initializer");
    }
    if (metadata !== null && "signatures" in metadata) for (const endpoint of metadata.signatures) {
      const signature = validHirIndex(endpoint.signature) ? context.types.signatures[endpoint.signature] : undefined;
      if ((signature !== undefined && signature.declaration !== null && signature.declaration !== endpoint.declaration) ||
        endpoint.declaration !== metadata.definition || (endpoint.role === "api-body" && endpoint.body === null) ||
        (endpoint.body !== null && inventory.bodies.get(endpoint.body)?.owner !== endpoint.declaration))
        report("candidate-endpoints", site, "callable endpoint declaration, signature and body must agree");
    }
    if (node.kind === "AwaitExpression" || node.kind === "SpreadElement" || node.kind === "YieldExpression" ||
      node.kind === "ForOfStatement" || node.kind === "ForInStatement") verifyProtocol(node, site, report);
    if (metadata !== null && "disposal" in metadata) for (const fact of metadata.disposal)
      if (fact.kind === "available" && fact.value.kind !== "dispose")
        report("protocol-kind", site, "disposal list must contain disposal protocols");
  }
}

function binaryOperator(token: BinaryOperator): HirBinaryOperator | null {
  switch (token) {
    case "PlusToken": case "PlusEqualsToken": return "+";
    case "MinusToken": case "MinusEqualsToken": return "-";
    case "AsteriskToken": case "AsteriskEqualsToken": return "*";
    case "SlashToken": case "SlashEqualsToken": return "/";
    case "PercentToken": case "PercentEqualsToken": return "%";
    case "AsteriskAsteriskToken": case "AsteriskAsteriskEqualsToken": return "**";
    case "AmpersandToken": case "AmpersandEqualsToken": return "&";
    case "BarToken": case "BarEqualsToken": return "|";
    case "CaretToken": case "CaretEqualsToken": return "^";
    case "LessThanLessThanToken": case "LessThanLessThanEqualsToken": return "<<";
    case "GreaterThanGreaterThanToken": case "GreaterThanGreaterThanEqualsToken": return ">>";
    case "GreaterThanGreaterThanGreaterThanToken": case "GreaterThanGreaterThanGreaterThanEqualsToken": return ">>>";
    case "LessThanToken": return "<";
    case "LessThanEqualsToken": return "<=";
    case "GreaterThanToken": return ">";
    case "GreaterThanEqualsToken": return ">=";
    case "EqualsEqualsToken": return "==";
    case "ExclamationEqualsToken": return "!=";
    case "EqualsEqualsEqualsToken": return "===";
    case "ExclamationEqualsEqualsToken": return "!==";
    case "InKeyword": return "in";
    case "InstanceOfKeyword": return "instanceof";
    case "QuestionQuestionToken": case "AmpersandAmpersandToken": case "BarBarToken": case "EqualsToken": case "BarBarEqualsToken": case "AmpersandAmpersandEqualsToken": case "QuestionQuestionEqualsToken": case "CommaToken": return null;
  }
}

interface HirOperation {
  readonly operator: HirUnaryOperator | HirBinaryOperator;
  readonly operands: readonly NodeId[];
}

function operationOf(node: HirNode): HirOperation | null {
  if (node.kind === "BinaryExpression") {
    const operator = binaryOperator(node.operatorToken.kind);
    return operator === null ? null : { operator, operands: [node.left.id, node.right.id] };
  }
  if (node.kind === "PrefixUnaryExpression" && node.tsonic.role !== "type-literal") {
    const operator = node.operator === "PlusToken" ? "+" : node.operator === "MinusToken" ? "-" :
      node.operator === "ExclamationToken" ? "!" : node.operator === "TildeToken" ? "~" : null;
    return operator === null ? null : { operator, operands: [node.operand.id] };
  }
  if (node.kind === "DeleteExpression" || node.kind === "TypeOfExpression" || node.kind === "VoidExpression")
    return { operator: node.kind === "DeleteExpression" ? "delete" : node.kind === "TypeOfExpression" ? "typeof" : "void", operands: [node.expression.id] };
  return null;
}

interface HirWriteFit {
  readonly value: HirNode;
  readonly destination: HirNode;
}

function writeFitOf(node: HirNode): HirWriteFit | null {
  if (node.kind === "BinaryExpression") {
    switch (node.operatorToken.kind) {
      case "EqualsToken": return { value: node.right, destination: node.left };
      case "PlusEqualsToken": case "MinusEqualsToken": case "AsteriskAsteriskEqualsToken":
      case "AsteriskEqualsToken": case "SlashEqualsToken": case "PercentEqualsToken":
      case "AmpersandEqualsToken": case "BarEqualsToken": case "CaretEqualsToken":
      case "LessThanLessThanEqualsToken": case "GreaterThanGreaterThanGreaterThanEqualsToken":
      case "GreaterThanGreaterThanEqualsToken": case "BarBarEqualsToken":
      case "AmpersandAmpersandEqualsToken": case "QuestionQuestionEqualsToken":
        return { value: node, destination: node.left };
      case "QuestionQuestionToken": case "AsteriskAsteriskToken": case "AsteriskToken":
      case "SlashToken": case "PercentToken": case "PlusToken":
      case "MinusToken": case "LessThanLessThanToken": case "GreaterThanGreaterThanToken":
      case "GreaterThanGreaterThanGreaterThanToken": case "LessThanToken": case "LessThanEqualsToken":
      case "GreaterThanToken": case "GreaterThanEqualsToken": case "InstanceOfKeyword":
      case "InKeyword": case "EqualsEqualsToken": case "EqualsEqualsEqualsToken":
      case "ExclamationEqualsEqualsToken": case "ExclamationEqualsToken": case "AmpersandToken":
      case "BarToken": case "CaretToken": case "AmpersandAmpersandToken":
      case "BarBarToken": case "CommaToken":
        return null;
    }
  }
  if ((node.kind === "PrefixUnaryExpression" || node.kind === "PostfixUnaryExpression") &&
    (node.operator === "PlusPlusToken" || node.operator === "MinusMinusToken"))
    return { value: node, destination: node.operand };
  if ((node.kind === "VariableDeclaration" || node.kind === "Parameter" || node.kind === "PropertyDeclaration" ||
    node.kind === "EnumMember" || node.kind === "BindingElement") && node.initializer !== null)
    return { value: node.initializer, destination: node };
  return null;
}

function obligationViolations(module: HirModule, inventory: HirInventory, context: HirVerificationContext,
  paths: HirIdentityPaths, report: HirReport): void {
  const moduleSite: HirSite = { kind: "module", module: module.module };
  const seen = new Set<number>();
  for (const root of module.obligations) {
    const site: HirSite = { kind: "node", node: root.owner };
    if (!validHirIndex(root.diagnostic) || module.checkerDiagnostics[root.diagnostic] === undefined || seen.has(root.diagnostic))
      report("diagnostic-reference", site, "diagnostic root must name one existing diagnostic");
    seen.add(root.diagnostic);
    const ownerEntry = localSourceEntry(root.owner, module, inventory, paths);
    const owner = ownerEntry === null ? null : ownerEntry.node;
    if (ownerEntry === null)
      report("diagnostic-root-owner", site, "diagnostic root must be an existing node in this module");
    const diagnostic = module.checkerDiagnostics[root.diagnostic];
    if (diagnostic !== undefined && diagnostic.site.kind === "source" && owner !== null &&
      (diagnostic.site.origin.module !== module.module || diagnostic.site.origin.start < owner.loc.pos ||
        diagnostic.site.origin.start + diagnostic.site.origin.length > owner.loc.end))
      report("diagnostic-root-owner", site, "diagnostic source range must be inside its exact root");
    if (root.obligations.length === 0) report("obligation-complete", site, "a discharge root requires its complete nonempty obligations");
    const present: readonly [Set<HirNode>, Set<HirNode>, Set<HirNode>] = [new Set(), new Set(), new Set()];
    root.obligations.forEach((obligation, ordinal) => {
      if (!Object.is(obligation.ordinal, ordinal)) report("obligation-order", site, "obligations must retain dense declared order");
      const occurrenceEntry = inventory.entriesById.get(obligation.occurrence.node);
      const reference: SourceNodeRef = { kind: "body", value: obligation.occurrence };
      const associated = ownerEntry !== null && occurrenceEntry !== undefined && sourceNodeExists(reference, module, inventory, context, paths) &&
        containsHirNode(ownerEntry, occurrenceEntry) && ownerEntry.body === occurrenceEntry.body;
      if (!associated)
        report("obligation-complete", site, "every obligation must belong to its diagnostic root");
      if (occurrenceEntry === undefined) return;
      const occurrence = occurrenceEntry.node;
      if (obligation.kind === "operator") {
        const operation = operationOf(occurrence);
        if (operation === null || obligation.operator !== operation.operator ||
          obligation.operands.length !== operation.operands.length || obligation.operands.some((operand, index) =>
            operand.body !== obligation.occurrence.body || operand.node !== operation.operands[index]))
          report("obligation-complete", site, "operator obligation must retain all actual operands in order");
        else if (associated) present[1].add(occurrence);
      } else if (obligation.kind === "index") {
        if (occurrence.kind !== "ElementAccessExpression" || obligation.receiver.node !== occurrence.expression.id ||
          obligation.key.node !== occurrence.argumentExpression.id || obligation.receiver.body !== obligation.occurrence.body ||
          obligation.key.body !== obligation.occurrence.body)
          report("obligation-complete", site, "index obligation must retain the actual receiver and key");
        else if (associated) present[2].add(occurrence);
      } else if (obligation.kind === "write-fit") {
        const expected = writeFitOf(occurrence);
        const value = localSourceEntry({ kind: "body", value: obligation.value }, module, inventory, paths);
        if (expected !== null) {
          const body = inventory.owners.get(expected.value);
          if (body === undefined || !Object.is(obligation.value.node, expected.value.id) || obligation.value.body !== body.body ||
            localSourceNode(obligation.destination, module, inventory, paths) !== expected.destination)
            report("obligation-complete", site, "write-fit obligation must retain its actual value and destination");
          else if (associated) present[0].add(occurrence);
        } else if (value === null || !containsHirNode(occurrenceEntry, value))
          report("obligation-complete", site, "write-fit value must belong to its actual occurrence subtree");
      }
    });
    if (ownerEntry !== null && root.obligations.length > 0 &&
      (present[0].size < ownerEntry.required[0] || present[1].size < ownerEntry.required[1] || present[2].size < ownerEntry.required[2]))
      report("obligation-complete", site, "root must retain each syntactically required obligation");
  }
  for (const diagnostic of module.checkerDiagnostics) if (diagnostic.site.kind === "source" &&
    (!validHirIndex(diagnostic.site.origin.length) ||
      !validRange(diagnostic.site.origin.start, diagnostic.site.origin.start + diagnostic.site.origin.length)))
    report("origin-range", moduleSite, "diagnostic source range must be valid");
}

function magnitude(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function normalizedRational(value: ExactRational): boolean {
  if (value.denominator <= 0n || value.negativeZero && value.numerator !== 0n) return false;
  let left = magnitude(value.numerator);
  let right = value.denominator;
  while (right !== 0n) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left === 1n;
}

interface DecimalToken {
  readonly coefficient: bigint;
  readonly exponent: bigint;
  readonly negative: boolean;
}

function numericToken(text: string): DecimalToken | null {
  const negative = text.startsWith("-");
  const signLength = negative || text.startsWith("+") ? 1 : 0;
  const unsigned = text.slice(signLength);
  if (/^0(?:[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|[oO][0-7](?:_?[0-7])*|[bB][01](?:_?[01])*)$/u.test(unsigned))
    return { coefficient: BigInt(unsigned.replace(/_/gu, "")), exponent: 0n, negative };
  if (!/^[+-]?(?:[0-9](?:_?[0-9])*(?:\.(?:[0-9](?:_?[0-9])*)?)?|\.[0-9](?:_?[0-9])*)(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/u.test(text)) return null;
  const normalized = unsigned.replace(/_/gu, "");
  const exponentAt = normalized.search(/[eE]/u);
  const mantissa = exponentAt < 0 ? normalized : normalized.slice(0, exponentAt);
  const exponent = exponentAt < 0 ? 0n : BigInt(normalized.slice(exponentAt + 1));
  const pointAt = mantissa.indexOf(".");
  const fractionLength = pointAt < 0 ? 0 : mantissa.length - pointAt - 1;
  const coefficient = BigInt(pointAt < 0 ? mantissa : mantissa.slice(0, pointAt) + mantissa.slice(pointAt + 1));
  return { coefficient, exponent: exponent - BigInt(fractionLength), negative };
}

function tokenMatchesRational(token: DecimalToken, value: ExactRational): boolean {
  if (!normalizedRational(value)) return false;
  if (token.coefficient === 0n) return value.numerator === 0n && value.negativeZero === token.negative;
  if (value.numerator === 0n || (value.numerator < 0n) !== token.negative) return false;
  const bound = BigInt(token.coefficient.toString().length + magnitude(value.numerator).toString().length + value.denominator.toString().length);
  if (magnitude(token.exponent) > bound) return false;
  const coefficient = token.negative ? -token.coefficient : token.coefficient;
  return token.exponent >= 0n
    ? coefficient * 10n ** token.exponent * value.denominator === value.numerator
    : coefficient * value.denominator === value.numerator * 10n ** -token.exponent;
}

function literalMatches(value: LiteralValue | LiteralTypeValue): boolean {
  if (value.kind === "number") {
    if (!("token" in value)) return normalizedRational(value.value);
    const parsed = numericToken(value.token);
    return parsed !== null && tokenMatchesRational(parsed, value.value);
  }
  if (value.kind === "bigint" && "token" in value) return bigintTokenMatches(value.token, value.value);
  return true;
}

function bigintTokenMatches(text: string, value: bigint): boolean {
  if (!/^[+-]?(?:[0-9](?:_?[0-9])*|0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*)n$/u.test(text)) return false;
  const unsigned = text.replace(/_/gu, "").slice(0, -1);
  const negative = unsigned.startsWith("-");
  const digits = negative || unsigned.startsWith("+") ? unsigned.slice(1) : unsigned;
  return (negative ? -BigInt(digits) : BigInt(digits)) === value;
}

function literalViolations(module: HirModule, inventory: HirInventory, report: HirReport,
  roots: readonly HirDataRoot[]): void {
  for (const entry of inventory.entries) {
    const node = entry.node;
    const metadata = node.tsonic;
    if (metadata === null || !("literal" in metadata)) continue;
    const literal = metadata.literal;
    const site: HirSite = { kind: "node", node: entry.source };
    const exact = literalMatches(literal);
    if (!exact) report("literal-exact", site, "literal must preserve its normalized exact authored value");
    let numericMismatch = false;
    if (exact && node.kind === "NumericLiteral" && literal.kind === "number") {
      const token = numericToken(node.text);
      numericMismatch = token === null || !tokenMatchesRational(token, literal.value);
    }
    if (exact && node.kind === "BigIntLiteral" && literal.kind === "bigint")
      numericMismatch = !bigintTokenMatches(node.text, literal.value);
    if (node.kind === "NumericLiteral" && literal.kind !== "number" ||
      node.kind === "BigIntLiteral" && literal.kind !== "bigint" ||
      numericMismatch ||
      (node.kind === "StringLiteral" || node.kind === "NoSubstitutionTemplateLiteral") &&
        (literal.kind !== "string" || literal.value !== node.text) ||
      node.kind === "TrueKeyword" && (literal.kind !== "boolean" || !literal.value) ||
      node.kind === "FalseKeyword" && (literal.kind !== "boolean" || literal.value) ||
      node.kind === "NullKeyword" && literal.kind !== "absence")
      report("literal-exact", site, "literal category and value must match its syntax");
    if (node.kind === "PrefixUnaryExpression" && (literal.kind === "number" || literal.kind === "bigint")) {
      const operand = node.operand;
      const token = operand.kind === "NumericLiteral" || operand.kind === "BigIntLiteral" ?
        numericToken(`${node.operator === "MinusToken" ? "-" : ""}${operand.kind === "BigIntLiteral" ? operand.text.replace(/n$/u, "") : operand.text}`) : null;
      if ((node.operator !== "PlusToken" && node.operator !== "MinusToken") || token === null ||
        (literal.kind === "number" ? !tokenMatchesRational(token, literal.value) : token.exponent !== 0n ||
          (token.negative ? -token.coefficient : token.coefficient) !== literal.value))
        report("literal-exact", site, "unary literal must preserve the actual operand and sign");
    }
  }
  for (const root of roots) walkHirData(root, data => {
    const reference = data.reference;
    if (reference.kind === "MemberKey" && reference.value.kind === "number" &&
      !normalizedRational(reference.value.value)) report("literal-exact", data.site, "numeric member key must retain a normalized exact rational");
  });
}

export const verifyHir: VerifyHir = (module, context) => {
  const hirSchema = createHirSchema();
  const violations: Violation<HirRule, HirSite>[] = [];
  const report: HirReport = (rule, site, reason) => { violations.push({ rule, site, detail: [{ kind: "text", value: reason }] }); };
  const paths = createHirIdentityPaths(context);
  const inventory = createHirInventory(module);
  syntaxViolations(module, inventory, report);
  declarationViolations(module, inventory, paths, report);
  const arenas = bodyViolations(module, inventory, paths, report);
  const roots = verificationRoots(module, inventory);
  verifyHirReferences(roots, module, inventory, context, paths, report);
  const requests: HirBindingRequest[] = [];
  candidateViolations(inventory, context, arenas, requests, report);
  literalViolations(module, inventory, report, roots);
  obligationViolations(module, inventory, context, paths, report);
  const readers: HirCaptureReaders = {
    nodeOf: reference => sourceNodeData(reference, module, inventory, context, paths),
  };
  verifyHirCaptures(inventory.entries, readers, report, hirSchema, requests);
  verifyHirPlaces(inventory, report);
  violations.push(...verifyBindingVectors(requests, context, reference => readers.nodeOf(reference)?.node ?? null));
  return Object.freeze(violations);
};
