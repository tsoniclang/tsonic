import type { SigId, TyId } from "../ids/contract.js";
import { sigId, tyId } from "../ids/index.js";
import { requirePresent } from "../diag/index.js";
import type { InvariantFailure } from "../diag/contract.js";
import type {
  ComponentSelector, ConstructionDefinition, IndexSignature, LiteralTypeValue, Member, MemberKey,
  MemberOrigin, Signature, SignatureParameter, SumFamily, TypeComponent, TypeParameter, TypePublication, TypeTable, TypeTerm,
} from "../ir-types/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import { publicationRewrite, rewriteComponent, rewriteParameter } from "./canonical-types.js";
import type { InstantiationMeter, InstantiationStop } from "./program-values.js";
import { chargeInstantiationWork, emitInstantiationRecord } from "./program-values.js";

type SeedTask = () => InstantiationStop | null;

interface SeedScan {
  readonly mode: "seed" | "transport";
  readonly meter: InstantiationMeter;
  readonly pending: SeedTask[];
  readonly components: Set<TypeComponent>;
}

function projected(scan: SeedScan, count: number): InstantiationStop | null {
  if (scan.mode === "seed") return null;
  for (let position = 0; position < count; position += 1) {
    const stop = emitInstantiationRecord(scan.meter);
    if (stop !== null) return stop;
  }
  return null;
}

function fields(scan: SeedScan, count: number): InstantiationStop | null {
  for (let position = 0; position < count; position += 1) {
    const stop = chargeInstantiationWork(scan.meter);
    if (stop !== null) return stop;
  }
  return null;
}

function each<Value>(scan: SeedScan, values: readonly Value[], visit: (value: Value) => InstantiationStop | null): void {
  const iterator = values.values();
  const next: SeedTask = () => {
    const item = iterator.next();
    if (item.done) return null;
    scan.pending.push(next);
    return visit(item.value);
  };
  scan.pending.push(next);
}

function reference(scan: SeedScan, _identity: TyId | SigId): InstantiationStop | null {
  return scan.mode === "seed" ? emitInstantiationRecord(scan.meter) : chargeInstantiationWork(scan.meter);
}

function references(scan: SeedScan, values: readonly (TyId | SigId)[]): void {
  each(scan, values, value => reference(scan, value));
}

function optionalReference(scan: SeedScan, value: TyId | null): InstantiationStop | null {
  return value === null ? null : reference(scan, value);
}

function literal(scan: SeedScan, value: LiteralTypeValue): InstantiationStop | null {
  if (scan.mode === "transport") return null;
  switch (value.kind) {
    case "number": return fields(scan, 5);
    case "bigint":
    case "string":
    case "boolean":
    case "unique-symbol": return fields(scan, 2);
    case "absence": return fields(scan, 1);
  }
}

function memberKey(scan: SeedScan, value: MemberKey): InstantiationStop | null {
  switch (value.kind) {
    case "number": return fields(scan, 5);
    case "text":
    case "symbol": return fields(scan, 2);
  }
}

function origin(scan: SeedScan, value: MemberOrigin): InstantiationStop | null {
  switch (value.kind) {
    case "declared":
    case "class-prototype": return fields(scan, 2);
    case "mapped": return fields(scan, 7) ?? memberKey(scan, value.key);
  }
}

function parameter(scan: SeedScan, value: TypeParameter): InstantiationStop | null {
  return projected(scan, 1) ?? fields(scan, scan.mode === "seed" ? 6 : 4)
    ?? optionalReference(scan, value.constraint) ?? optionalReference(scan, value.default);
}

function signatureParameter(scan: SeedScan, value: SignatureParameter): InstantiationStop | null {
  return projected(scan, 1) ?? fields(scan, 5) ?? reference(scan, value.type);
}

function construction(scan: SeedScan, value: ConstructionDefinition): InstantiationStop | null {
  if (scan.mode === "transport") return null;
  each(scan, value.captures, () => fields(scan, 2));
  return fields(scan, 4);
}

