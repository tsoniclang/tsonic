import type { TyId } from "../ids/contract.js";
import type { CategoryEvidence, JoinSourceChoice, SourceCategory, TypeTerm } from "./contract.js";
import { TypeArena } from "./arena.js";
import { stageGraph } from "./graph-stage.js";
import { admitGraphType, readStagedGraph } from "./publication-read.js";
import { storedType } from "./interner.js";
import { required, typeIdentifier } from "./value.js";
import type { ExpansionStop, TypePublicationStop } from "./work.js";
import { publicationAdmission } from "./work.js";

type AtomCategory = "number" | "string" | "symbol";

interface Atom {
  readonly type: TyId;
  readonly category: AtomCategory;
  readonly base: TyId | null;
}

interface Frame {
  readonly types: readonly TyId[];
  next: number;
}

export const joinSourceChoice: JoinSourceChoice = ({ types: arena, work: account }, selected, limits) => {
  const work = publicationAdmission(account);
  const { maximumDepth, maximumVisits, maximumUnionMembers } = limits;
  if (![maximumDepth, maximumVisits, maximumUnionMembers].every(value => Number.isSafeInteger(value) && value >= 0))
    throw new TypeError("ir-types: source choice maxima must be nonnegative safe integers.");
  let remaining = maximumVisits;
  const consume = (count: number): ExpansionStop | TypePublicationStop | null => {
    if (count > remaining) return { kind: "resource-limit", dimension: "visits", maximum: maximumVisits };
    remaining -= count;
    return work.work(count);
  };
  const initial = work.work(0) ?? consume(1);
  if (initial !== null) return initial;
  if (selected.length === 0) throw new TypeError("ir-types: a source choice needs actual selected inputs.");
  const pending: Frame[] = [{ types: selected, next: 0 }];
  const seen = new Set<TyId>();
  const atoms: Atom[] = [];
  const broad = new Map<AtomCategory, TyId>();
  const nonScalar: { readonly kind: "unavailable"; readonly reason: "non-scalar" } =
    { kind: "unavailable", reason: "non-scalar" };
  let absent = false;
  let boolean: { readonly base: TyId; readonly sample: TyId } | undefined;
  let broadBoolean = false;
  let yes: TyId | undefined;
  let no: TyId | undefined;
  for (;;) {
    const frame = pending[pending.length - 1];
    if (frame === undefined) break;
    if (frame.next === frame.types.length) { pending.pop(); continue; }
    const stop = consume(1);
    if (stop !== null) return stop;
    const type = frame.types[frame.next++];
    if (type === undefined) throw new TypeError("ir-types: a source choice constituent vector must be dense.");
    if (seen.has(type)) continue;
    seen.add(type);
    const term = storedType(arena, type);
    if (term.kind === "union" || term.kind === "optional") {
      if (pending.length > maximumDepth) return { kind: "resource-limit", dimension: "depth", maximum: maximumDepth };
      if (term.kind === "optional") absent = true;
      pending.push({ types: term.kind === "union" ? term.members : [term.value], next: 0 });
      continue;
    }
    if (term.kind === "intrinsic" && term.intrinsic === "never") continue;
    if (term.kind === "intrinsic" && (term.intrinsic === "absence" || term.intrinsic === "void")) {
      absent = true;
      continue;
    }
    if (term.kind === "primitive" && term.primitive === "bool") {
      broadBoolean = true;
      boolean = { base: type, sample: type };
      continue;
    }
    if (term.kind === "literal" && term.value.kind === "boolean") {
      if (boolean?.base !== term.base) {
        const baseStop = consume(1);
        if (baseStop !== null) return baseStop;
        const base = storedType(arena, term.base);
        if (base.kind !== "primitive" || base.primitive !== "bool")
          throw new TypeError("ir-types: a selected Boolean singleton requires its actual Boolean base.");
        boolean = { base: term.base, sample: type };
      }
      if (term.value.value) yes = type;
      else no = type;
      continue;
    }
    const category: AtomCategory | null = term.kind === "string" ? "string"
      : term.kind === "primitive" && term.primitive === "float64" ? "number"
        : term.kind === "intrinsic" && term.intrinsic === "symbol" ? "symbol"
          : term.kind === "literal" ? term.value.kind === "unique-symbol" ? "symbol"
            : term.value.kind === "number" || term.value.kind === "string" ? term.value.kind : null : null;
    if (category === null) return nonScalar;
    const base = term.kind === "literal" ? term.base : null;
    if (base === null) broad.set(category, type);
    atoms.push({ type, category, base });
  }
  const present: TyId[] = [];
  const categories = new Set<SourceCategory>();
  for (const atom of atoms) {
    const stop = consume(1);
    if (stop !== null) return stop;
    if (atom.base !== null) {
      const domain = broad.get(atom.category);
      if (domain !== undefined && atom.category === "number") return { kind: "unavailable", reason: "numeric-inclusion" };
      if (domain === atom.base) continue;
    }
    present.push(atom.type);
    categories.add(atom.category);
  }
  const fullBoolean = broadBoolean || yes !== undefined && no !== undefined;
  const splitBoolean = fullBoolean && (present.length !== 0 || absent);
  const booleanWidth = boolean === undefined ? 0 : splitBoolean ? 2 : 1;
  const width = present.length + booleanWidth;
  if (width > maximumUnionMembers)
    return { kind: "resource-limit", dimension: "union-members", maximum: maximumUnionMembers };
  const newBoolean = splitBoolean ? Number(yes === undefined) + Number(no === undefined) : 0;
  const planCount = newBoolean + Number(width !== 1) + Number(absent && width !== 0);
  const planStop = consume(planCount) ?? work.retain(planCount);
  if (planStop !== null) return planStop;
  const base = TypeArena.terms(arena).length;
  const rows = new Map<number, TypeTerm>();
  const reserve = (term: TypeTerm): TyId => {
    const id = typeIdentifier(base + rows.size);
    rows.set(id, term);
    return id;
  };
  if (boolean !== undefined) {
    categories.add("boolean");
    if (splitBoolean) {
      present.push(yes ?? reserve({ kind: "literal", value: { kind: "boolean", value: true }, base: boolean.base }),
        no ?? reserve({ kind: "literal", value: { kind: "boolean", value: false }, base: boolean.base }));
    } else present.push(fullBoolean ? boolean.base : boolean.sample);
  }
  const alternatives = [...categories].sort().map<CategoryEvidence>(category => ({ kind: "known", category }));
  if (absent) alternatives.push({ kind: "known", category: "absence" });
  const first = alternatives[0];
  const category: CategoryEvidence = first === undefined ? { kind: "dynamic" }
    : alternatives.length === 1 ? first : { kind: "choice", alternatives };
  const payload = present.length === 1 ? present[0] : present.length === 0 ? undefined : reserve({ kind: "union", members: present });
  const result = payload === undefined ? reserve({ kind: "intrinsic", intrinsic: absent ? "absence" : "never" })
    : absent ? reserve({ kind: "optional", value: payload }) : payload;
  if (rows.size === 0) return { kind: "complete", value: { type: result, category } };
  const staged = stageGraph(arena, rows, new Map(), {
    step: (count = 1) => consume(count), growth: work.work,
    ...readStagedGraph(work.work),
    commitType: value => admitGraphType(value, work.work, work.retain),
    beforeMember: null,
  });
  if (staged.kind === "resource-limit") return staged;
  return { kind: "complete", value: { type: required(staged.value.types, result), category } };
};
