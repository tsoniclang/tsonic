import type { Result, UnitRequest, UnitResult } from "../diag/contract.js";
import type { DefId, SigId, TyId } from "../ids/contract.js";
import { admitTypePublicationStep, compareIndexSignatures, internType, memberTypeRequestData, readSignature, readType, refuseTypeConstruction,
  substitute, substituteSignature } from "../ir-types/index.js";
import type { AccessorCorrespondence, BindingVector, ConstructorCorrespondence, InterfaceDescriptionInventory, InterfaceDescriptionRecipe,
  MemberInventory, MemberTypeAccess, MemberTypes, MemberUnavailableReason, TypeBinding, TypeTerm } from "../ir-types/contract.js";
import type { HirNode } from "../ir-hir/contract.js";
import type { DeclsDeps, MembersOf, MemberTypeOf } from "./contract.js";
import { findAscending, finishTypeTransform, moduleOf } from "./signatures.js";

type MergedType = Extract<TypeTerm, { readonly kind: "merged-interface" }>;

function ready<Value>(value: Value): Result<Value> { return { kind: "ok", value, diagnostics: [] }; }

function settle<Value>(result: Result<Value>): { readonly kind: "done"; readonly value: UnitResult<Value> } {
  return { kind: "done", value: result.kind === "refused" ? result : { ...result,
    positions: [{ position: { kind: "result" }, error: null }], emissions: [] } };
}

function mergedBindings(deps: DeclsDeps, term: MergedType, unit: UnitRequest): Result<{
  readonly recipe: InterfaceDescriptionRecipe; readonly bindings: BindingVector;
}> {
  const first = term.definitions[0];
  const selected = first === undefined ? null : deps.interfaceDescriptionOf(first);
  if (selected === null) throw new TypeError("decls: a merged interface must retain its actual checked description");
  const { group, recipe } = selected;
  const admit = (): Result<never> | null => {
    const stop = admitTypePublicationStep(deps.typeWork);
    return stop === null ? null : refuseTypeConstruction(deps.typeWork, stop, recipe.origin, unit);
  };
  if (group.definitions.length !== term.definitions.length || group.slots.length !== term.arguments.length)
    throw new TypeError("decls: a merged application must match its complete declaration and slot inventory");
  for (let position = 0; position < group.definitions.length; ++position) {
    const stop = admit();
    if (stop !== null) return stop;
    if (term.definitions[position] !== group.definitions[position])
      throw new TypeError("decls: a merged application cannot borrow a different declaration group");
  }
  const classBindings: TypeBinding[] = [];
  const capturedBindings: TypeBinding[] = [];
  for (let position = 0; position < group.slots.length; ++position) {
    const stop = admit();
    if (stop !== null) return stop;
    const slot = group.slots[position];
    const type = term.arguments[position];
    if (slot === undefined || type === undefined) throw new TypeError("decls: a merged application retains each actual binding slot");
    const bindings = slot.scope === "local" ? classBindings : capturedBindings;
    for (let index = 0; index < slot.parameters.length; ++index) {
      const paid = admit();
      if (paid !== null) return paid;
      const parameter = slot.parameters[index];
      if (parameter === undefined) throw new TypeError("decls: each merged binding slot retains every actual parameter");
      bindings.push({ kind: "bound", parameter, type });
    }
  }
  return ready({ recipe, bindings: { classBindings, capturedBindings, methodBindings: [], selfBindings: [] } });
}

function selectMemberTypes(access: MemberTypeAccess, type: (role: "read" | "write") => TyId | null): MemberTypes {
  if (access === "read") return { access, read: type("read") };
  if (access === "write") return { access, write: type("write") };
  return { access, read: type("read"), write: type("write") };
}

function bindMemberValues(deps: DeclsDeps, values: MemberTypes, selected: { readonly recipe: InterfaceDescriptionRecipe; readonly bindings: BindingVector },
  unit: UnitRequest): Result<MemberTypes> {
  const read = values.access === "write" ? null : values.read;
  const write = values.access === "read" ? null : values.write;
  const roots: TyId[] = [];
  if (read !== null) roots.push(read);
  if (write !== null && write !== read) roots.push(write);
  const result = finishTypeTransform(deps, substitute(deps.types, roots, selected.bindings, deps.typeExpansion, deps.typeWork),
    selected.recipe.origin, unit);
  if (result.kind === "refused") return result;
  const at = (position: number): TyId => {
    const value = result.value[position];
    if (value === undefined) throw new TypeError("decls: an actual member value must retain its bound type");
    return value;
  };
  return ready(selectMemberTypes(values.access, role => role === "read" ? read === null ? null : at(0)
    : write === null ? null : at(read === null || read === write ? 0 : 1)));
}

