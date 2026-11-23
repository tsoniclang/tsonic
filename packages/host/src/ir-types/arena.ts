import type { TyId, SigId } from "../ids/contract.js";
import type { TypeTerm, Signature, TypeTable } from "./data.js";
export interface GraphIdentity {
  readonly kind: "type" | "signature";
  readonly identity: number;
}

export class TypeArena {
  private readonly table: { readonly terms: TypeTerm[]; readonly signatures: Signature[] } = { terms: [], signatures: [] };
  private readonly typesByKey = new Map<string, TyId>();
  private readonly signaturesByKey = new Map<string, SigId>();
  private readonly rowsByLabel = new Map<string, GraphIdentity[]>();
  private readonly substitutionResults = new Map<string, Map<string, number>>();

  private constructor() {}

  static create(): TypeArena { return new TypeArena(); }
  static terms(value: TypeArena): TypeTerm[] { return value.table.terms; }
  static signatures(value: TypeArena): Signature[] { return value.table.signatures; }
  static view(value: TypeArena): TypeTable { return value.table; }
  static typeKeys(value: TypeArena): Map<string, TyId> { return value.typesByKey; }
  static signatureKeys(value: TypeArena): Map<string, SigId> { return value.signaturesByKey; }
  static candidates(value: TypeArena, label: string): readonly GraphIdentity[] {
    return value.rowsByLabel.get(label) ?? [];
  }
  static addCandidate(value: TypeArena, label: string, row: GraphIdentity): void {
    const prior = value.rowsByLabel.get(label);
    if (prior === undefined) value.rowsByLabel.set(label, [row]);
    else prior.push(row);
  }
  static substitutions(value: TypeArena): Map<string, Map<string, number>> { return value.substitutionResults; }
}
