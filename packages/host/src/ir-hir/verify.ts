import type { Violation } from "../diag/contract.js";
import type { BodyId, DefId, SourceNodeRef } from "../ids/contract.js";
import { decodeBodyId, decodeDefId, decodeModuleId } from "../ids/index.js";
import type { DeclarationKind, HirBody, HirModule, HirNode, HirRule, HirSite } from "./contract.js";
import type { HirInventory, HirReport } from "./verify-syntax.js";
import { childrenOfSyntax } from "./children.js";

interface NodeFrame {
  readonly node: HirNode;
  readonly parent: HirNode | null;
  readonly body: HirBody | null;
  readonly item: DefId;
  readonly leaving: boolean;
  readonly next: NodeFrame | null;
}

export function createHirInventory(module: HirModule): HirInventory {
  const nodes: HirNode[] = [];
  const nodesById = new Map<number, HirNode>();
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
  const repeated: HirNode[] = [];
  for (const body of module.bodies) {
    if (!bodies.has(body.body)) bodies.set(body.body, body);
    if (!roots.has(body.root)) roots.set(body.root, body);
  }
  let pending: NodeFrame | null = { node: module.tree, parent: null, body: null,
    item: module.tree.tsonic.definition, leaving: false, next: null };
  while (pending !== null) {
    const frame = pending;
    pending = pending.next;
    if (frame.leaving) { ends.set(frame.node, nodes.length); continue; }
    if (starts.has(frame.node)) { repeated.push(frame.node); continue; }
    const declaredBody = roots.get(frame.node);
    const body = declaredBody ?? frame.body;
    const item = itemDefinitions.get(frame.node.id) ?? frame.item;
    if (declaredBody !== undefined) bodyParents.set(declaredBody, frame.body);
    starts.set(frame.node, nodes.length);
    parents.set(frame.node, frame.parent);
    itemOwners.set(frame.node, item);
    nodes.push(frame.node);
    if (!nodesById.has(frame.node.id)) nodesById.set(frame.node.id, frame.node);
    if (body !== null) owners.set(frame.node, body);
    const following: NodeFrame = { ...frame, leaving: true, next: pending };
    pending = childrenOfSyntax(frame.node).reduceRight<NodeFrame | null>((next, node) => ({
      node, parent: frame.node, body, item, leaving: false, next,
    }), following);
  }
  return { nodes: Object.freeze(nodes), nodesById, starts, ends, parents, owners, itemOwners, bodies, bodyParents,
    repeated: Object.freeze(repeated) };
}

export function hirNodeSource(node: HirNode, inventory: HirInventory, module: HirModule): SourceNodeRef {
  const body = inventory.owners.get(node);
  if (body !== undefined) return { kind: "body", value: { body: body.body, node: node.id } };
  return { kind: "item", value: { owner: inventory.itemOwners.get(node) ?? module.tree.tsonic.definition, node: node.id } };
}

function nodeSite(node: HirNode, inventory: HirInventory, module: HirModule): HirSite {
  return { kind: "node", node: hirNodeSource(node, inventory, module) };
}

export function containsHirNode(outer: HirNode, inner: HirNode, inventory: HirInventory): boolean {
  const outerStart = inventory.starts.get(outer);
  const outerEnd = inventory.ends.get(outer);
  const innerStart = inventory.starts.get(inner);
  return outerStart !== undefined && outerEnd !== undefined && innerStart !== undefined &&
    innerStart >= outerStart && innerStart < outerEnd;
}

function validRange(start: number, end: number): boolean {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && !Object.is(start, -0) && end >= start;
}

function syntaxViolations(module: HirModule, inventory: HirInventory, report: HirReport): void {
  inventory.nodes.forEach((node, ordinal) => {
    const site = nodeSite(node, inventory, module);
    if (!Object.is(node.id, ordinal)) report("node-dense-preorder", site, "id must equal module preorder position");
    const parent = inventory.parents.get(node);
    if (node.parent !== (parent?.id ?? null)) report("lexical-parent", site, "parent must be the actual syntactic parent");
    if (node.origin.module !== module.module) report("module-owner", site, "origin must name this module");
    if (!validRange(node.loc.pos, node.loc.end)) report("origin-range", site, "invalid syntax range");
    if (!validRange(node.origin.start, node.origin.start + node.origin.length) || node.origin.length < 0 || Object.is(node.origin.length, -0))
      report("origin-range", site, "invalid origin range");
    const body = inventory.owners.get(node);
    if (body !== undefined && (node.loc.pos < body.root.loc.pos || node.loc.end > body.root.loc.end))
      report("node-in-body-range", site, "syntax must remain inside its body root range");
    if (node.kind === "LiteralType" && node.literal.kind === "PrefixUnaryExpression" &&
      ((node.literal.operator !== "PlusToken" && node.literal.operator !== "MinusToken") ||
        (node.literal.operand.kind !== "NumericLiteral" && node.literal.operand.kind !== "BigIntLiteral")))
      report("literal-type-child", site, "literal unary child requires a numeric literal and unary plus or minus");
  });
  for (const node of inventory.repeated)
    report("node-dense-preorder", nodeSite(node, inventory, module), "syntax node occurs more than once");
}

