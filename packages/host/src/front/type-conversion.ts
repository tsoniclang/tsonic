import type { RawSignatureId, RawTypeId, SigId, TyId } from "../ids/contract.js";
import { encodeBodyId, sigId, tyId } from "../ids/index.js";
import type { LiteralTypeValue, SignatureInput, SignatureParameter, TypeEvidence, TypeGraphMapping, TypeGraphResult, TypePublicationStop, TypePublicationWork, TypeTerm } from "../ir-types/contract.js";
import { compareIndexSignatures, createTypePublicationWork, internTypeGraph, viewTypes } from "../ir-types/index.js";
import type { ConvertedCheckedType, LowerDeps, RawFact, RawModule, RawSignature } from "./contract.js";
import { lowerMembers } from "./lower-members.js";
import { sourceOccurrence } from "./bindings.js";

export type ConversionResult<Value> = { readonly kind: "complete"; readonly value: Value } | TypePublicationStop;
type CheckedFailure = Extract<RawFact<never>, { readonly kind: "unavailable" }>;

export interface TypeConversion {
  readonly deps: LowerDeps;
  readonly raw: RawModule;
  readonly typeWork: TypePublicationWork;
  readonly convertedTypes: Map<RawTypeId, ConvertedCheckedType>;
  readonly convertedSignatures: Map<RawSignatureId, SigId>;
}

interface TypeHandle {
  readonly id: RawTypeId;
  readonly position: number;
  readonly reference: TyId;
  prepared: boolean;
}

interface SignatureHandle {
  readonly id: RawSignatureId;
  readonly position: number;
  readonly reference: SigId;
  prepared: boolean;
}

type Dependency = { readonly kind: "type"; readonly handle: TypeHandle }
  | { readonly kind: "signature"; readonly handle: SignatureHandle };

interface PreparedType {
  readonly handle: TypeHandle;
  readonly evidence: TypeEvidence;
}

interface TypeGraph {
  readonly conversion: TypeConversion;
  readonly typeBase: number;
  readonly signatureBase: number;
  readonly types: Map<RawTypeId, TypeHandle>;
  readonly signatures: Map<RawSignatureId, SignatureHandle>;
  readonly preparedTypes: PreparedType[];
  readonly pending: Dependency[];
  readonly terms: TypeTerm[];
  readonly signatureInputs: SignatureInput[];
  typeCount: number;
  failure: CheckedFailure | null;
}

export function createTypeConversion(deps: LowerDeps, raw: RawModule): TypeConversion {
  return { deps, raw, typeWork: createTypePublicationWork(deps.typePublication),
    convertedTypes: new Map(), convertedSignatures: new Map() };
}

export function convertRawType(conversion: TypeConversion, id: RawTypeId): ConversionResult<ConvertedCheckedType> | CheckedFailure {
  const known = conversion.convertedTypes.get(id);
  if (known !== undefined) return { kind: "complete", value: known };
  const graph = createGraph(conversion);
  const root = prepareType(graph, reserveType(graph, id));
  if ("kind" in root) return root;
  const result = completeGraph(graph);
  if (result.kind !== "complete") return result;
  const converted = mapTypeResult(result.value, root.handle.position, root.evidence);
  publishMappings(graph, result.value, root);
  conversion.convertedTypes.set(id, converted);
  return { kind: "complete", value: converted };
}

export function signatureOf(conversion: TypeConversion, id: RawSignatureId): ConversionResult<SigId> {
  const known = conversion.convertedSignatures.get(id);
  if (known !== undefined) return { kind: "complete", value: known };
  const graph = createGraph(conversion);
  const root = reserveSignature(graph, id);
  prepareSignature(graph, root);
  const result = completeGraph(graph);
  if (result.kind === "unavailable") throw new TypeError("front: a callable endpoint requires its actual available checked signature (" + result.reason + ")");
  if (result.kind !== "complete") return result;
  const converted = mapSignatureResult(result.value, root.position);
  publishMappings(graph, result.value, null);
  return { kind: "complete", value: converted };
}

