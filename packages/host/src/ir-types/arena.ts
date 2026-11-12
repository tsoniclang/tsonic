import type { TyId, SigId } from "../ids/contract.js";
import type { TypeTerm, Signature } from "./data.js";

export class TypeArena {
  private readonly typeRows: TypeTerm[] = [];
  private readonly signatureRows: Signature[] = [];
  private readonly typesByKey = new Map<string, TyId>();
  private readonly signaturesByKey = new Map<string, SigId>();
  private readonly substitutionResults = new Map<string, Map<string, number>>();

  private constructor() {}

  static create(): TypeArena { return new TypeArena(); }
  static terms(value: TypeArena): TypeTerm[] { return value.typeRows; }
  static signatures(value: TypeArena): Signature[] { return value.signatureRows; }
  static typeKeys(value: TypeArena): Map<string, TyId> { return value.typesByKey; }
  static signatureKeys(value: TypeArena): Map<string, SigId> { return value.signaturesByKey; }
  static substitutions(value: TypeArena): Map<string, Map<string, number>> { return value.substitutionResults; }
}