function member(scan: SeedScan, value: Member): InstantiationStop | null {
  if (scan.mode === "seed") {
    each(scan, value.origins, item => origin(scan, item));
    each(scan, value.readOrigins, item => origin(scan, item));
    each(scan, value.writeOrigins, item => origin(scan, item));
  }
  return projected(scan, 1) ?? fields(scan, 9) ?? (scan.mode === "seed" ? memberKey(scan, value.key) : null)
    ?? optionalReference(scan, value.read) ?? optionalReference(scan, value.write);
}

function indexSignature(scan: SeedScan, value: IndexSignature): InstantiationStop | null {
  return projected(scan, 1) ?? fields(scan, 5) ?? reference(scan, value.key) ?? reference(scan, value.read)
    ?? optionalReference(scan, value.write);
}

function family(scan: SeedScan, value: SumFamily): InstantiationStop | null {
  if (scan.mode === "seed") each(scan, value.parameters, () => fields(scan, 2));
  each(scan, value.roles, role => projected(scan, 1) ?? fields(scan, scan.mode === "seed" ? 7 : 3) ?? reference(scan, role.member));
  scan.pending.push(() => component(scan, value.component));
  return projected(scan, 1) ?? fields(scan, 4);
}

function selector(scan: SeedScan, value: ComponentSelector): InstantiationStop | null {
  const step = chargeInstantiationWork(scan.meter);
  if (step !== null) return step;
  if (scan.mode === "transport") {
    switch (value.kind) {
      case "parameter":
      case "receiver":
      case "result":
      case "signature-tail":
      case "sum-arm": {
        const record = projected(scan, 1);
        if (record !== null) return record;
        break;
      }
      case "class-value":
      case "construction-argument":
      case "optional-value":
      case "array-element":
      case "tuple-element":
      case "union-member":
      case "argument-place":
      case "parameter-place":
      case "intersection-member":
      case "intersection-result":
      case "argument-tail":
      case "parameter-tail":
      case "member":
      case "index-key":
      case "index-value":
      case "projection-source":
      case "tuple-slice":
      case "type-argument":
      case "awaited": return fields(scan, 1);
    }
  }
  switch (value.kind) {
    case "class-value":
    case "optional-value":
    case "array-element":
    case "intersection-result":
    case "projection-source":
    case "awaited": return fields(scan, 1);
    case "tuple-element":
    case "union-member":
    case "argument-place":
    case "parameter-place":
    case "intersection-member":
    case "argument-tail":
    case "parameter-tail":
    case "index-key":
    case "index-value": return fields(scan, 2);
    case "type-argument": return fields(scan, 3);
    case "tuple-slice": return fields(scan, 4);
    case "construction-argument": return fields(scan, 3) ?? construction(scan, value.definition);
    case "member": return fields(scan, 2) ?? origin(scan, value.origin);
    case "parameter": return fields(scan, 3) ?? reference(scan, value.signature);
    case "receiver":
    case "result": return fields(scan, 2) ?? reference(scan, value.signature);
    case "signature-tail": return fields(scan, 4) ?? reference(scan, value.signature);
    case "sum-arm": return fields(scan, 3) ?? family(scan, value.family);
  }
}

function component(scan: SeedScan, value: TypeComponent): InstantiationStop | null {
  if (scan.components.has(value)) throw new TypeError("Inline cycle in instantiation seed TypeComponent");
  scan.components.add(value);
  scan.pending.push(() => { scan.components.delete(value); return null; });
  each(scan, value.path, item => selector(scan, item));
  return projected(scan, 1) ?? fields(scan, scan.mode === "seed" ? 6 : 2);
}