function declarationViolations(module: HirModule, inventory: HirInventory, report: HirReport): void {
  const moduleSite: HirSite = { kind: "module", module: module.module };
  if (decodeModuleId(module.module).kind === "invalid") report("module-owner", moduleSite, "invalid module identity");
  const seen = new Set<string>();
  const definitions = new Set<DefId>([module.tree.tsonic.definition, ...module.items.map(item => item.definition)]);
  let previous: string | null = null;
  for (const item of module.items) {
    const site: HirSite = { kind: "definition", definition: item.definition };
    if (seen.has(item.definition)) report("definition-unique", site, "definition occurs more than once");
    seen.add(item.definition);
    if (previous !== null && item.definition <= previous) report("stable-order", site, "definitions must be in identity order");
    previous = item.definition;
    const path = decodeDefId(item.definition);
    if (path.kind === "invalid" || path.value.module !== module.module) report("module-owner", site, "definition must belong to this module");
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
      if (path.kind === "decoded") {
        const parentPath = parent === null ? null : decodeDefId(parent);
        if (parentPath !== null && parentPath.kind === "decoded" &&
          (parentPath.value.module !== path.value.module || parentPath.value.segments.length >= path.value.segments.length ||
            parentPath.value.segments.some((segment, ordinal) => {
              const actual = path.value.segments[ordinal];
              return actual === undefined || actual.name !== segment.name || !Object.is(actual.ordinal, segment.ordinal);
            }))) report("definition-parent", site, "declaration parent must be a proper definition path prefix");
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

function bodyViolations(module: HirModule, inventory: HirInventory, report: HirReport): void {
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
  for (const body of module.bodies) {
    const site: HirSite = { kind: "body", body: body.body };
    if (seen.has(body.body)) report("body-unique", site, "body occurs more than once");
    seen.add(body.body);
    if (previousBody !== null && body.body <= previousBody) report("stable-order", site, "bodies must be in identity order");
    previousBody = body.body;
    const path = decodeBodyId(body.body);
    if (path.kind === "invalid" || path.value.owner !== body.owner || !definitions.has(body.owner) ||
      !inventory.starts.has(body.root) || inventory.owners.get(body.root) !== body)
      report("body-owner", site, "body identity, owner and actual module subtree must agree");
    const nested = actualNested.get(body) ?? [];
    if (body.nestedBodies.length !== nested.length || body.nestedBodies.some((identity, ordinal) => identity !== nested[ordinal]))
      report("body-owner", site, "nested bodies must be the actual direct body roots in preorder");
    body.locals.forEach((local, ordinal) => {
      if (!Object.is(local.id, ordinal)) report("local-dense", site, "local id must equal its declaration position");
      if (local.role === "capture") {
        if (local.capturedFrom === null || !body.captures.some(reference => reference.body === local.capturedFrom?.body &&
          reference.local === local.capturedFrom?.local)) report("capture-owner", site, "capture local must name a declared outer capture");
      } else if (local.capturedFrom !== null) report("capture-owner", site, "noncapture local cannot have capturedFrom");
    });
    const parameterLocals = body.locals.filter(local => local.role === "parameter");
    if (parameterLocals.length !== body.params.length || body.params.some((parameter, ordinal) => {
      const local = parameterLocals[ordinal];
      return local === undefined || !Object.is(parameter.local, local.id);
    })) report("parameter-order", site, "parameters must name every parameter local in declaration order");
    body.params.forEach((parameter, ordinal) => {
      if ((parameter.role === "this" && ordinal !== 0) || (parameter.role === "rest" && ordinal !== body.params.length - 1))
        report("parameter-order", site, "this must be first and rest must be last");
      if (parameter.initializer !== null) {
        const initializer = inventory.bodies.get(parameter.initializer);
        const identity = decodeBodyId(parameter.initializer);
        if (initializer === undefined || initializer.owner !== parameter.declaration || identity.kind === "invalid" ||
          identity.value.role !== "default-argument") report("body-owner", site, "parameter initializer must be its own default-argument body");
      }
    });
    const captureKeys = new Set<string>();
    for (const capture of body.captures) {
      const key = `${capture.body.length}:${capture.body}:${capture.local}`;
      const owner = inventory.bodies.get(capture.body);
      if (captureKeys.has(key) || owner === undefined || owner === body ||
        !containsHirNode(owner.root, body.root, inventory))
        report("capture-owner", site, "capture must name one distinct enclosing body's local");
      captureKeys.add(key);
      if (owner !== undefined && (!Number.isSafeInteger(capture.local) || capture.local < 0 ||
        Object.is(capture.local, -0) || owner.locals[capture.local] === undefined))
        report("local-reference", site, "capture local does not exist in its named body");
    }
    const scopes = new Map<number, typeof body.scopes[number]>();
    for (const scope of body.scopes) scopes.set(scope.node, scope);
    let previousScope = -1;
    for (const scope of body.scopes) {
      const node = inventory.nodesById.get(scope.node);
      if (scope.node <= previousScope) report("stable-order", site, "scopes must be distinct and in preorder");
      previousScope = scope.node;
      if (node === undefined || inventory.owners.get(node) !== body) report("node-reference", site, "scope must name a node of this body");
      if (scope.parent !== null) {
        const parent = scopes.get(scope.parent);
        const parentNode = inventory.nodesById.get(scope.parent);
        if (parent === undefined || parentNode === undefined || node === undefined || parent.node >= scope.node ||
          !containsHirNode(parentNode, node, inventory)) report("scope-parent", site, "scope parent must be an earlier enclosing scope");
      }
    }
    body.candidateLists.forEach((list, ordinal) => {
      if (!Object.is(list.id, ordinal)) report("candidate-list-dense", site, "candidate list id must equal its arena position");
      let previousCandidate = -1;
      for (const candidate of list.candidates) {
        if (!Number.isSafeInteger(candidate.ordinal) || candidate.ordinal < 0 || Object.is(candidate.ordinal, -0) || candidate.ordinal <= previousCandidate)
          report("candidate-original-order", site, "candidate ordinals must retain distinct original order");
        previousCandidate = candidate.ordinal;
      }
    });
  }
}