function createGraph(conversion: TypeConversion): TypeGraph {
  const snapshot = viewTypes(conversion.deps.types);
  return { conversion, typeBase: snapshot.terms.length, signatureBase: snapshot.signatures.length,
    types: new Map(), signatures: new Map(), preparedTypes: [], pending: [], terms: [], signatureInputs: [], typeCount: 0, failure: null };
}

function reserveType(graph: TypeGraph, id: RawTypeId): TypeHandle {
  const position = graph.typeCount;
  graph.typeCount += 1;
  const handle = { id, position, reference: tyId(graph.typeBase + position), prepared: false };
  graph.types.set(id, handle);
  return handle;
}

function typeReference(graph: TypeGraph, id: RawTypeId, dependencies: Dependency[]): TyId {
  const known = graph.conversion.convertedTypes.get(id);
  if (known !== undefined) return known.type;
  const handle = graph.types.get(id) ?? reserveType(graph, id);
  dependencies.push({ kind: "type", handle });
  return handle.reference;
}

function reserveSignature(graph: TypeGraph, id: RawSignatureId): SignatureHandle {
  const position = graph.signatures.size;
  const handle = { id, position, reference: sigId(graph.signatureBase + position), prepared: false };
  graph.signatures.set(id, handle);
  return handle;
}

function signatureReference(graph: TypeGraph, id: RawSignatureId, dependencies: Dependency[]): SigId {
  const known = graph.conversion.convertedSignatures.get(id);
  if (known !== undefined) return known;
  const handle = graph.signatures.get(id) ?? reserveSignature(graph, id);
  dependencies.push({ kind: "signature", handle });
  return handle.reference;
}