function term(scan: SeedScan, value: TypeTerm): InstantiationStop | null {
  const row = emitInstantiationRecord(scan.meter);
  if (row !== null) return row;
  switch (value.kind) {
    case "string":
    case "error": return fields(scan, 1);
    case "primitive":
    case "intrinsic":
    case "enum":
    case "self": return fields(scan, 2);
    case "open": return fields(scan, 3);
    case "param": return fields(scan, 4);
    case "literal": return fields(scan, 3) ?? literal(scan, value.value) ?? reference(scan, value.base);
    case "union":
    case "intersection":
      references(scan, value.members);
      return fields(scan, 2);
    case "optional": return fields(scan, 2) ?? reference(scan, value.value);
    case "array": return fields(scan, 3) ?? reference(scan, value.element);
    case "tuple":
      each(scan, value.elements, item => projected(scan, 1) ?? fields(scan, 3) ?? reference(scan, item.type));
      return fields(scan, 3);
    case "fixed-array": return fields(scan, scan.mode === "seed" ? 5 : 3) ?? reference(scan, value.element);
    case "shape":
      each(scan, value.members, item => member(scan, item));
      each(scan, value.indexes, item => indexSignature(scan, item));
      references(scan, value.calls);
      references(scan, value.constructs);
      return fields(scan, 5);
    case "callable":
      references(scan, value.calls);
      references(scan, value.constructs);
      return fields(scan, 3);
    case "declared":
      references(scan, value.arguments);
      return fields(scan, scan.mode === "seed" && value.extent !== null ? 7 : 5);
    case "construction-reference":
      references(scan, value.arguments);
      return fields(scan, 3) ?? construction(scan, value.definition);
    case "projection": {
      const projection = value.projection;
      switch (projection.kind) {
        case "awaited": return fields(scan, 4) ?? reference(scan, value.source);
        case "component":
          scan.pending.push(() => component(scan, projection.component));
          return projected(scan, 1) ?? fields(scan, 5) ?? reference(scan, value.source);
      }
    }
  }
}

function signature(scan: SeedScan, value: Signature): InstantiationStop | null {
  const row = emitInstantiationRecord(scan.meter);
  if (row !== null) return row;
  each(scan, value.typeParameters, item => parameter(scan, item));
  each(scan, value.parameters, item => signatureParameter(scan, item));
  if (value.composition !== null) {
    references(scan, value.composition.signatures);
    const compositionFields = projected(scan, 1) ?? fields(scan, 2);
    if (compositionFields !== null) return compositionFields;
  }
  return fields(scan, scan.mode === "seed" && value.owner !== null ? 13 : 9)
    ?? optionalReference(scan, value.receiver) ?? reference(scan, value.result);
}

function admitTable(meter: InstantiationMeter, table: TypeTable, mode: "seed" | "transport"): InstantiationStop | null {
  const scan: SeedScan = { mode, meter, pending: [], components: new Set() };
  each(scan, table.signatures, value => signature(scan, value));
  each(scan, table.terms, value => term(scan, value));
  let next = scan.pending.pop();
  while (next !== undefined) {
    const stop = next();
    if (stop !== null) return stop;
    next = scan.pending.pop();
  }
  return null;
}

export function admitTypeSeed(meter: InstantiationMeter, table: TypeTable): InstantiationStop | null {
  return admitTable(meter, table, "seed");
}

function rewriteOrdered<Identity extends number>(values: readonly Identity[], rewrite: (value: Identity) => Identity): readonly Identity[] {
  return values.map(rewrite).sort((left, right) => left - right);
}

function rewriteTerm(rewrite: TypeReferenceRewrite, value: TypeTerm): TypeTerm {
  switch (value.kind) {
    case "literal": return { ...value, base: rewrite.type(value.base) };
    case "union":
    case "intersection": return { ...value, members: rewriteOrdered(value.members, rewrite.type) };
    case "optional": return { kind: "optional", value: rewrite.type(value.value) };
    case "array":
    case "fixed-array": return { ...value, element: rewrite.type(value.element) };
    case "tuple": return { ...value, elements: value.elements.map(item => ({ ...item, type: rewrite.type(item.type) })) };
    case "shape": return {
      ...value,
      members: value.members.map(item => ({
        ...item, read: item.read === null ? null : rewrite.type(item.read),
        write: item.write === null ? null : rewrite.type(item.write),
      })),
      indexes: value.indexes.map(item => ({
        ...item, key: rewrite.type(item.key), read: rewrite.type(item.read),
        write: item.write === null ? null : rewrite.type(item.write),
      })),
      calls: rewriteOrdered(value.calls, rewrite.signature), constructs: rewriteOrdered(value.constructs, rewrite.signature),
    };
    case "callable": return {
      ...value, calls: rewriteOrdered(value.calls, rewrite.signature), constructs: rewriteOrdered(value.constructs, rewrite.signature),
    };
    case "declared":
    case "construction-reference": return { ...value, arguments: value.arguments.map(rewrite.type) };
    case "projection": return {
      kind: "projection", source: rewrite.type(value.source),
      projection: value.projection.kind === "awaited" ? value.projection : {
        kind: "component", component: rewriteComponent(rewrite, value.projection.component, "Instantiation.types.projection"),
      },
    };
    default: {
      const leaf: TypeTerm & { readonly kind: "primitive" | "intrinsic" | "string" | "enum" | "param" | "self" | "open" | "error" } = value;
      return { ...leaf };
    }
  }
}