function declarationNode(deps: DeclsDeps, declaration: DefId, unit: UnitRequest): HirNode {
  const checked = moduleOf(deps, declaration, unit);
  const entry = findAscending(checked.module.items, declaration, item => item.definition);
  const node = entry === undefined ? undefined : checked.nodes[entry.node];
  if (entry === undefined || node === undefined || node.id !== entry.node)
    throw new TypeError("decls: a member correspondence requires its actual checked declaration");
  return node;
}

function constructorOf(deps: DeclsDeps, identity: SigId, unit: UnitRequest): ConstructorCorrespondence {
  const signature = readSignature(deps.types, identity);
  if (signature.kind !== "construct") throw new TypeError("decls: a construct inventory requires an actual construct signature");
  if (signature.declaration === null) return { signature: identity, declaration: null, body: null };
  const node = declarationNode(deps, signature.declaration, unit);
  if (node.tsonic === null || !("signatures" in node.tsonic))
    throw new TypeError("decls: a constructor correspondence requires its actual checked endpoint");
  const endpoints = node.tsonic.signatures.filter(endpoint => endpoint.signature === identity);
  const first = endpoints[0];
  if (first === undefined || endpoints.some(endpoint => endpoint.body !== first.body))
    throw new TypeError("decls: a constructor correspondence requires one agreeing actual body association");
  return { signature: identity, declaration: signature.declaration, body: first.body };
}

function describeInventory(deps: DeclsDeps, receiver: TyId, term: InterfaceDescriptionInventory,
  unit: UnitRequest, constructors: readonly ConstructorCorrespondence[]): MemberInventory {
  const accessors: AccessorCorrespondence[] = [];
  for (const member of term.members) {
    if (member.kind !== "accessor") continue;
    for (const origin of member.origins) {
      if (origin.kind !== "declared")
        throw new TypeError("decls: an accessor inventory requires its actual checked origin correspondence");
      const node = declarationNode(deps, origin.declaration, unit);
      if (node.kind !== "GetAccessor" && node.kind !== "SetAccessor")
        throw new TypeError("decls: an accessor origin must name its actual getter or setter declaration");
      accessors.push({ origin, getter: node.kind === "GetAccessor" ? origin.declaration : null,
        setter: node.kind === "SetAccessor" ? origin.declaration : null });
    }
  }
  return { ...term, receiver, accessors, constructors, completeness: { kind: "complete" } };
}

function mergedInventory(deps: DeclsDeps, receiver: TyId, term: MergedType, unit: UnitRequest): Result<MemberInventory> {
  const selected = mergedBindings(deps, term, unit);
  if (selected.kind === "refused") return selected;
  const { recipe, bindings } = selected.value;
  const rows = recipe.inventory(unit);
  if (rows.kind === "refused") return rows;
  const row = rows.value;
  const keyRoots = row.indexes.map(index => index.key);
  const keys = finishTypeTransform(deps, substitute(deps.types, keyRoots, bindings, deps.typeExpansion, deps.typeWork), recipe.origin, unit);
  if (keys.kind === "refused") return keys;
  const endpoints = finishTypeTransform(deps,
    substituteSignature(deps.types, [...row.calls, ...row.constructs], bindings, deps.typeExpansion, "lexical", deps.typeWork), recipe.origin, unit);
  if (endpoints.kind === "refused") return endpoints;
  const indexes = row.indexes.map((index, position) => {
    const key = keys.value[position];
    if (key === undefined) throw new TypeError("decls: each actual index must retain its bound key");
    return { ...index, key };
  }).sort(compareIndexSignatures);
  const boundAt = (position: number): SigId => {
    const signature = endpoints.value[position];
    if (signature === undefined) throw new TypeError("decls: each actual interface endpoint must retain its bound signature");
    return signature;
  };
  const calls = [...new Set(row.calls.map((_, position) => boundAt(position)))].sort((first, second) => first - second);
  const constructors = row.constructs.map((identity, position) => ({ ...constructorOf(deps, identity, unit),
    signature: boundAt(row.calls.length + position) })).sort((first, second) => first.signature - second.signature);
  const constructs = [...new Set(constructors.map(row => row.signature))];
  return ready(describeInventory(deps, receiver, { members: row.members, indexes, calls, constructs }, unit, constructors));
}