function prepareType(graph: TypeGraph, handle: TypeHandle): PreparedType | CheckedFailure {
  const { deps, raw } = graph.conversion;
  const row = raw.types.types[handle.id];
  if (row === undefined) throw new TypeError("front: a raw type must name its captured form");
  if (row.form.kind === "unavailable" && row.form.reason === "checker-error" && row.form.causes.length !== 0) {
    graph.failure = row.form;
    return row.form;
  }
  if (row.form.kind !== "available")
    throw new TypeError("front: checked type conversion requires its actual captured component/error association (" + row.form.reason + ")");
  if (row.literal.kind !== "available") throw new TypeError("front: checked literal conversion requires its actual captured literal association");
  const selectedLiteral = row.literal.value;
  let literal: LiteralTypeValue | null = null;
  if (selectedLiteral !== null) {
    if (selectedLiteral.kind === "symbol") literal = { kind: "unique-symbol", declaration: deps.definitionOf(selectedLiteral.declaration) };
    else if (selectedLiteral.kind === "boolean" || selectedLiteral.kind === "string") literal = selectedLiteral;
    else throw new TypeError("front: checked literal conversion of " + selectedLiteral.kind + " is not implemented");
  }
  const component = raw.types.components[row.component];
  if (component === undefined) throw new TypeError("front: a graph must retain every actual captured type and component");
  const source = sourceOccurrence(deps, component.root);
  if (source === null) throw new TypeError("front: a type component requires its actual qualified source occurrence");
  const form = row.form.value;
  let term: TypeTerm;
  const dependencies: Dependency[] = [];
  const reference = (id: RawTypeId): TyId => typeReference(graph, id, dependencies);
  if (form.kind === "structure") {
    const inventory = raw.types.members[form.inventory];
    if (inventory === undefined) throw new TypeError("front: a structure must retain its captured member inventory");
    for (let index = inventory.members.length - 1; index >= 0; index -= 1) {
      const member = inventory.members[index];
      if (member === undefined) throw new TypeError("front: a captured member inventory must retain every actual row");
      for (const fact of [member.write, member.read]) if (fact.kind !== "available")
        throw new TypeError("front: checked member conversion requires its actual captured type association (" + fact.reason + ")");
    }
    for (let index = inventory.indexes.length - 1; index >= 0; index -= 1)
      if (inventory.indexes[index] === undefined) throw new TypeError("front: a captured index inventory must retain every actual row");
    const signatureDependencies: Dependency[] = [];
    const memberDependencies: Dependency[] = [];
    const calls = inventory.calls.map(id => signatureReference(graph, id, signatureDependencies));
    const constructs = inventory.constructs.map(id => signatureReference(graph, id, signatureDependencies));
    scheduleDependencies(graph, signatureDependencies);
    term = inventory.indexes.length === 0 && inventory.members.length === 0 ? { kind: "callable", calls, constructs }
      : { kind: "shape", members: lowerMembers(deps, inventory.members, id => typeReference(graph, id, memberDependencies)), calls, constructs,
        indexes: inventory.indexes.map(index => {
          const selected = sourceOccurrence(deps, index.origin);
          if (selected === null || selected.kind !== "IndexSignature" && selected.kind !== "MappedType")
            throw new TypeError("front: an index requires its genuine declared or mapped source occurrence");
          const key = reference(index.key);
          const read = reference(index.value);
          return { origin: selected.occurrence, key, read, write: index.readonly ? null : read, readonly: index.readonly };
        }).sort(compareIndexSignatures) };
    scheduleDependencies(graph, memberDependencies);
  } else if (form.kind === "declared") {
    if (form.arguments.length !== form.parameters.length)
      throw new TypeError("front: declared arguments must retain their actual ordered parameter associations");
    const argumentsOf: TyId[] = [];
    for (let index = 0; index < form.arguments.length; index += 1) {
      const selected = form.arguments[index];
      const parameter = form.parameters[index];
      if (selected === undefined || parameter === undefined
        || selected.parameter.module !== parameter.module || selected.parameter.node !== parameter.node)
        throw new TypeError("front: declared arguments must retain their actual ordered parameter associations");
      const argument = selected.argument;
      if (argument?.kind !== "available") throw new TypeError("front: declared type conversion requires its actual selected checked argument");
      argumentsOf.push(reference(argument.value));
    }
    if (form.extent.kind !== "available" || form.extent.value !== null)
      throw new TypeError("front: declared type conversion requires its actual selected extent association");
    term = { kind: "declared", definition: deps.definitionOf(form.declaration), facet: form.facet, extent: null, arguments: argumentsOf };
  } else if (form.kind === "union" || form.kind === "intersection") {
    const members: TyId[] = [];
    for (const member of form.members) {
      if (member === undefined) throw new TypeError("front: a captured composite type cannot lose a member before conversion");
      members.push(reference(member));
    }
    term = { kind: form.kind, members };
  } else if (form.kind === "parameter") term = { kind: "param", parameter: deps.definitionOf(form.parameter) };
  else if (form.kind === "scalar") {
    const scalar = form.scalar;
    if (scalar === "number") term = { kind: "primitive", primitive: "float64" };
    else if (scalar === "string") term = { kind: "string" };
    else if (scalar === "boolean") term = { kind: "primitive", primitive: "bool" };
    else if (scalar === "null" || scalar === "undefined") term = { kind: "intrinsic", intrinsic: "absence" };
    else term = { kind: "intrinsic", intrinsic: scalar };
  } else throw new TypeError("front: the conversion of the checker type form " + form.kind + " is not implemented");
  if (literal === null) graph.terms[handle.position] = term;
  else {
    const base = graph.typeCount;
    graph.typeCount += 1;
    graph.terms[base] = term;
    graph.terms[handle.position] = { kind: "literal", value: literal, base: tyId(graph.typeBase + base) };
  }
  const scalar = form.kind === "scalar" ? form.scalar : null;
  const category = scalar === "number" ? "number" : scalar === "string" ? "string" : scalar === "boolean" ? "boolean" : scalar === "bigint" ? "bigint"
    : scalar === "null" || scalar === "undefined" ? "absence" : scalar === "object" ? "object" : null;
  const prepared: PreparedType = { handle, evidence: { type: handle.reference, component: source.occurrence,
    category: category === null ? { kind: "dynamic" } : { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null } };
  graph.preparedTypes.push(prepared);
  handle.prepared = true;
  scheduleDependencies(graph, dependencies);
  return prepared;
}

function prepareSignature(graph: TypeGraph, handle: SignatureHandle): void {
  const signature = graph.conversion.raw.types.signatures[handle.id];
  if (signature === undefined) throw new TypeError("front: a callable inventory must name its captured signature");
  if (signature.result.kind !== "available") throw new TypeError("front: unavailable callable result conversion is not implemented");
  for (let index = signature.parameters.length - 1; index >= 0; index -= 1)
    if (signature.parameters[index] === undefined) throw new TypeError("front: a captured parameter inventory must be dense");
  const dependencies: Dependency[] = [];
  graph.signatureInputs[handle.position] = signatureInput(graph, signature, signature.result.value, dependencies);
  handle.prepared = true;
  scheduleDependencies(graph, dependencies);
}

function scheduleDependencies(graph: TypeGraph, dependencies: Dependency[]): void {
  for (const dependency of dependencies.reverse()) graph.pending.push(dependency);
}

function completeGraph(graph: TypeGraph): TypeGraphResult | CheckedFailure {
  for (let next = graph.pending.pop(); next !== undefined; next = graph.pending.pop()) {
    if (next.handle.prepared) continue;
    if (next.kind === "type") prepareType(graph, next.handle);
    else prepareSignature(graph, next.handle);
    if (graph.failure !== null) return graph.failure;
  }
  return internTypeGraph({ types: graph.conversion.deps.types, work: graph.conversion.typeWork },
    { typeBase: graph.typeBase, signatureBase: graph.signatureBase, terms: graph.terms, signatures: graph.signatureInputs });
}

export function mapTypeResult(mapping: TypeGraphMapping, position: number, evidence: TypeEvidence): ConvertedCheckedType {
  const type = mapping.types[position];
  if (type === undefined) throw new TypeError("front: a completed graph must retain every staged type mapping");
  return { type, evidence: { ...evidence, type } };
}

export function mapSignatureResult(mapping: TypeGraphMapping, position: number): SigId {
  const signature = mapping.signatures[position];
  if (signature === undefined) throw new TypeError("front: a completed graph must retain every staged signature mapping");
  return signature;
}

function publishMappings(graph: TypeGraph, mapping: TypeGraphMapping, root: PreparedType | null): void {
  for (const prepared of graph.preparedTypes) {
    if (prepared !== root) graph.conversion.convertedTypes.set(prepared.handle.id,
      mapTypeResult(mapping, prepared.handle.position, prepared.evidence));
  }
  for (const handle of graph.signatures.values()) graph.conversion.convertedSignatures.set(handle.id, mapSignatureResult(mapping, handle.position));
}

function signatureInput(graph: TypeGraph, signature: RawSignature, result: RawTypeId, dependencies: Dependency[]): SignatureInput {
  if (signature.typeParameters.kind !== "available" || signature.typeParameters.value.length !== 0
    || signature.receiver.kind !== "available" || signature.receiver.value !== null)
    throw new TypeError("front: generic or receiver-bearing callable type conversion is not implemented");
  if (signature.composition !== null) throw new TypeError("front: composed callable signature conversion is not implemented");
  const declaration = signature.declaration;
  if (declaration === null) throw new TypeError("front: declarationless callable signature conversion is not implemented");
  const definition = graph.conversion.deps.definitionOf(declaration);
  const parameters = signature.parameters.map((parameter): SignatureParameter => {
    const declared = parameter.declaration;
    if (declared === null) throw new TypeError("front: declarationless callable parameter conversion is not implemented");
    if (parameter.initializer !== null && parameter.initializer.module !== declared.module)
      throw new TypeError("front: a callable default initializer must retain its parameter's actual source module");
    if (parameter.kind === "variadic") throw new TypeError("front: variadic callable parameter conversion is not implemented");
    const parameterDefinition = graph.conversion.deps.definitionOf(declared);
    if (parameter.passing.kind !== "available")
      throw new TypeError("front: a callable parameter whose captured passing mode is unavailable is not implemented (" + parameter.passing.reason + ")");
    return { declaration: parameterDefinition, kind: parameter.initializer === null ? parameter.kind : "default",
      type: typeReference(graph, parameter.type, dependencies), passing: parameter.passing.value,
      initializer: parameter.initializer === null ? null : encodeBodyId({ owner: parameterDefinition, role: "default-argument", ordinal: 0 }),
      acceptsOmission: parameter.acceptsOmission };
  });
  return { declaration: definition, owner: { kind: "item", value: { owner: definition, node: declaration.node } }, composition: null,
    kind: signature.kind, typeParameters: [], receiver: null, parameters, result: typeReference(graph, result, dependencies) };
}
