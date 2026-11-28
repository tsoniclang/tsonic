import { requirePresent, throwInvariant } from "../../diag/index.js";
import type { DataflowResult } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../../dataflow/index.js";
import type { DefId, ItemNodeRef, LocalId, NodeId, PlaceId, TyId } from "../../ids/contract.js";
import { decodeDefId } from "../../ids/index.js";
import type { LogicalCellRow } from "../../ir-facts/contract.js";
import type { MirBody, MirOperand, MirPlace } from "../../ir-mir/contract.js";
import type { TirNode, TirSyntaxOccurrence } from "../../ir-tir/contract.js";
import type { ArtifactBindings } from "../../ir-types/contract.js";
import type { BodyRoundDeps, BodyRoundInput } from "./contract.js";
import { orderedRows } from "./source.js";

export function bodyFrontier(message: string): never {
  return throwInvariant({ owner: "analyses/body", query: null, origin: null, message });
}

export type StorageSlot = number | { readonly kind: "absence"; readonly root: number };
export type StorageSlots = ReadonlyMap<PlaceId, StorageSlot> | null;

export interface StaticCells {
  readonly slots: ReadonlyMap<PlaceId, StorageSlot>;
  readonly cells: readonly LogicalCellRow[];
  readonly external: ReadonlySet<PlaceId>;
}

export function rootSlot(body: MirBody, place: PlaceId, slots: StorageSlots): number {
  const base = body.places[place]?.base;
  if (base?.kind === "local") return base.local;
  if (base?.kind === "checked" && base.projection.kind === "refined") {
    const parent = body.places[base.place]?.base;
    if (parent?.kind === "local") return parent.local;
  }
  const slot = base?.kind === "static" ? slots?.get(place) : undefined;
  if (typeof slot !== "number") return bodyFrontier("A root place requires its actual selected logical-cell binding.");
  return slot;
}

export function readSlot(body: MirBody, place: PlaceId, slots: StorageSlots): StorageSlot {
  const base = body.places[place]?.base;
  if (base?.kind === "place" && base.projection.kind === "element") {
    const root = slots?.get(place);
    if (root === undefined) return bodyFrontier("A tuple projection requires its actual proven inline parent and local root.");
    return root;
  }
  return rootSlot(body, place, slots);
}

export function inlineTupleSlots(deps: BodyRoundDeps, input: BodyRoundInput, projections: readonly MirPlace[],
  roots: ReadonlyMap<number, ReadonlySet<TyId> | null>): DataflowResult<Map<PlaceId, StorageSlot>> {
  const { account } = deps;
  const { mir, tir } = input;
  const start = chargeResultEntries(account, 1);
  if (start !== null) return start;
  const slots = new Map<PlaceId, StorageSlot>();
  for (let position = 0; position < projections.length; position += 1) {
    const work = chargeWork(account, 3);
    if (work !== null) return work;
    const place = projections[position];
    const base = place?.base;
    if (place === undefined || base?.kind !== "place" || base.projection.kind !== "element" || base.tir.body !== tir.body
      || base.place >= place.id || slots.has(place.id))
      return bodyFrontier("A tuple projection retains its own occurrence and preceding typed parent.");
    const parent = mir.places[base.place];
    const root = parent?.base.kind === "local" ? parent.base.local : slots.get(base.place);
    const absence = typeof root === "number" ? roots.get(root) : undefined;
    if (parent?.id !== base.place || typeof root !== "number" || absence === undefined)
      return bodyFrontier("A tuple projection requires its actual proven inline parent and local root.");
    const type = deps.typeOf(parent.storage);
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    const index = base.projection.index;
    if (type.kind !== "tuple" || !Number.isSafeInteger(index) || Object.is(index, -0) || index < 0 || index >= type.elements.length)
      return bodyFrontier("A tuple projection requires its actual required native slot.");
    const reached = chargeWork(account, 1);
    if (reached !== null) return reached;
    const slot = type.elements[index];
    if (slot?.kind !== "required" || slot.type !== place.storage)
      return bodyFrontier("A tuple projection requires its actual required native slot.");
    if (absence !== null) {
      const proof = chargeWork(account, 1);
      if (proof !== null) return proof;
    }
    const absent = absence?.has(slot.type) === true;
    const retain = chargeResultEntries(account, absent ? 2 : 1);
    if (retain !== null) return retain;
    slots.set(place.id, absent ? { kind: "absence", root } : root);
  }
  return { kind: "complete", value: slots };
}

