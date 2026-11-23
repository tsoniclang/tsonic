import { throwInvariant } from "../diag/index.js";
import type { CheckerDiagnosticRef } from "../diag/contract.js";
import type { DefId, RawComponentId, SourceNodeRef } from "../ids/contract.js";
import { decodeBodyId, decodeDefId } from "../ids/index.js";
import type { HirBindingTarget, HirExportTarget, HirModuleBinding, HirModuleExport, CapturedFact } from "../ir-hir/contract.js";
import type { MemberKey, MemberOrigin } from "../ir-types/contract.js";
import type { LowerDeps, ModuleExports, ModuleSourceOccurrence, RawBindingTarget, RawFact, RawMemberKey, RawMemberOrigin, RawModule, RawNodeRef } from "./contract.js";
import { isModuleBindingKind } from "../ir-hir/index.js";
import { captureCheckerNumber } from "./literals.js";
import type { LiteralLoweringQuery, LiteralResult } from "./literals.js";

export interface MemberKeyLowering {
  readonly deps: LowerDeps;
  readonly raw: Pick<RawModule, "module">;
  readonly query: LiteralLoweringQuery;
  checkerNumberBits: DataView | null;
}

function fail(message: string): never {
  return throwInvariant({ owner: "front", query: null, origin: null, message });
}

export function sameSource(actual: RawNodeRef | null | undefined, expected: RawNodeRef): boolean {
  return actual?.module === expected.module && actual.node === expected.node;
}

export function sourceOccurrence(deps: LowerDeps, reference: RawNodeRef): ModuleSourceOccurrence | null {
  const source = deps.sourceOccurrenceOf(reference);
  if (source === null) return null;
  if (source.node !== reference.node || source.occurrence.value.node !== reference.node)
    return fail("A ready source occurrence must retain its exact captured syntax identity.");
  let owner: DefId;
  if (source.occurrence.kind === "item") owner = source.occurrence.value.owner;
  else {
    const body = decodeBodyId(source.occurrence.value.body);
    if (body.kind !== "decoded") return fail("A ready source occurrence must retain its actual body identity.");
    owner = body.value.owner;
  }
  const definition = decodeDefId(owner);
  if (definition.kind !== "decoded" || definition.value.module !== reference.module)
    return fail("A ready source occurrence must belong to its actual captured module.");
  return source;
}

export function bindingOccurrence(deps: LowerDeps, reference: RawNodeRef): SourceNodeRef | null {
  const source = sourceOccurrence(deps, reference);
  if (source === null) return null;
  return isModuleBindingKind(source.kind, true) ? source.occurrence : null;
}

function declarations(deps: LowerDeps, references: readonly RawNodeRef[]): HirExportTarget {
  const first = references[0];
  if (first === undefined) return fail("An exported declaration group must retain at least one actual declaration.");
  const binding = bindingOccurrence(deps, first);
  if (binding !== null) {
    if (references.length !== 1) return fail("An exported binding cannot be combined with chosen declaration representatives.");
    return { kind: "binding", occurrence: binding };
  }
  const definitions: [DefId, ...DefId[]] = [deps.definitionOf(first)];
  for (let index = 1; index < references.length; index += 1) {
    const reference = references[index] ?? fail("A declaration group cannot contain a missing declaration.");
    if (bindingOccurrence(deps, reference) !== null) return fail("A declaration group cannot silently absorb a binding occurrence.");
    definitions.push(deps.definitionOf(reference));
  }
  return { kind: "declarations", definitions };
}

export function lowerMemberKey(context: MemberKeyLowering, key: RawMemberKey): LiteralResult<MemberKey> {
  if (key.kind === "text") return { kind: "complete", value: key };
  if (key.kind === "symbol")
    return { kind: "complete", value: { kind: "symbol", declaration: context.deps.definitionOf(key.declaration) } };
  if (key.kind === "private") throw new TypeError("front: private member key lowering requires checked class support");
  if (key.origin === undefined || key.origin.derived.length !== 0 || key.origin.length <= 0)
    return fail("A numeric member key requires its actual authored source name.");
  return captureCheckerNumber(context.deps.literalCapture, key.value, key.origin, context.raw.module, context, context.query);
}

export function lowerMemberOrigin(deps: LowerDeps, origin: RawMemberOrigin,
  mapped?: { readonly component: RawComponentId; readonly key: MemberKey }): MemberOrigin {
  if (origin.kind === "declaration") return { kind: "declared", declaration: deps.definitionOf(origin.declaration) };
  if (origin.kind === "class-prototype") return { kind: "class-prototype", owner: deps.definitionOf(origin.declaration) };
  if (origin.kind === "intrinsic") return { kind: "intrinsic", symbol: origin.symbol };
  if (origin.kind === "source-member") {
    const source = sourceOccurrence(deps, origin.occurrence);
    if ((source?.kind !== "PropertyAssignment" && source?.kind !== "BindingElement") || source.occurrence.kind !== "body")
      return fail("A source member requires its actual body-qualified property assignment or binding element.");
    return { kind: "source-member", occurrence: source.occurrence.value };
  }
  if (mapped === undefined) throw new TypeError("front: mapped binding-member origin conversion is not implemented");
  if (origin.source !== mapped.component) throw new TypeError("front: a mapped member requires its actual captured containing component");
  const source = sourceOccurrence(deps, origin.declaration);
  if (source?.kind !== "MappedType" || source.occurrence.kind !== "item")
    return fail("A mapped member must retain its actual declaration-qualified MappedType.");
  return { kind: "mapped", owner: source.occurrence, key: mapped.key };
}

