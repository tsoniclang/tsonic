import type { Violation } from "../diag/contract.js";
import type { BodyId, DefId, SourceNodeRef } from "../ids/contract.js";
import type { ExactRational, LiteralTypeValue, LiteralValue, MemberKey } from "../ir-types/contract.js";
import { decodeBodyId, decodeDefId, decodeModuleId } from "../ids/index.js";
import type { DeclarationKind, HirBody, HirModule, HirNode, HirRule, HirSite, HirVerificationContext, VerifyHir } from "./contract.js";
import type { HirDataRoot, HirInventory, HirReport, HirSchema } from "./verify-syntax.js";
import { checkHirShape, hirArray, walkHirData } from "./verify-syntax.js";
import { localSourceNode, sourceNodeExists, validHirIndex, verifyBindingVectors, verifyHirReferences } from "./verify-bindings.js";
import type { HirBindingRequest } from "./verify-bindings.js";
import { createHirSchema, verifyHirCaptures } from "./verify-captures.js";
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
    const captured = new Map<BodyId, Set<number>>();
    for (const reference of body.captures) {
      const previous = captured.get(reference.body);
      if (previous === undefined) captured.set(reference.body, new Set([reference.local]));
      else previous.add(reference.local);
    }
    body.locals.forEach((local, ordinal) => {
      if (!Object.is(local.id, ordinal)) report("local-dense", site, "local id must equal its declaration position");
      if (local.role === "capture") {
        if (local.capturedFrom === null || !captured.get(local.capturedFrom.body)?.has(local.capturedFrom.local))
          report("capture-owner", site, "capture local must name a declared outer capture");
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

function verificationRoots(module: HirModule, inventory: HirInventory): readonly HirDataRoot[] {
  const moduleSite: HirSite = { kind: "module", module: module.module };
  const roots: HirDataRoot[] = [
    { value: module.items, shape: hirArray("HirDeclarationEntry"), site: moduleSite, node: null, body: null },
    { value: module.checkerDiagnostics, shape: hirArray("Diagnostic"), site: moduleSite, node: null, body: null },
    { value: module.obligations, shape: hirArray("HirDiagnosticRoot"), site: moduleSite, node: null, body: null },
  ];
  for (const node of inventory.nodes) roots.push({ value: node, shape: "SyntaxNode",
    site: nodeSite(node, inventory, module), node, body: inventory.owners.get(node) ?? null });
  for (const body of module.bodies) roots.push({ value: body, shape: "HirBody",
    site: { kind: "body", body: body.body }, node: null, body });
  return roots;
}

function candidateViolations(module: HirModule, inventory: HirInventory, context: HirVerificationContext,
  requests: HirBindingRequest[], report: HirReport): void {
  for (const body of module.bodies) {
    const site: HirSite = { kind: "body", body: body.body };
    for (const list of body.candidateLists) for (const candidate of list.candidates) {
      const scope = context.bindingScopeOf(candidate.declaration);
      if (candidate.bindings.kind === "available")
        requests.push({ definition: candidate.declaration, vector: candidate.bindings.value, site });
      if (candidate.appliedSignature.kind === "available") {
        const signature = validHirIndex(candidate.appliedSignature.value)
          ? context.types.signatures[candidate.appliedSignature.value] : undefined;
        if (signature !== undefined && signature.declaration !== null && signature.declaration !== candidate.declaration)
          report("candidate-endpoints", site, "applied signature must retain the candidate declaration");
      }
      const parameters = scope === null ? [] : [...scope.classParameters, ...scope.methodParameters, ...scope.capturedParameters];
      const allowed = new Map<DefId, Set<number>>();
      for (const parameter of parameters) {
        const previous = allowed.get(parameter.owner);
        if (previous === undefined) allowed.set(parameter.owner, new Set([parameter.index]));
        else previous.add(parameter.index);
      }
      for (const contribution of candidate.contributions) if (!validHirIndex(contribution.parameter.index) ||
        !allowed.get(contribution.parameter.owner)?.has(contribution.parameter.index))
        report("contribution-parameter", site, "contribution must name an actual candidate type parameter");
    }
  }
  for (const node of inventory.nodes) {
    const metadata = node.tsonic;
    const site = nodeSite(node, inventory, module);
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
    if (metadata !== null && "protocol" in metadata && metadata.protocol.kind === "available" && metadata.protocol.value !== null) {
      const protocol = metadata.protocol.value;
      const expected = node.kind === "AwaitExpression" ? "await" : node.kind === "SpreadElement" ? "spread" :
        node.kind === "YieldExpression" ? node.asteriskToken === null ? "yield" : "delegate" :
          node.kind === "ForOfStatement" || node.kind === "ForInStatement" ? "iterate" : null;
      if (protocol.kind !== expected) report("protocol-kind", site, "protocol must match its syntactic operation");
      if ((protocol.kind === "iterate" || protocol.kind === "spread") && node.kind === "ForOfStatement" &&
        protocol.asynchronous !== (node.awaitModifier !== null))
        report("protocol-kind", site, "iteration protocol must retain authored asynchronous mode");
    }
    if (metadata !== null && "disposal" in metadata) for (const fact of metadata.disposal)
      if (fact.kind === "available" && fact.value.kind !== "dispose")
        report("protocol-kind", site, "disposal list must contain disposal protocols");
    const place = metadata !== null && "place" in metadata ? metadata.place :
      metadata !== null && "value" in metadata && "place" in metadata.value ? metadata.value.place : null;
    if (place !== null && place.kind === "available" && place.value !== null && place.value.base.kind === "place" &&
      (!validHirIndex(place.value.base.node) || place.value.base.node >= node.id))
      report("place-parent-precedes", site, "parent storage place must precede its projection");
  }
}

function obligationViolations(module: HirModule, inventory: HirInventory, context: HirVerificationContext, report: HirReport): void {
  const moduleSite: HirSite = { kind: "module", module: module.module };
  const seen = new Set<number>();
  for (const root of module.obligations) {
    const site: HirSite = { kind: "node", node: root.owner };
    if (!validHirIndex(root.diagnostic) || module.checkerDiagnostics[root.diagnostic] === undefined || seen.has(root.diagnostic))
      report("diagnostic-reference", site, "diagnostic root must name one existing diagnostic");
    seen.add(root.diagnostic);
    const owner = inventory.nodesById.get(root.owner.value.node);
    if (!sourceNodeExists(root.owner, module, inventory, context) || owner === undefined)
      report("diagnostic-root-owner", site, "diagnostic root must be an existing node in this module");
    const diagnostic = module.checkerDiagnostics[root.diagnostic];
    if (diagnostic !== undefined && diagnostic.site.kind === "source" && owner !== undefined &&
      (diagnostic.site.origin.module !== module.module || diagnostic.site.origin.start < owner.loc.pos ||
        diagnostic.site.origin.start + diagnostic.site.origin.length > owner.loc.end))
      report("diagnostic-root-owner", site, "diagnostic source range must be inside its exact root");
    if (root.obligations.length === 0) report("obligation-complete", site, "a discharge root requires its complete nonempty obligations");
    const occurrences = new Set<number>();
    root.obligations.forEach((obligation, ordinal) => {
      if (!Object.is(obligation.ordinal, ordinal)) report("obligation-order", site, "obligations must retain dense declared order");
      const occurrence = inventory.nodesById.get(obligation.occurrence.node);
      const reference: SourceNodeRef = { kind: "body", value: obligation.occurrence };
      if (!sourceNodeExists(reference, module, inventory, context) || owner === undefined || occurrence === undefined ||
        !containsHirNode(owner, occurrence, inventory))
        report("obligation-complete", site, "every obligation must belong to its diagnostic root");
      const key = obligation.occurrence.node;
      if (occurrences.has(key)) report("obligation-order", site, "an occurrence must not be repeated in one root");
      occurrences.add(key);
      if (obligation.kind === "operator" && occurrence !== undefined) {
        const operands = occurrence.kind === "BinaryExpression" ? [occurrence.left.id, occurrence.right.id] :
          occurrence.kind === "PrefixUnaryExpression" || occurrence.kind === "PostfixUnaryExpression" ? [occurrence.operand.id] : [];
        if (operands.length === 0 || obligation.operands.length !== operands.length ||
          obligation.operands.some((operand, index) => operand.body !== obligation.occurrence.body || operand.node !== operands[index]))
          report("obligation-complete", site, "operator obligation must retain all actual operands in order");
      } else if (obligation.kind === "index" && occurrence !== undefined &&
        (occurrence.kind !== "ElementAccessExpression" || obligation.receiver.node !== occurrence.expression.id ||
          obligation.key.node !== occurrence.argumentExpression.id || obligation.receiver.body !== obligation.occurrence.body ||
          obligation.key.body !== obligation.occurrence.body))
        report("obligation-complete", site, "index obligation must retain the actual receiver and key");
    });
  }
  for (const diagnostic of module.checkerDiagnostics) if (diagnostic.site.kind === "source" &&
    !validRange(diagnostic.site.origin.start, diagnostic.site.origin.start + diagnostic.site.origin.length))
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
  const radix = /^([+-]?)(0(?:[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|[oO][0-7](?:_?[0-7])*|[bB][01](?:_?[01])*))$/u.exec(text);
  if (radix !== null) {
    const digits = radix[2];
    if (digits === undefined) return null;
    return { coefficient: BigInt(digits.replace(/_/gu, "")), exponent: 0n, negative: radix[1] === "-" };
  }
  if (!/^[+-]?(?:[0-9](?:_?[0-9])*(?:\.(?:[0-9](?:_?[0-9])*)?)?|\.[0-9](?:_?[0-9])*)(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/u.test(text)) return null;
  const normalized = text.replace(/_/gu, "");
  const parsed = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/u.exec(normalized);
  if (parsed === null) return null;
  const fraction = parsed[3] ?? parsed[4] ?? "";
  return { coefficient: BigInt((parsed[2] ?? "0") + fraction),
    exponent: BigInt(parsed[5] ?? "0") - BigInt(fraction.length), negative: parsed[1] === "-" };
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
  if (value.kind === "bigint" && "token" in value) {
    if (!/^[+-]?(?:[0-9](?:_?[0-9])*|0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*)n$/u.test(value.token)) return false;
    const unsigned = value.token.replace(/_/gu, "").slice(0, -1);
    const negative = unsigned.startsWith("-");
    const digits = negative || unsigned.startsWith("+") ? unsigned.slice(1) : unsigned;
    return (negative ? -BigInt(digits) : BigInt(digits)) === value.value;
  }
  return true;
}

function memberKeyValue(value: unknown, schema: HirSchema): value is MemberKey {
  return checkHirShape(value, "MemberKey", schema);
}

function literalViolations(module: HirModule, inventory: HirInventory, report: HirReport,
  roots: readonly HirDataRoot[], schema: HirSchema): void {
  for (const node of inventory.nodes) {
    const metadata = node.tsonic;
    if (metadata === null || !("literal" in metadata)) continue;
    const literal = metadata.literal;
    const site = nodeSite(node, inventory, module);
    if (!literalMatches(literal)) report("literal-exact", site, "literal must preserve its normalized exact authored value");
    if (node.kind === "NumericLiteral" && literal.kind !== "number" ||
      node.kind === "BigIntLiteral" && literal.kind !== "bigint" ||
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
  for (const root of roots) walkHirData(root, schema, data => {
    if (data.shape === "MemberKey" && memberKeyValue(data.value, schema) && data.value.kind === "number" &&
      !normalizedRational(data.value.value)) report("literal-exact", data.site, "numeric member key must retain a normalized exact rational");
  });
}

export const verifyHir: VerifyHir = (module, context) => {
  const hirSchema = createHirSchema();
  const violations: Violation<HirRule, HirSite>[] = [];
  const report: HirReport = (rule, site, reason) => { violations.push({ rule, site, detail: [{ kind: "text", value: reason }] }); };
  const inventory = createHirInventory(module);
  syntaxViolations(module, inventory, report);
  declarationViolations(module, inventory, report);
  bodyViolations(module, inventory, report);
  const roots = verificationRoots(module, inventory);
  verifyHirReferences(roots, module, inventory, context, report, hirSchema);
  const requests: HirBindingRequest[] = [];
  candidateViolations(module, inventory, context, requests, report);
  literalViolations(module, inventory, report, roots, hirSchema);
  obligationViolations(module, inventory, context, report);
  verifyHirCaptures(inventory.nodes, {
    nodeOf: reference => localSourceNode(reference, module, inventory),
    nodeExists: reference => sourceNodeExists(reference, module, inventory, context),
    referenceOf: node => hirNodeSource(node, inventory, module),
  }, report, hirSchema);
  violations.push(...verifyBindingVectors(requests, context));
  return Object.freeze(violations);
};