export function staticCells(deps: BodyRoundDeps, input: BodyRoundInput, source: ReadonlyMap<NodeId, TirSyntaxOccurrence>, locationCaptureCount: number,
  preparedSlots: Map<PlaceId, StorageSlot> | null):
  DataflowResult<StaticCells> {
  const { mir, tir } = input;
  const { account } = deps;
  const start = chargeWork(account, 1) ?? chargeResultEntries(account, preparedSlots === null ? 8 : 7);
  if (start !== null) return start;
  if (mir.bindings.kind !== "instantiated")
    return bodyFrontier("BodyAnalysis requires the actual selected projection or static-cell producer for this place.");
  const declarations = new Map<DefId, Extract<TirNode, { readonly kind: "VariableDeclaration" }>>();
  const references = new Map<DefId, { readonly source: ItemNodeRef; readonly storage: TyId }>();
  for (const node of source.values()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (node.kind === "Identifier" && (node.tsonic.role === "value" || node.tsonic.role === "assignment-target")
      && node.tsonic.resolution.kind === "static") {
      const reference = node.tsonic.resolution.declaration;
      const storage = node.tsonic.role === "value" ? node.tsonic.type : node.tsonic.access.storage;
      const lookup = chargeWork(account, reference.owner.length);
      if (lookup !== null) return lookup;
      const prior = references.get(reference.owner);
      if (prior === undefined) {
        const retained = chargeResultEntries(account, 2);
        if (retained !== null) return retained;
        references.set(reference.owner, { source: reference, storage });
      } else if (prior.source.node !== reference.node || prior.storage !== storage)
        return bodyFrontier("One static reference must retain its actual declaration node and storage.");
      continue;
    }
    if (node.kind !== "VariableDeclaration" || !("declaration" in node.tsonic) || node.tsonic.declaration.kind !== "definition") continue;
    const definition = node.tsonic.declaration.definition;
    const admission = chargeWork(account, definition.length) ?? chargeResultEntries(account, 1);
    if (admission !== null) return admission;
    declarations.set(definition, node);
  }
  const destinations = new Set<PlaceId>();
  for (let index = 0; index < mir.blocks.length; index += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const call = mir.blocks[index]?.terminator;
    if (call?.kind !== "call" || call.destination === null) continue;
    const place = mir.places[call.destination];
    if (place?.base.kind !== "static") continue;
    const definition = place.base.definition;
    const read = chargeWork(account, 1 + definition.length);
    if (read !== null) return read;
    const declaration = source.get(call.tir.node);
    if (call.tir.body !== tir.body || call.callee.kind !== "body"
      || declaration?.kind !== "VariableDeclaration" || !("declaration" in declaration.tsonic) || declaration.tsonic.declaration.kind !== "definition"
      || declaration.tsonic.declaration.definition !== definition || declaration.tsonic.storage !== place.storage
      || declaration.tsonic.initializer !== call.callee.instance.body || destinations.has(call.destination))
      return bodyFrontier("A module static retains its actual declaration, storage and placed initializer.");
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    destinations.add(call.destination);
  }
  const named = new Set<DefId>();
  const external = new Set<PlaceId>();
  const rows: { readonly place: PlaceId; readonly declaration: ItemNodeRef; readonly bindings: ArtifactBindings }[] = [];
  for (const place of mir.places) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    if (place.base.kind !== "static") continue;
    const definition = place.base.definition;
    const read = chargeWork(account, 1 + definition.length);
    if (read !== null) return read;
    const declaration = declarations.get(definition);
    const reference = references.get(definition);
    if (named.has(definition) || reference !== undefined && reference.storage !== place.storage)
      return bodyFrontier("A module static-cell association retains one actual declaration root and its selected initialization disposition.");
    const growth = chargeResultEntries(account, 3);
    if (growth !== null) return growth;
    named.add(definition);
    if (declaration !== undefined) {
      if (tir.root.kind !== "SourceFile" || !("storage" in declaration.tsonic) || declaration.tsonic.storage !== place.storage
        || (declaration.tsonic.initializer !== null) !== destinations.has(place.id))
        return bodyFrontier("A module static-cell association retains one actual declaration root and its selected initialization disposition.");
      rows.push({ place: place.id, declaration: { owner: definition, node: declaration.id }, bindings: mir.bindings });
    } else {
      if (reference === undefined || destinations.has(place.id))
        return bodyFrontier("A module static-cell association retains one actual declaration root and its selected initialization disposition.");
      const origin = decodeDefId(definition);
      if (origin.kind !== "decoded") return bodyFrontier("An external static retains its qualified declaration module.");
      const bindings = deps.staticModuleBindingsOf(origin.value.module);
      const stopped = accountFailure(account);
      if (stopped !== null) return stopped;
      if (bindings?.kind !== "instantiated") return bodyFrontier("An external static retains its actual initialized module execution binding.");
      rows.push({ place: place.id, declaration: reference.source, bindings });
      external.add(place.id);
    }
  }
  const ordered = orderedRows(rows, (left, right) => {
    if (chargeWork(account, left.declaration.owner.length + right.declaration.owner.length) !== null) return 0;
    return left.declaration.owner < right.declaration.owner ? -1 : 1;
  }, account);
  if (ordered.kind !== "complete") return ordered;
  const slots = preparedSlots ?? new Map<PlaceId, StorageSlot>();
  const cells: LogicalCellRow[] = [];
  for (const row of ordered.value) {
    const growth = chargeWork(account, 1) ?? chargeResultEntries(account, 6);
    if (growth !== null) return growth;
    slots.set(row.place, mir.locals.length + cells.length);
    cells.push({ id: locationCaptureCount + cells.length,
      role: { kind: "static", declaration: { definition: row.declaration.owner, bindings: row.bindings } },
      occurrence: { kind: "declared", at: { kind: "node", node: { kind: "item", value: row.declaration } } },
      lifetimes: [] });
  }
  return { kind: "complete", value: { slots, cells, external } };
}

export function readLocal(body: MirBody, operand: Extract<MirOperand, { readonly kind: "place" }>): LocalId;
export function readLocal(body: MirBody, operand: MirOperand): LocalId | null;
export function readLocal(body: MirBody, operand: MirOperand): LocalId | null {
  if (operand.kind === "constant") return null;
  const place = requirePresent(body.places[operand.place], { owner: "analyses/body", query: null,
    origin: null, message: "A verified operand retains its actual place." });
  if (place.base.kind !== "local") return bodyFrontier("BodyAnalysis needs the actual selected logical-cell relation for this place.");
  return place.base.local;
}