export const membersOf: MembersOf = (deps, receiver) => {
  const term = readType(deps.types, receiver);
  const unit: UnitRequest = { query: "membersOf", key: receiver };
  const open = (reason: MemberUnavailableReason): MemberInventory => ({ receiver, members: [], indexes: [], calls: [],
    constructs: [], accessors: [], constructors: [], completeness: { kind: "open", reasons: [reason] } });
  let inventory: MemberInventory;
  if (term.kind === "param") inventory = open({ kind: "parameter", parameter: term.parameter });
  else if (term.kind === "intrinsic" && (term.intrinsic === "any" || term.intrinsic === "unknown"))
    inventory = open({ kind: "dynamic" });
  else if (term.kind === "source-environment") inventory = { receiver, members: term.members, indexes: [], calls: [],
    constructs: [], accessors: [], constructors: [], completeness: { kind: "complete" } };
  else if (term.kind === "merged-interface") return settle(mergedInventory(deps, receiver, term, unit));
  else if (term.kind === "shape" || term.kind === "callable") {
    const members = term.kind === "shape" ? term.members.map(member => ({ key: member.key, origins: member.origins,
      readOrigins: member.readOrigins, writeOrigins: member.writeOrigins, kind: member.kind,
      optional: member.optional, readonly: member.readonly })) : [];
    const indexes = term.kind === "shape" ? term.indexes.map(index => ({ origin: index.origin, key: index.key,
      readonly: index.readonly })) : [];
    inventory = describeInventory(deps, receiver, { members, indexes, calls: term.calls, constructs: term.constructs }, unit,
      term.constructs.map(signature => constructorOf(deps, signature, unit)));
  } else throw new TypeError(`decls: membersOf requires the actual retained checker inventory for ${term.kind}`);
  return { kind: "done", value: { kind: "ok", value: inventory, positions: [{ position: { kind: "result" }, error: null }],
    diagnostics: [], emissions: [] } };
};

export const memberTypeOf: MemberTypeOf = (deps, request) => {
  const unit: UnitRequest = { query: "memberTypeOf", key: memberTypeRequestData(request) };
  const receiver = readType(deps.types, request.receiver);
  if (receiver.kind === "merged-interface") {
    const selected = mergedBindings(deps, receiver, unit);
    if (selected.kind === "refused") return settle(selected);
    const values = selected.value.recipe.member(unit, request.member, request.access);
    if (values.kind === "refused") return settle(values);
    if (values.value.access !== request.access) throw new TypeError("decls: a selected interface member must retain its exact requested access");
    return settle(bindMemberValues(deps, values.value, selected.value, unit));
  }
  if (receiver.kind !== "shape" && receiver.kind !== "source-environment")
    throw new TypeError("decls: memberTypeOf requires an actual retained typed member inventory");
  const ordinal = request.member;
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || Object.is(ordinal, -0) || ordinal >= receiver.members.length)
    throw new TypeError("decls: memberTypeOf requires an actual member of the receiver inventory");
  const member = receiver.members[ordinal];
  if (member === undefined) throw new TypeError("decls: the requested member is missing from its canonical inventory");
  if (member.kind !== "property" || member.origins.length === 0)
    throw new TypeError("decls: memberTypeOf requires the retained type producer for this member kind");
  if (receiver.kind === "source-environment") {
    return settle(ready(selectMemberTypes(request.access, role => {
      if (role === "write" && member.readonly) return null;
      const origins = role === "read" ? member.readOrigins : member.writeOrigins;
      const origin = origins.length === 1 ? origins[0] : undefined;
      let type;
      if (origin?.kind === "intrinsic") type = origin.symbol === "global-this" ? request.receiver
        : internType(deps.types, { kind: "intrinsic", intrinsic: "absence" });
      else if (origin?.kind === "declared") {
        const node = declarationNode(deps, origin.declaration, unit);
        if (node.kind === "VariableDeclaration" && node.tsonic.declaredType.kind === "available")
          type = node.tsonic.declaredType.value ?? undefined;
      }
      if (type === undefined || readType(deps.types, type).kind === "error")
        throw new TypeError("decls: a global member requires its exact checked selected value");
      return type;
    })));
  }
  for (const origin of member.origins) {
    if (origin.kind !== "declared")
      throw new TypeError("decls: memberTypeOf requires the retained type producer for this member origin");
    const node = declarationNode(deps, origin.declaration, unit);
    if (node.kind !== "PropertySignature" || node.type === null)
      throw new TypeError("decls: memberTypeOf requires the actual type of this property's declaration or inferred part");
  }
  if (!("read" in member)) throw new TypeError("decls: a structural field requires its checked read and write types");
  return settle(ready(selectMemberTypes(request.access, role => {
    const type = role === "read" ? member.read : member.write;
    if (role === "read" && type === null) throw new TypeError("decls: a declared structural field requires its actual read type");
    if (type !== null && readType(deps.types, type).kind === "error")
      throw new TypeError("decls: memberTypeOf cannot publish an error type without its actual cause");
    return type;
  })));
};
