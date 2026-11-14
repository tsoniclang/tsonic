import type { TyId, SigId } from "../ids/contract.js";
import type { TypeTerm, Signature, TypeTable } from "./data.js";

export class TypeArena {
  private readonly table: { readonly terms: TypeTerm[]; readonly signatures: Signature[] } = { terms: [], signatures: [] };
  private readonly typesByKey = new Map<string, TyId>();
  private readonly signaturesByKey = new Map<string, SigId>();
  private readonly substitutionResults = new Map<string, Map<string, number>>();

  private constructor() {}

  static create(): TypeArena { return new TypeArena(); }
  static terms(value: TypeArena): TypeTerm[] { return value.table.terms; }
  static signatures(value: TypeArena): Signature[] { return value.table.signatures; }
  static view(value: TypeArena): TypeTable { return value.table; }
  static typeKeys(value: TypeArena): Map<string, TyId> { return value.typesByKey; }
  static signatureKeys(value: TypeArena): Map<string, SigId> { return value.signaturesByKey; }
  static substitutions(value: TypeArena): Map<string, Map<string, number>> { return value.substitutionResults; }
}
