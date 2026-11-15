import type { BodyId, NodeId, RawSignatureId, RawTypeId, SigId, TyId } from "../ids/contract.js";
import { encodeBodyId, sigId, tyId } from "../ids/index.js";
import type { LiteralTypeValue, SignatureInput, SignatureParameter, TypeEvidence, TypePublicationStop, TypePublicationWork, TypeTerm } from "../ir-types/contract.js";
import { compareIndexSignatures, createTypePublicationWork, internTypeGraph, viewTypes } from "../ir-types/index.js";
import type { ConvertedCheckedType, LowerDeps, RawModule } from "./contract.js";
import { lowerMembers } from "./lower-members.js";
import { sourceOccurrence } from "./bindings.js";

export type ConversionResult<Value> = { readonly kind: "complete"; readonly value: Value } | TypePublicationStop;

export interface TypeConversion {
  readonly deps: LowerDeps;
  readonly raw: RawModule;
  readonly bodyOf: ReadonlyMap<NodeId, BodyId>;
  readonly typeWork: TypePublicationWork;
  readonly convertedTypes: Map<RawTypeId, ConvertedCheckedType>;
  readonly convertedSignatures: Map<RawSignatureId, SigId>;
}

type Dependency = { readonly kind: "type"; readonly id: RawTypeId } | { readonly kind: "signature"; readonly id: RawSignatureId };

export function createTypeConversion(deps: LowerDeps, raw: RawModule, bodyOf: ReadonlyMap<NodeId, BodyId>): TypeConversion {
  return { deps, raw, bodyOf, typeWork: createTypePublicationWork(deps.typePublication),
    convertedTypes: new Map(), convertedSignatures: new Map() };
}

export function convertRawType(conversion: TypeConversion, id: RawTypeId): ConversionResult<ConvertedCheckedType> {
  const known = conversion.convertedTypes.get(id);
  if (known !== undefined) return { kind: "complete", value: known };
  const result = convertDependencies(conversion, { kind: "type", id });
  if (result.kind !== "complete") return result;
  const converted = conversion.convertedTypes.get(id);
  if (converted === undefined) throw new TypeError("front: a type conversion must produce its requested type");
  return { kind: "complete", value: converted };
}

export function signatureOf(conversion: TypeConversion, id: RawSignatureId): ConversionResult<SigId> {
  const known = conversion.convertedSignatures.get(id);
  if (known !== undefined) return { kind: "complete", value: known };
  const result = convertDependencies(conversion, { kind: "signature", id });
  if (result.kind !== "complete") return result;
  const converted = conversion.convertedSignatures.get(id);
  if (converted === undefined) throw new TypeError("front: a signature conversion must produce its requested signature");
  return { kind: "complete", value: converted };
}

