import type { Result, UnitRequest } from "../diag/contract.js";
import type { Origin, RawTypeId, SigId, TyId } from "../ids/contract.js";
import type { IndexInventoryEntry, InterfaceDescriptionInventory, InterfaceDescriptionRecipe, MemberInventoryEntry, MemberTypes } from "../ir-types/contract.js";
import { admitTypePublicationStep, compareIndexSignatures, compareMemberKeys, refuseTypeConstruction } from "../ir-types/index.js";
import { sourceOccurrence } from "./bindings.js";
import type { RawFact, RawMember, RawMemberTable } from "./contract.js";
import { lowerMemberHeader } from "./lower-members.js";
import { convertRawType, signatureOf } from "./type-conversion.js";
import type { ConversionStop, TypeConversion } from "./type-conversion.js";

interface SelectedMember {
  readonly header: MemberInventoryEntry;
  readonly source: RawMember;
}

function done<Value>(value: Value): Result<Value> {
  return { kind: "ok", value, diagnostics: [] };
}

export function interfaceDescriptionRecipe(conversion: TypeConversion, original: RawMemberTable, origin: Origin): InterfaceDescriptionRecipe {
  const { deps, typeWork } = conversion;
  const refusal = (unit: UnitRequest, stop: ConversionStop): Result<never> =>
    stop.kind === "literal-limit" ? { kind: "refused", diagnostics: [stop.diagnostic] }
      : refuseTypeConstruction(typeWork, stop, origin, unit);
  let members: readonly SelectedMember[] | undefined;
  let inventory: InterfaceDescriptionInventory | undefined;
  const admit = (unit: UnitRequest, count = 1): Result<never> | null => {
    const stop = admitTypePublicationStep(typeWork, count);
    return stop === null ? null : refusal(unit, stop);
  };
  const headerRows = (unit: UnitRequest): Result<readonly SelectedMember[]> => {
    const previous = admit(unit, 0);
    if (previous !== null) return previous;
    if (members !== undefined) return done(members);
    const setup = admit(unit);
    if (setup !== null) return setup;
    const selected: SelectedMember[] = [];
    for (let position = 0; position < original.members.length; ++position) {
      const stop = admit(unit);
      if (stop !== null) return stop;
      const source = original.members[position];
      if (source === undefined) throw new TypeError("front: an interface description must retain each actual member");
      const header = lowerMemberHeader(conversion, source, original.component, typeWork);
      if (!("key" in header)) return refusal(unit, header);
      selected.push({ source, header });
    }
    selected.sort((first, second) => compareMemberKeys(first.header.key, second.header.key));
    members = selected;
    return done(members);
  };
  const typeOf = (unit: UnitRequest, identity: RawTypeId): Result<TyId> => {
    const value = convertRawType(conversion, identity);
    if (value.kind === "unavailable") throw new TypeError("front: an opened interface operand must retain its checked type");
    return value.kind === "complete" ? done(value.value.type) : refusal(unit, value);
  };
  const inventoryOf = (unit: UnitRequest): Result<InterfaceDescriptionInventory> => {
    const rows = headerRows(unit);
    if (rows.kind !== "ok") return rows;
    if (inventory !== undefined) return done(inventory);
    const setup = admit(unit);
    if (setup !== null) return setup;
    const indexes: IndexInventoryEntry[] = [];
    for (let position = 0; position < original.indexes.length; ++position) {
      const stop = admit(unit);
      if (stop !== null) return stop;
      const index = original.indexes[position];
      if (index === undefined) throw new TypeError("front: an interface description must retain each index");
      const origin = sourceOccurrence(deps, index.origin);
      if (origin?.kind !== "IndexSignature") throw new TypeError("front: an interface index must retain its own declaration");
      const key = typeOf(unit, index.key);
      if (key.kind !== "ok") return key;
      indexes.push({ origin: origin.occurrence, key: key.value, readonly: index.readonly });
    }
    const endpoints = (family: "calls" | "constructs"): Result<readonly SigId[]> => {
      const selected: SigId[] = [];
      for (let position = 0; position < original[family].length; ++position) {
        const stop = admit(unit);
        if (stop !== null) return stop;
        const identity = original[family][position];
        if (identity === undefined) throw new TypeError("front: an interface description must retain each endpoint");
        const signature = signatureOf(conversion, identity);
        if (signature.kind !== "complete") return refusal(unit, signature);
        selected.push(signature.value);
      }
      return done([...new Set(selected)].sort((first, second) => first - second));
    };
    const calls = endpoints("calls");
    if (calls.kind !== "ok") return calls;
    const constructs = endpoints("constructs");
    if (constructs.kind !== "ok") return constructs;
    inventory = { members: rows.value.map(row => row.header), indexes: indexes.sort(compareIndexSignatures),
      calls: calls.value, constructs: constructs.value };
    return done(inventory);
  };
  const member = (unit: UnitRequest, ordinal: number): Result<MemberTypes> => {
    const rows = headerRows(unit);
    if (rows.kind !== "ok") return rows;
    const stop = admit(unit);
    if (stop !== null) return stop;
    const row = rows.value[ordinal];
    if (!Number.isSafeInteger(ordinal) || Object.is(ordinal, -0) || row === undefined)
      throw new TypeError("front: a selected interface member must name an actual inventory position");
    const role = (read: () => RawFact<RawTypeId | null>): Result<TyId | null> => {
      const stop = admit(unit);
      if (stop !== null) return stop;
      const fact = read();
      if (fact.kind !== "available") throw new TypeError("front: an opened member must retain its actual selected type");
      return fact.value === null ? done(null) : typeOf(unit, fact.value);
    };
    const read = role(() => row.source.read);
    if (read.kind !== "ok") return read;
    const write = role(() => row.source.write);
    return write.kind === "ok" ? done({ read: read.value, write: write.value }) : write;
  };
  return { origin, inventory: inventoryOf, member };
}