function rewriteSignature(rewrite: TypeReferenceRewrite, value: Signature, identity: SigId): Signature {
  return {
    id: identity, declaration: value.declaration, owner: value.owner, kind: value.kind,
    composition: value.composition === null ? null : {
      kind: value.composition.kind, signatures: rewriteOrdered(value.composition.signatures, rewrite.signature),
    },
    typeParameters: value.typeParameters.map(item => rewriteParameter(rewrite, item)),
    receiver: value.receiver === null ? null : rewrite.type(value.receiver),
    parameters: value.parameters.map(item => ({ ...item, type: rewrite.type(item.type) })),
    result: rewrite.type(value.result),
  };
}

type Images<Identity, Value> = {
  readonly stable: ReadonlyMap<Identity, Identity>;
  readonly appended: readonly Value[];
};

function anchorImages<Identity extends number, Value>(
  meter: InstantiationMeter, oldCount: number, images: readonly Identity[], rows: readonly Value[],
  identity: (position: number) => Identity,
): Images<Identity, Value> | InstantiationStop {
  const stable = new Map<Identity, Identity>();
  for (const [position, image] of images.entries()) {
    if (position >= oldCount) break;
    const stop = chargeInstantiationWork(meter);
    if (stop !== null) return stop;
    if (stable.has(image)) throw new TypeError("Instantiation input merges two existing publication IDs");
    stable.set(image, identity(position));
  }
  const appended: Value[] = [];
  for (const [position, row] of rows.entries()) {
    const stop = chargeInstantiationWork(meter);
    if (stop !== null) return stop;
    const image = identity(position);
    if (!stable.has(image)) {
      stable.set(image, identity(oldCount + appended.length));
      appended.push(row);
    }
  }
  return { stable, appended };
}

const missingStableImage: InvariantFailure = ({
  owner: "ir-program", query: null, origin: null,
  message: "Published reference has no stable image",
});

function stableIdentity<Identity>(images: ReadonlyMap<Identity, Identity>, value: Identity): Identity {
  return requirePresent(images.get(value), missingStableImage);
}

export type StablePublication = {
  readonly kind: "complete";
  readonly types: TypeTable;
  readonly rewrite: TypeReferenceRewrite;
};

export function stabilizePublication(
  meter: InstantiationMeter, original: TypeTable, publication: TypePublication,
): StablePublication | InstantiationStop {
  const types = anchorImages(meter, original.terms.length, publication.types, publication.table.terms, tyId);
  if ("kind" in types) return types;
  const signatures = anchorImages(meter, original.signatures.length, publication.signatures, publication.table.signatures, sigId);
  if ("kind" in signatures) return signatures;
  const newRows: TypeTable = {
    terms: types.appended,
    signatures: signatures.appended,
  };
  const stop = admitTable(meter, newRows, "transport");
  if (stop !== null) return stop;
  const rewrite: TypeReferenceRewrite = {
    type: value => stableIdentity(types.stable, value),
    signature: value => stableIdentity(signatures.stable, value),
  };
  const issued = publicationRewrite(publication);
  return {
    kind: "complete",
    types: {
      terms: [...original.terms, ...newRows.terms.map(value => rewriteTerm(rewrite, value))],
      signatures: [...original.signatures, ...newRows.signatures.map(value => rewriteSignature(
        rewrite, value, stableIdentity(signatures.stable, value.id),
      ))],
    },
    rewrite: {
      type: value => rewrite.type(issued.type(value)),
      signature: value => rewrite.signature(issued.signature(value)),
    },
  };
}
