import { throwInvariant } from "../diag/index.js";
import type { HirBindingTarget, HirExportTarget, HirModuleBinding, HirModuleExport, CapturedFact } from "../ir-hir/contract.js";
import type { MemberKey, MemberOrigin } from "../ir-types/contract.js";
import type { LowerDeps, ModuleExports, RawBinding, RawBindingTarget, RawFact, RawMemberKey, RawMemberOrigin, RawModule, RawNodeRef } from "./contract.js";

function fail(message: string): never {
  return throwInvariant({ owner: "front", query: null, origin: null, message });
}

function fact<Value, Lowered>(raw: RawFact<Value>, convert: (value: Value) => Lowered): CapturedFact<Lowered> {
  return raw.kind === "available" ? { kind: "available", value: convert(raw.value) } : { kind: "unavailable", reason: raw.reason };
}

function declarations(deps: LowerDeps, references: readonly RawNodeRef[]): HirExportTarget {
  const first = references[0];
  if (first === undefined) return fail("An exported declaration group must retain at least one actual declaration.");
  const binding = deps.bindingOccurrenceOf(first);
  if (binding !== null) {
    if (references.length !== 1) return fail("An exported binding cannot be combined with chosen declaration representatives.");
    return { kind: "binding", occurrence: binding };
  }
  const definitions = [deps.definitionOf(first)];
  for (const reference of references.slice(1)) {
    if (deps.bindingOccurrenceOf(reference) !== null) return fail("A declaration group cannot silently absorb a binding occurrence.");
    definitions.push(deps.definitionOf(reference));
  }
  return { kind: "declarations", definitions: [definitions[0] ?? fail("A declaration group lost its first actual declaration."), ...definitions.slice(1)] };
}

function keyOf(deps: LowerDeps, key: RawMemberKey): MemberKey {
  if (key.kind === "text") return key;
  if (key.kind === "symbol") return { kind: "symbol", declaration: deps.definitionOf(key.declaration) };
  throw new TypeError("front: exact numeric binding-member key conversion is not implemented");
}

function originOf(deps: LowerDeps, origin: RawMemberOrigin): MemberOrigin {
  if (origin.kind === "declaration") return { kind: "declared", declaration: deps.definitionOf(origin.declaration) };
  if (origin.kind === "class-prototype") return { kind: "class-prototype", owner: deps.definitionOf(origin.declaration) };
  throw new TypeError("front: mapped binding-member origin conversion is not implemented");
}

function targetOf(deps: LowerDeps, target: RawBindingTarget): HirBindingTarget {
  switch (target.kind) {
    case "declarations": return declarations(deps, target.declarations);
    case "binding": return { kind: "binding", occurrence: deps.bindingOccurrenceOf(target.occurrence)
      ?? fail("A nearest binding hop must have its actual ready qualified occurrence.") };
    case "module": return target;
    case "member": return { kind: "member", through: declarations(deps, target.through),
      key: fact(target.key, key => keyOf(deps, key)), origins: fact(target.origins, origins => origins.map(origin => originOf(deps, origin))) };
  }
}

function bindingOf(deps: LowerDeps, raw: RawBinding): HirModuleBinding {
  const occurrence = deps.bindingOccurrenceOf(raw.binding) ?? fail("A captured binding must have a genuine ready source owner and syntax occurrence.");
  const first = raw.target.kind === "unavailable" && raw.target.reason === "checker-error" ? raw.target.diagnostics[0] : undefined;
  if (first !== undefined && raw.target.kind === "unavailable") return { occurrence, target: { kind: "available", value: {
    kind: "unresolved", diagnostics: [first, ...raw.target.diagnostics.slice(1)] } } };
  return { occurrence, target: fact(raw.target, target => targetOf(deps, target)) };
}

export function lowerBindings(deps: LowerDeps, raw: RawModule): ModuleExports {
  const groups = new Map<string, RawNodeRef[]>();
  for (const entry of raw.exports) {
    const group = groups.get(entry.name) ?? [];
    group.push(entry.declaration);
    groups.set(entry.name, group);
  }
  const entries: HirModuleExport[] = [];
  const names = [...groups.keys()].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  for (const name of names) {
    const group = groups.get(name) ?? fail("An exported name lost its actual raw declaration inventory.");
    group.sort((left, right) => left.module < right.module ? -1 : left.module > right.module ? 1 : left.node - right.node);
    for (let index = 1; index < group.length; index += 1) {
      const previous = group[index - 1];
      const current = group[index];
      if (previous !== undefined && current !== undefined && previous.module === current.module && previous.node === current.node)
        return fail("An exported declaration group must not repeat one captured declaration occurrence.");
    }
    entries.push({ name, target: declarations(deps, group) });
  }
  const seen = new Set<RawNodeRef["node"]>();
  const bindings: HirModuleBinding[] = [];
  for (const binding of raw.bindings) {
    if (binding.binding.module !== raw.module || seen.has(binding.binding.node))
      return fail("Each binding occurrence must have one owning raw module row.");
    seen.add(binding.binding.node);
    bindings.push(bindingOf(deps, binding));
  }
  return { module: raw.module, entries, bindings };
}