export function lowerBindingTarget(context: MemberKeyLowering, target: RawBindingTarget): LiteralResult<HirBindingTarget> {
  const { deps } = context;
  switch (target.kind) {
    case "declarations": return { kind: "complete", value: declarations(deps, target.declarations) };
    case "binding": return { kind: "complete", value: { kind: "binding", occurrence: bindingOccurrence(deps, target.occurrence)
      ?? fail("A nearest binding hop must have its actual ready qualified occurrence.") } };
    case "module": return { kind: "complete", value: target };
    case "member": {
      const through = declarations(deps, target.through);
      let key: CapturedFact<MemberKey>;
      if (target.key.kind === "available") {
        const selected = lowerMemberKey(context, target.key.value);
        if (selected.kind !== "complete") return selected;
        key = { kind: "available", value: selected.value };
      } else key = target.key;
      const origins: CapturedFact<readonly MemberOrigin[]> = target.origins.kind === "available"
        ? { kind: "available", value: target.origins.value.map(origin => lowerMemberOrigin(deps, origin)) } : target.origins;
      return { kind: "complete", value: { kind: "member", through, key, origins } };
    }
  }
}

export function lowerBindingFact(context: MemberKeyLowering, raw: RawFact<RawBindingTarget>): LiteralResult<CapturedFact<HirBindingTarget>> {
  if (raw.kind === "unavailable" && raw.reason === "checker-error") {
    let diagnostics: [CheckerDiagnosticRef, ...CheckerDiagnosticRef[]] | null = null;
    for (const cause of raw.causes) {
      if (cause.kind !== "diagnostic" || cause.diagnostic.kind !== "checker") return { kind: "complete", value: raw };
      if (diagnostics === null) diagnostics = [cause.diagnostic.diagnostic];
      else diagnostics.push(cause.diagnostic.diagnostic);
    }
    if (diagnostics !== null) return { kind: "complete", value: { kind: "available", value: { kind: "unresolved", diagnostics } } };
  }
  if (raw.kind === "unavailable") return { kind: "complete", value: raw };
  const target = lowerBindingTarget(context, raw.value);
  return target.kind === "complete" ? { kind: "complete", value: { kind: "available", value: target.value } } : target;
}

export function lowerBindings(deps: LowerDeps, raw: RawModule): LiteralResult<ModuleExports> {
  const context: MemberKeyLowering = { deps, raw, checkerNumberBits: null, query: "lowerModuleExports" };
  const entries: HirModuleExport[] = [];
  const ordered = raw.exports.slice().sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  let previousName: string | null = null;
  for (const entry of ordered) {
    if (entry.name === previousName) return fail("An exported name requires one actual native declaration group.");
    previousName = entry.name;
    const group = entry.declarations.slice().sort((left, right) => left.module < right.module ? -1 : left.module > right.module ? 1 : left.node - right.node);
    for (let index = 1; index < group.length; index += 1) {
      const previous = group[index - 1];
      const current = group[index];
      if (previous !== undefined && current !== undefined && previous.module === current.module && previous.node === current.node)
        return fail("An exported declaration group must not repeat one captured declaration occurrence.");
    }
    const star = entry.typeOnlyStar === null ? null : sourceOccurrence(deps, entry.typeOnlyStar);
    if (entry.typeOnlyStar !== null && star?.kind !== "ExportDeclaration")
      return fail("A type-only export star needs its actual qualified export declaration.");
    entries.push({ name: entry.name, target: declarations(deps, group), typeOnlyStar: star?.occurrence ?? null });
  }
  const seen = new Set<RawNodeRef["node"]>();
  const bindings: HirModuleBinding[] = [];
  for (const binding of raw.bindings) {
    if (binding.binding.module !== raw.module || seen.has(binding.binding.node))
      return fail("Each binding occurrence must have one owning raw module row.");
    seen.add(binding.binding.node);
    const occurrence = bindingOccurrence(deps, binding.binding) ?? fail("A captured binding must have a genuine ready source owner and syntax occurrence.");
    const target = lowerBindingFact(context, binding.target);
    if (target.kind !== "complete") return target;
    bindings.push({ occurrence, target: target.value });
  }
  return { kind: "complete", value: { module: raw.module, entries, bindings } };
}