function convertDependencies(conversion: TypeConversion, root: Dependency): ConversionResult<void> {
  const { deps, raw } = conversion;
  const snapshot = viewTypes(deps.types);
  const typeBase = snapshot.terms.length;
  const signatureBase = snapshot.signatures.length;
  const typePositions = new Map<RawTypeId, number>();
  const signaturePositions = new Map<RawSignatureId, number>();
  const pending: Dependency[] = [root];
  let termCount = 0;
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next.kind === "signature") {
      if (conversion.convertedSignatures.has(next.id) || signaturePositions.has(next.id)) continue;
      const signature = raw.types.signatures[next.id];
      if (signature === undefined) throw new TypeError("front: a callable inventory must name its captured signature");
      signaturePositions.set(next.id, signaturePositions.size);
      if (signature.result.kind !== "available") throw new TypeError("front: unavailable callable result conversion is not implemented");
      pending.push({ kind: "type", id: signature.result.value });
      for (let index = signature.parameters.length - 1; index >= 0; index -= 1) {
        const parameter = signature.parameters[index];
        if (parameter === undefined) throw new TypeError("front: a captured parameter inventory must be dense");
        pending.push({ kind: "type", id: parameter.type });
      }
      continue;
    }
    if (conversion.convertedTypes.has(next.id) || typePositions.has(next.id)) continue;
    const row = raw.types.types[next.id];
    if (row === undefined) throw new TypeError("front: a raw type must name its captured form");
    if (row.form.kind !== "available")
      throw new TypeError("front: checked type conversion requires its actual captured component/error association (" + row.form.reason + ")");
    if (row.literal.kind !== "available") throw new TypeError("front: checked literal conversion requires its actual captured literal association");
    termCount += 1;
    if (row.literal.value !== null) {
      if (row.literal.value.kind !== "boolean" && row.literal.value.kind !== "string" && row.literal.value.kind !== "symbol")
        throw new TypeError(`front: checked literal conversion of ${row.literal.value.kind} is not implemented`);
      typePositions.set(next.id, termCount);
      termCount += 1;
    } else typePositions.set(next.id, termCount - 1);
    const form = row.form.value;
    if (form.kind === "structure") {
      const inventory = raw.types.members[form.inventory];
      if (inventory === undefined) throw new TypeError("front: a structure must retain its captured member inventory");
      for (const id of [...inventory.calls, ...inventory.constructs].reverse()) pending.push({ kind: "signature", id });
      for (let index = inventory.members.length - 1; index >= 0; index -= 1) {
        const member = inventory.members[index];
        if (member === undefined) throw new TypeError("front: a captured member inventory must retain every actual row");
        for (const fact of [member.write, member.read]) {
          if (fact.kind !== "available") throw new TypeError("front: checked member conversion requires its actual captured type association (" + fact.reason + ")");
          if (fact.value !== null) pending.push({ kind: "type", id: fact.value });
        }
      }
      for (let index = inventory.indexes.length - 1; index >= 0; index -= 1) {
        const selected = inventory.indexes[index];
        if (selected === undefined) throw new TypeError("front: a captured index inventory must retain every actual row");
        pending.push({ kind: "type", id: selected.value }, { kind: "type", id: selected.key });
      }
    } else if (form.kind === "declared") {
      for (let index = form.arguments.length - 1; index >= 0; index -= 1) {
        const argument = form.arguments[index]?.argument;
        if (argument?.kind !== "available") throw new TypeError("front: declared type conversion requires its actual selected checked argument");
        pending.push({ kind: "type", id: argument.value });
      }
    } else if (form.kind === "union" || form.kind === "intersection") {
      for (let index = form.members.length - 1; index >= 0; index -= 1) {
        const member = form.members[index];
        if (member === undefined) throw new TypeError("front: a captured composite type cannot lose a member before conversion");
        pending.push({ kind: "type", id: member });
      }
    }
  }
  const typeOf = (id: RawTypeId): TyId => {
    const known = conversion.convertedTypes.get(id);
    if (known !== undefined) return known.type;
    const position = typePositions.get(id);
    if (position === undefined) throw new TypeError("front: a graph reference must name a discovered type dependency");
    return tyId(typeBase + position);
  };
  const signatureOf = (id: RawSignatureId): SigId => {
    const known = conversion.convertedSignatures.get(id);
    if (known !== undefined) return known;
    const position = signaturePositions.get(id);
    if (position === undefined) throw new TypeError("front: a graph reference must name a discovered signature dependency");
    return sigId(signatureBase + position);
  };
  const terms: TypeTerm[] = [];
  const preparedTypes: [RawTypeId, number, TypeEvidence][] = [];
  for (const [id, position] of typePositions) {
    const row = raw.types.types[id];
    if (row?.form.kind !== "available" || row.literal.kind !== "available")
      throw new TypeError("front: a graph type must retain its original available captured form");
    const component = raw.types.components[row.component];
    if (component === undefined) throw new TypeError("front: a graph must retain every actual captured type and component");
    if (component.root.module !== raw.module)
      throw new TypeError("front: a foreign type component requires its actual qualified body association");
    const body = conversion.bodyOf.get(component.root.node);
    if (body === undefined) throw new TypeError("front: a type component must retain its actual containing body");
    const form = row.form.value;
    let term: TypeTerm;
    if (form.kind === "parameter") term = { kind: "param", parameter: deps.definitionOf(form.parameter) };
    else if (form.kind === "declared") {
      if (form.extent.kind !== "available" || form.extent.value !== null)
        throw new TypeError("front: declared type conversion requires its actual selected extent association");
      term = { kind: "declared", definition: deps.definitionOf(form.declaration), facet: form.facet, extent: null,
        arguments: form.arguments.map(argument => {
          if (argument.argument.kind !== "available") throw new TypeError("front: a declared type cannot invent an unavailable checked argument");
          return typeOf(argument.argument.value);
        }) };
    } else if (form.kind === "union" || form.kind === "intersection") term = { kind: form.kind, members: form.members.map(typeOf) };
    else if (form.kind === "structure") {
      const inventory = raw.types.members[form.inventory];
      if (inventory === undefined) throw new TypeError("front: a structure must retain its captured member inventory");
      const calls = inventory.calls.map(signatureOf);
      const constructs = inventory.constructs.map(signatureOf);
      term = inventory.indexes.length === 0 && inventory.members.length === 0 ? { kind: "callable", calls, constructs }
        : { kind: "shape", members: lowerMembers(deps, inventory.members, typeOf), calls, constructs,
          indexes: inventory.indexes.map(index => {
            const source = sourceOccurrence(deps, index.origin);
            if (source === null || source.kind !== "IndexSignature" && source.kind !== "MappedType")
              throw new TypeError("front: an index requires its genuine declared or mapped source occurrence");
            const key = typeOf(index.key);
            const read = typeOf(index.value);
            return { origin: source.occurrence, key, read, write: index.readonly ? null : read, readonly: index.readonly };
          }).sort(compareIndexSignatures) };
    } else if (form.kind === "scalar") {
      const scalar = form.scalar;
      if (scalar === "number") term = { kind: "primitive", primitive: "float64" };
      else if (scalar === "string") term = { kind: "string" };
      else if (scalar === "boolean") term = { kind: "primitive", primitive: "bool" };
      else if (scalar === "null" || scalar === "undefined") term = { kind: "intrinsic", intrinsic: "absence" };
      else term = { kind: "intrinsic", intrinsic: scalar };
    } else throw new TypeError(`front: the conversion of the checker type form ${form.kind} is not implemented`);
    const base = terms.length;
    terms.push(term);
    const literal = row.literal.value;
    if (literal !== null) {
      let value: LiteralTypeValue;
      if (literal.kind === "symbol") value = { kind: "unique-symbol", declaration: deps.definitionOf(literal.declaration) };
      else if (literal.kind === "boolean" || literal.kind === "string") value = literal;
      else throw new TypeError(`front: checked literal conversion of ${literal.kind} is not implemented`);
      terms.push({ kind: "literal", value, base: tyId(typeBase + base) });
    }
    const scalar = form.kind === "scalar" ? form.scalar : null;
    const category = scalar === "number" ? "number" : scalar === "string" ? "string" : scalar === "boolean" ? "boolean" : scalar === "bigint" ? "bigint"
      : scalar === "null" || scalar === "undefined" ? "absence" : scalar === "object" ? "object" : null;
    preparedTypes.push([id, position, { type: tyId(typeBase + position),
      component: { kind: "body", value: { body, node: component.root.node } },
      category: category === null ? { kind: "dynamic" } : { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null }]);
  }
  const signatures: SignatureInput[] = [];
  for (const id of signaturePositions.keys()) signatures.push(signatureInput(conversion, id, typeOf));
  const result = internTypeGraph({ types: deps.types, work: conversion.typeWork }, { typeBase, signatureBase, terms, signatures });
  if (result.kind !== "complete") return result;
  for (const [id, position, evidence] of preparedTypes) {
    const type = result.value.types[position];
    if (type === undefined) throw new TypeError("front: a completed graph must retain every staged type mapping");
    conversion.convertedTypes.set(id, { type, evidence: { ...evidence, type } });
  }
  for (const [id, position] of signaturePositions) {
    const signature = result.value.signatures[position];
    if (signature === undefined) throw new TypeError("front: a completed graph must retain every staged signature mapping");
    conversion.convertedSignatures.set(id, signature);
  }
  return { kind: "complete", value: undefined };
}

