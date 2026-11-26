import type { ErrorValue } from "../diag/contract.js";
import { hostDiagnosticCode, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { SourceNodeRef, TyId } from "../ids/contract.js";
import { encodeKey, tyId } from "../ids/index.js";
import type { HirNode } from "../ir-hir/contract.js";
import type { CategoryEvidence, LiteralTypeValue, MemberInventory, MemberKey, MemberTypeRequest, SourceCategory, TypeTerm } from "../ir-types/contract.js";
import { admitTypePublicationStep, compareMemberKeys, internType, internTypeGraph, joinSourceChoice, memberTypeRequestData, readType, refuseTypeConstruction,
  substitute, typeProductionRequestData, viewTypes } from "../ir-types/index.js";
import type { DeclsDeps, ProduceType, ResumeProduceType, SelectedIndexedRead, TypeProductionPause, TypeProductionStep } from "./contract.js";

type Site = Pick<TypeProductionPause, "root" | "origin" | "unit">;

function fail(message: string): never {
  return throwInvariant({ owner: "decls", query: null, origin: null, message });
}

function unavailable(site: Site, message: string): TypeProductionStep {
  const code = "TSONIC_LOCAL_TYPE_UNSUPPORTED";
  return { kind: "done", value: { kind: "refused", diagnostics: [{
    code: { kind: "host", name: hostDiagnosticCode(code), rendered: code }, severity: "error",
    site: { kind: "source", origin: site.origin }, source: "decls", evidence: [], message, arguments: [], related: [], fix: null,
  }] } };
}

function exhausted(site: Site, dimension: string, maximum: number): TypeProductionStep {
  return { kind: "done", value: { kind: "refused", diagnostics: [resourceLimitDiagnostic({
    owner: "decls", limit: `type expansion ${dimension}`, maximum, site: { kind: "source", origin: site.origin },
    unit: { request: site.unit, position: { kind: "result" } },
  })] } };
}

function complete(site: Site, type: TyId, category: CategoryEvidence, error: ErrorValue | null = null): TypeProductionStep {
  return { kind: "done", value: { kind: "ok", value: { component: site.root, type, category,
    numeric: null, nominal: null, pointer: null, sum: null }, positions: [{ position: { kind: "result" }, error }],
  diagnostics: [], emissions: [] } };
}

function checkedType(node: HirNode): TyId {
  if (node.tsonic === null || !("type" in node.tsonic) || node.tsonic.type === null || node.tsonic.type.kind !== "available"
    || typeof node.tsonic.type.value !== "number")
    return fail("Type production requires the actual available checked operand type.");
  return node.tsonic.type.value;
}

function deferred(term: TypeTerm): boolean {
  return term.kind === "param" || term.kind === "merged-parameter" || term.kind === "self"
    || term.kind === "projection" || term.kind === "alias-application";
}

function completeSelected(site: Site, type: TyId, term: TypeTerm): TypeProductionStep {
  if (term.kind === "string" || term.kind === "literal" && term.value.kind === "string")
    return complete(site, type, { kind: "known", category: "string" });
  if (term.kind === "primitive" && term.primitive === "bool" || term.kind === "literal" && term.value.kind === "boolean")
    return complete(site, type, { kind: "known", category: "boolean" });
  if (term.kind === "primitive" && term.primitive === "float64" || term.kind === "literal" && term.value.kind === "number")
    return complete(site, type, { kind: "known", category: "number" });
  if (term.kind === "intrinsic" && term.intrinsic === "symbol" || term.kind === "literal" && term.value.kind === "unique-symbol")
    return complete(site, type, { kind: "known", category: "symbol" });
  return fail("Type production needs the actual category evidence of this selected type.");
}

function exactMemberKey(term: TypeTerm): MemberKey {
  if (term.kind !== "literal") return fail("Indexed production requires the actual exact finite property-domain producer.");
  switch (term.value.kind) {
    case "string": return { kind: "text", value: term.value.value };
    case "number": return term.value;
    case "unique-symbol": return { kind: "symbol", declaration: term.value.declaration };
    default: return fail("Indexed production requires the actual exact finite property-domain producer.");
  }
}

function indexedSelection(deps: DeclsDeps, site: Site, deferredType: TyId, receiver: TyId, index: TypeTerm): TypeProductionStep {
  const object = readType(deps.types, receiver);
  if (deferred(index) || deferred(object)) return complete(site, deferredType, { kind: "dynamic" });
  if (object.kind !== "shape" && object.kind !== "merged-interface")
    return fail("Indexed production requires the actual exact finite property-domain producer.");
  const maximum = deps.typeExpansion.maximumUnionMembers;
  if (object.kind === "shape" && object.members.length > maximum || (index.kind === "union" ? index.members.length : 1) > maximum)
    return exhausted(site, "union-members", maximum);
  const keys: MemberKey[] = [];
  if (index.kind === "union") for (const member of index.members) {
    const arm = readType(deps.types, member);
    if (deferred(arm)) return complete(site, deferredType, { kind: "dynamic" });
    keys.push(exactMemberKey(arm));
  }
  else keys.push(exactMemberKey(index));
  if (keys.length > 1) keys.sort(compareMemberKeys);
  const { root, origin, unit } = site;
  return { kind: "paused", paused: { root, origin, unit, kind: "inventory", receiver, keys },
    requests: [{ kind: "membersOf", receiver }], earned: [] };
}

function indexedMember(site: Site, requests: readonly MemberTypeRequest[], next: number,
  completed: SelectedIndexedRead | null): TypeProductionStep {
  const request = requests[next];
  if (request === undefined) return fail("Indexed production needs its actual next selected read.");
  const { root, origin, unit } = site;
  return { kind: "paused", paused: { kind: "member", root, origin, unit, requests, next, completed },
    requests: [{ kind: "memberTypeOf", request }], earned: [] };
}

function indexedMembers(site: Site, inventory: MemberInventory, keys: readonly MemberKey[]): TypeProductionStep {
  const requests: MemberTypeRequest[] = [];
  let member = 0;
  let previous: MemberKey | undefined;
  for (const key of keys) {
    if (previous !== undefined && compareMemberKeys(previous, key) === 0) continue;
    previous = key;
    for (;;) {
      const entry = inventory.members[member];
      if (entry === undefined) return unavailable(site, noIndexedMember(inventory));
      const comparison = compareMemberKeys(entry.key, key);
      if (comparison > 0) return unavailable(site, noIndexedMember(inventory));
      if (comparison === 0) {
        requests.push({ receiver: inventory.receiver, member, access: "read" });
        member += 1;
        break;
      }
      member += 1;
    }
  }
  return indexedMember(site, requests, 0, null);
}

function noIndexedMember(inventory: MemberInventory): string {
  return inventory.indexes.length === 0 ? "The indexed property key is absent from its complete inventory."
    : "The indexed key has no exact named member; index-signature selection requires its own producer.";
}

type KeyCategory = Extract<SourceCategory, "number" | "string" | "symbol">;

function keyCategory(key: MemberKey): KeyCategory {
  return key.kind === "text" ? "string" : key.kind;
}

function keyLiteral(key: MemberKey): LiteralTypeValue {
  switch (key.kind) {
    case "text": return { kind: "string", value: key.value };
    case "number": return { kind: "number", value: key.value };
    case "symbol": return { kind: "unique-symbol", declaration: key.declaration };
  }
}

function keyDomain(deps: DeclsDeps, site: Site, inventory: MemberInventory): TypeProductionStep {
  const wide = new Set<KeyCategory>();
  const stopped = () => admitTypePublicationStep(deps.typeWork);
  for (let position = 0; position < inventory.indexes.length; position++) {
    const stop = stopped();
    if (stop !== null) return { kind: "done", value: refuseTypeConstruction(deps.typeWork, stop, site.origin, site.unit) };
    const index = inventory.indexes[position];
    if (index === undefined) return fail("The actual member index inventory is dense.");
    const type = readType(deps.types, index.key);
    if (type.kind === "string") { wide.add("string"); wide.add("number"); }
    else if (type.kind === "primitive" && type.primitive === "float64") wide.add("number");
    else if (type.kind === "intrinsic" && type.intrinsic === "symbol") wide.add("symbol");
    else return fail("Bound keyof requires the actual effective key domain of its non-scalar index signature.");
  }
  const maximum = deps.typeExpansion.maximumUnionMembers;
  if (wide.size > maximum || wide.size === 0 && inventory.members.length > maximum)
    return exhausted(site, "union-members", maximum);
  const keys: MemberKey[] = [];
  for (let position = 0; position < inventory.members.length; position++) {
    const stop = stopped();
    if (stop !== null) return { kind: "done", value: refuseTypeConstruction(deps.typeWork, stop, site.origin, site.unit) };
    const member = inventory.members[position];
    if (member === undefined) return fail("The actual member inventory is dense.");
    if (wide.has(keyCategory(member.key))) continue;
    if (keys.length + wide.size >= maximum) return exhausted(site, "union-members", maximum);
    keys.push(member.key);
  }
  const bases = new Map<KeyCategory, TyId>();
  const baseOf = (category: KeyCategory): TyId => {
    let base = bases.get(category);
    if (base === undefined) {
      base = internType(deps.types, category === "string" ? { kind: "string" }
        : category === "number" ? { kind: "primitive", primitive: "float64" } : { kind: "intrinsic", intrinsic: "symbol" });
      bases.set(category, base);
    }
    return base;
  };
  const members = Array.from(wide, baseOf);
  const terms = keys.map((key): TypeTerm => ({ kind: "literal", base: baseOf(keyCategory(key)), value: keyLiteral(key) }));
  const table = viewTypes(deps.types);
  const typeBase = table.terms.length;
  for (let position = 0; position < terms.length; position++) members.push(tyId(typeBase + position));
  terms.push({ kind: "union", members });
  const graph = internTypeGraph({ types: deps.types, work: deps.typeWork },
    { typeBase, signatureBase: table.signatures.length, terms, signatures: [] });
  if (graph.kind !== "complete") return { kind: "done", value: refuseTypeConstruction(deps.typeWork, graph, site.origin, site.unit) };
  const domain = graph.value.types.at(-1);
  if (domain === undefined) return fail("The staged graph returns the actual selected key domain.");
  const alternatives = [...bases.keys()].sort().map<CategoryEvidence>(category => ({ kind: "known", category }));
  const first = alternatives[0];
  return complete(site, domain, first === undefined ? { kind: "dynamic" }
    : alternatives.length === 1 ? first : { kind: "choice", alternatives });
}

export const produceType: ProduceType = (deps, request, operator, unit, match) => {
  if (operator.kind !== "IndexedAccessType" && operator.kind !== "ConditionalType"
    && (operator.kind !== "TypeOperator" || operator.operator !== "KeyOfKeyword")
    || operator.id !== request.component.root.value.node || request.component.path.length !== 0)
    return fail("Direct type production requires its actual qualified checked operator.");
  const site = { root: request.component.root, origin: operator.origin, unit };
  const captured = checkedType(operator);
  const template = readType(deps.types, captured);
  if (template.kind !== "projection") return fail("Type production requires an actual unreduced checked projection.");
  if (operator.kind === "IndexedAccessType") {
    if (template.projection.kind !== "indexed" || template.source !== checkedType(operator.objectType)
      || template.projection.index !== checkedType(operator.indexType))
      return fail("Indexed production requires its own captured projection and actual checked operands.");
  } else if (operator.kind === "TypeOperator") {
    if (template.projection.kind !== "keyof" || template.source !== checkedType(operator.type))
      return fail("Keyof production requires its own captured projection and actual checked target.");
  } else if (template.projection.kind !== "conditional" || template.source !== checkedType(operator.checkType)
    || template.projection.extends !== checkedType(operator.extendsType)
    || template.projection.whenTrue !== checkedType(operator.trueType) || template.projection.whenFalse !== checkedType(operator.falseType))
    return fail("Conditional production requires its own captured projection and actual checked operands.");
  const transformed = substitute(deps.types, [captured], request.bindings, deps.typeExpansion, deps.typeWork);
  if (transformed.kind === "resource-limit") return transformed.dimension === "work" || transformed.dimension === "created-records"
    ? { kind: "done", value: refuseTypeConstruction(deps.typeWork, transformed, site.origin, site.unit) }
    : exhausted(site, transformed.dimension, transformed.maximum);
  const [type] = transformed.value;
  if (type === undefined) return fail("One projection must have one substituted type.");
  const projection = readType(deps.types, type);
  if (projection.kind !== "projection" || projection.projection.kind !== template.projection.kind)
    return fail("Types substitution must retain the actual projection kind.");
  if (projection.projection.kind === "keyof") {
    const receiver = projection.source;
    if (deferred(readType(deps.types, receiver))) return complete(site, type, { kind: "dynamic" });
    return { kind: "paused", paused: { ...site, kind: "keys", receiver },
      requests: [{ kind: "membersOf", receiver }], earned: [] };
  }
  if (projection.projection.kind === "conditional") {
    const conditional = projection.projection;
    if (conditional.inferParameters.length !== 0) return complete(site, type, { kind: "dynamic" });
    const check = readType(deps.types, projection.source);
    if (deferred(check)) return complete(site, type, { kind: "dynamic" });
    const pattern = readType(deps.types, conditional.extends);
    if (deferred(pattern)) return complete(site, type, { kind: "dynamic" });
    const selected = match(check, pattern) === "match" ? conditional.whenTrue : conditional.whenFalse;
    return completeSelected(site, selected, readType(deps.types, selected));
  }
  if (projection.projection.kind !== "indexed") return fail("Indexed production requires its actual indexed projection.");
  const index = readType(deps.types, projection.projection.index);
  if (operator.kind === "IndexedAccessType" && index.kind === "projection"
    && (operator.indexType.kind === "ConditionalType" || operator.indexType.kind === "IndexedAccessType"
      || operator.indexType.kind === "TypeOperator" && operator.indexType.operator === "KeyOfKeyword")
    && readType(deps.types, checkedType(operator.indexType)).kind === "projection") {
    const child = operator.indexType.id;
    const root: SourceNodeRef = site.root.kind === "item"
      ? { kind: "item", value: { owner: site.root.value.owner, node: child } }
      : { kind: "body", value: { body: site.root.value.body, node: child } };
    const childRequest = { component: { root, path: [] }, bindings: request.bindings };
    return { kind: "paused", paused: { ...site, kind: "index", receiver: projection.source, projection: type, request: childRequest },
      requests: [{ kind: "produceType", request: childRequest }], earned: [] };
  }
  return indexedSelection(deps, site, type, projection.source, index);
};

export const resumeProduceType: ResumeProduceType = (deps, paused, answers) => {
  const [answer] = answers;
  if (answers.length !== 1 || answer === undefined) return fail("Type production requires its one actual dependency answer.");
  if (paused.kind === "index") {
    if (answer.kind !== "produceType" || answer.origin.position.kind !== "result" || answer.origin.request.query !== "produceType"
      || encodeKey(answer.origin.request.key) !== encodeKey(typeProductionRequestData(paused.request)))
      return fail("Indexed production requires the completed result of its actual index operand.");
    const term = readType(deps.types, answer.value.type);
    if (answer.error !== null) {
      if (term.kind !== "error") return fail("An erroneous index operand requires its actual error type.");
      return complete(paused, answer.value.type, { kind: "dynamic" }, { kind: "error", causes: [{ kind: "unit", unit: answer.origin }] });
    }
    return indexedSelection(deps, paused, paused.projection, paused.receiver, term);
  }
  if (paused.kind === "inventory" || paused.kind === "keys") {
    if (answer.kind !== "membersOf" || answer.value.receiver !== paused.receiver)
      return fail("Type production requires the completed inventory of its actual receiver.");
    if (answer.value.completeness.kind !== "complete")
      return unavailable(paused, paused.kind === "keys" ? "Keyof does not have a complete finite property inventory."
        : "Indexed access does not have a complete finite property inventory.");
    if (paused.kind === "keys") return keyDomain(deps, paused, answer.value);
    if (answer.value.members.length > deps.typeExpansion.maximumUnionMembers)
      return exhausted(paused, "union-members", deps.typeExpansion.maximumUnionMembers);
    return indexedMembers(paused, answer.value, paused.keys);
  }
  const selected = paused.requests[paused.next];
  if (selected === undefined || answer.kind !== "memberTypeOf" || answer.request.receiver !== selected.receiver
    || answer.request.member !== selected.member || answer.request.access !== selected.access || answer.value.access !== "read")
    return fail("Indexed production requires its actual selected member answer.");
  const { request, position } = answer.origin;
  const key = request.key;
  const expected = memberTypeRequestData(selected);
  if (position.kind !== "result" || request.query !== "memberTypeOf" || !Array.isArray(key)
    || key.length !== expected.length || expected.some((part, index) => key[index] !== part))
    return fail("Indexed production requires its actual completed member result position.");
  const type = answer.value.read;
  if (type === null) return unavailable(paused, "The selected indexed property has no read type.");
  const term = readType(deps.types, type);
  if (answer.error !== null) {
    if (term.kind !== "error") return fail("An erroneous member answer requires its actual error type.");
    return complete(paused, type, { kind: "dynamic" }, { kind: "error", causes: [{ kind: "unit", unit: answer.origin }] });
  }
  if (term.kind === "error") return fail("An erroneous member answer requires its actual original error.");
  if (paused.next + 1 < paused.requests.length)
    return indexedMember(paused, paused.requests, paused.next + 1, { type, previous: paused.completed });
  if (paused.completed === null) return completeSelected(paused, type, term);
  const members = [type];
  for (let read: SelectedIndexedRead | null = paused.completed; read !== null; read = read.previous) members.push(read.type);
  const choice = joinSourceChoice({ types: deps.types, work: deps.typeWork }, members, deps.typeExpansion);
  if (choice.kind === "resource-limit") return choice.dimension === "work" || choice.dimension === "created-records"
    ? { kind: "done", value: refuseTypeConstruction(deps.typeWork, choice, paused.origin, paused.unit) }
    : exhausted(paused, choice.dimension, choice.maximum);
  if (choice.kind === "unavailable") return unavailable(paused, choice.reason === "numeric-inclusion"
    ? "The selected number domain lacks exact inclusion evidence for its numeric singleton."
    : "The selected reads require an exact non-scalar result choice.");
  return complete(paused, choice.value.type, choice.value.category);
};