function signatureInput(conversion: TypeConversion, id: RawSignatureId, typeOf: (id: RawTypeId) => TyId): SignatureInput {
  const signature = conversion.raw.types.signatures[id];
  if (signature === undefined) throw new TypeError("front: a callable inventory must name its captured signature");
  if (signature.typeParameters.kind !== "available" || signature.typeParameters.value.length !== 0
    || signature.receiver.kind !== "available" || signature.receiver.value !== null)
    throw new TypeError("front: generic or receiver-bearing callable type conversion is not implemented");
  if (signature.composition !== null) throw new TypeError("front: composed callable signature conversion is not implemented");
  if (signature.result.kind !== "available") throw new TypeError("front: unavailable callable result conversion is not implemented");
  const declaration = signature.declaration;
  if (declaration === null) throw new TypeError("front: declarationless callable signature conversion is not implemented");
  const definition = conversion.deps.definitionOf(declaration);
  const parameters = signature.parameters.map((parameter): SignatureParameter => {
    const declared = parameter.declaration;
    if (declared === null) throw new TypeError("front: declarationless callable parameter conversion is not implemented");
    if (parameter.initializer !== null && parameter.initializer.module !== declared.module)
      throw new TypeError("front: a callable default initializer must retain its parameter's actual source module");
    if (parameter.kind === "variadic") throw new TypeError("front: variadic callable parameter conversion is not implemented");
    const parameterDefinition = conversion.deps.definitionOf(declared);
    if (parameter.passing.kind !== "available")
      throw new TypeError("front: a callable parameter whose captured passing mode is unavailable is not implemented (" + parameter.passing.reason + ")");
    return { declaration: parameterDefinition, kind: parameter.initializer === null ? parameter.kind : "default",
      type: typeOf(parameter.type), passing: parameter.passing.value,
      initializer: parameter.initializer === null ? null : encodeBodyId({ owner: parameterDefinition, role: "default-argument", ordinal: 0 }),
      acceptsOmission: parameter.acceptsOmission };
  });
  return { declaration: definition, owner: { kind: "item", value: { owner: definition, node: declaration.node } }, composition: null,
    kind: signature.kind, typeParameters: [], receiver: null, parameters, result: typeOf(signature.result.value) };
}
