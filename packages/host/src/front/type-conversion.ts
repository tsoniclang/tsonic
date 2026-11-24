import type { RawSignatureId, RawTypeId, SigId, TyId } from "../ids/contract.js";
import { encodeBodyId, sigId, tyId } from "../ids/index.js";
import type { LiteralTypeValue, SignatureInput, SignatureParameter, TypeEvidence, TypeGraphMapping, TypeGraphResult, TypePublicationStop, TypePublicationWork, TypeTerm } from "../ir-types/contract.js";
import { admitTypePublicationStep, compareIndexSignatures, internTypeGraph, viewTypes } from "../ir-types/index.js";
import type { ConvertedCheckedType, LowerDeps, ModuleSourceOccurrence, RawCheckedType, RawComponent, RawFact, RawModule, RawNodeRef, RawNumericLiteral, RawSignature, RawTypeForm } from "./contract.js";
import { lowerMemberHeader, lowerMembers } from "./lower-members.js";
import { sameSource, sourceOccurrence } from "./bindings.js";
import type { MemberKeyLowering } from "./bindings.js";
import { captureBigintLiteral, captureCheckerBigint, captureCheckerNumber, captureNumericLiteral } from "./literals.js";
import type { LiteralStop } from "./literals.js";

export type ConversionStop = TypePublicationStop | LiteralStop;
export type ConversionResult<Value> = { readonly kind: "complete"; readonly value: Value } | ConversionStop;
type CheckedFailure = Extract<RawFact<never>, { readonly kind: "unavailable" }>;
type GraphFailure = CheckedFailure | ConversionStop;

export interface TypeConversion extends MemberKeyLowering {
  readonly raw: RawModule;
  readonly typeWork: TypePublicationWork;
  readonly convertedTypes: Map<RawTypeId, ConvertedCheckedType>;
  readonly convertedSignatures: Map<RawSignatureId, SigId>;
  readonly numericLiterals: Map<RawNumericLiteral, Extract<LiteralTypeValue, { readonly kind: "number" | "bigint" }>>;
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
  failure: GraphFailure | null;
}

export function createTypeConversion(deps: LowerDeps, raw: RawModule): TypeConversion {
  return { deps, raw, query: "lowerModule", typeWork: deps.typeWork,
    convertedTypes: new Map(), convertedSignatures: new Map(), numericLiterals: new Map(), checkerNumberBits: null };
}

export function convertRawType(conversion: TypeConversion, id: RawTypeId): ConversionResult<ConvertedCheckedType> | CheckedFailure {
  const stopped = admitTypePublicationStep(conversion.typeWork, 0);
  if (stopped !== null) return stopped;
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
  const stopped = admitTypePublicationStep(conversion.typeWork, 0);
  if (stopped !== null) return stopped;
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

function isIndexedChild(parent: RawComponent, child: RawComponent | undefined, role: "tuple-element" | "argument-place" | "template-span", index: number,
  work: TypePublicationWork): boolean | TypePublicationStop {
  const path = child?.path;
  if (child === undefined || path === undefined || path === null || parent.id >= child.id || !sameSource(child.root, parent.root)
    || path.step.kind !== role || !Object.is(path.step.index, index)) return false;
  if (parent.path === null) return path.prefix === null;
  return admitTypePublicationStep(work) ?? (path.prefix === parent.id);
}

function authoredOperator(graph: TypeGraph, row: RawCheckedType, component: RawComponent,
  operator: RawNodeRef | null, kind: "IndexedAccessType" | "ConditionalType" | "TypeOperator",
  root: ModuleSourceOccurrence): ModuleSourceOccurrence | TypePublicationStop | null {
  if (operator === null || !sameSource(row.authoredTypeNode, operator)) return null;
  const { deps, raw, typeWork } = graph.conversion;
  if (component.path === null) return root.kind === kind && sameSource(component.root, operator) ? root : null;
  const { prefix, step } = component.path;
  if (prefix !== null) return null;
  const stop = admitTypePublicationStep(typeWork);
  if (stop !== null) return stop;
  if (step.kind === "argument-place") {
    if (component.root.module !== operator.module || root.typeSyntax?.kind !== "type-reference"
      || root.typeSyntax.arguments[step.index] !== operator.node) return null;
    const source = sourceOccurrence(deps, operator);
    return source?.kind === kind && source.parent === component.root.node ? source : null;
  }
  if (step.kind !== "parameter" && step.kind !== "result") return null;
  const signature = raw.types.signatures[step.signature];
  if (signature?.id !== step.signature || signature.target !== null || signature.composition !== null
    || !sameSource(signature.owner, component.root)) return null;
  let declaration: RawNodeRef | null;
  if (step.kind === "parameter") {
    const parameter = signature.parameters[step.index];
    if (parameter?.type !== row.id || parameter.component !== component.id || parameter.kind !== "required") return null;
    declaration = parameter.declaration;
  } else {
    if (signature.result.kind !== "available" || signature.result.value !== row.id) return null;
    declaration = signature.declaration;
  }
  if (declaration === null || declaration.module !== operator.module) return null;
  const source = sourceOccurrence(deps, operator);
  return source?.kind === kind && source.parent === declaration.node ? source : null;
}

function authoredOperandAt(raw: RawModule, id: RawTypeId, expected: RawNodeRef): RawCheckedType | null {
  const operand = raw.types.types[id];
  if (operand?.id !== id || !sameSource(operand.authoredTypeNode, expected)) return null;
  const component = raw.types.components[operand.component];
  return component?.path === null && sameSource(component.root, expected) ? operand : null;
}

function prepareType(graph: TypeGraph, handle: TypeHandle): PreparedType | GraphFailure {
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
    else if (selectedLiteral.kind === "absence") throw new TypeError("front: checked literal conversion of absence is not implemented");
    else if (selectedLiteral.value.kind === "authored") {
      const token = selectedLiteral.value.literal;
      const known = graph.conversion.numericLiterals.get(token);
      if (known !== undefined) literal = known;
      else {
        const parsed = selectedLiteral.kind === "number" ? captureNumericLiteral(deps.literalCapture, token)
          : captureBigintLiteral(deps.literalCapture, token);
        if (parsed.kind !== "complete") { graph.failure = parsed; return parsed; }
        literal = parsed.value;
        graph.conversion.numericLiterals.set(token, parsed.value);
      }
      if (literal.kind !== selectedLiteral.kind || (literal.kind === "bigint" &&
        (selectedLiteral.kind !== "bigint" || literal.value !== selectedLiteral.value.checked)))
        throw new TypeError("front: the authored numeric token does not match its captured checker literal");
    }
  }
  const component = raw.types.components[row.component];
  if (component === undefined || component.id !== row.component)
    throw new TypeError("front: a graph must retain every actual captured type and component");
  const source = sourceOccurrence(deps, component.root);
  if (source === null) throw new TypeError("front: a type component requires its actual qualified source occurrence");
  if ((selectedLiteral?.kind === "number" || selectedLiteral?.kind === "bigint") && selectedLiteral.value.kind === "checker-value") {
    if (source.origin?.module !== component.root.module)
      throw new TypeError("front: a checked numeric component requires its actual source origin");
    const parsed = selectedLiteral.kind === "number"
      ? captureCheckerNumber(deps.literalCapture, selectedLiteral.value.value, source.origin, raw.module, graph.conversion)
      : captureCheckerBigint(deps.literalCapture, selectedLiteral.value.value, source.origin, raw.module);
    if (parsed.kind !== "complete") { graph.failure = parsed; return parsed; }
    literal = parsed.value;
  }
  const form = row.form.value;
  let term: TypeTerm;
  const dependencies: Dependency[] = [];
  const reference = (id: RawTypeId): TyId => typeReference(graph, id, dependencies);
  if (form.kind === "source-environment") {
    const members = [];
    for (let index = 0; index < form.members.length; index += 1) {
      const stop = admitTypePublicationStep(graph.conversion.typeWork);
      if (stop !== null) { graph.failure = stop; return stop; }
      const member = form.members[index];
      if (member === undefined || member.key.kind !== "text" || member.readKind !== "property")
        throw new TypeError("front: the actual source environment requires a dense text property inventory");
      const lowered = lowerMemberHeader(graph.conversion, member, row.component, graph.conversion.typeWork);
      if (!("key" in lowered)) { graph.failure = lowered; return lowered; }
      members.push(lowered);
    }
    term = { kind: "source-environment", members };
  } else if (form.kind === "structure") {
    const inventory = raw.types.members[form.inventory];
    if (inventory === undefined) throw new TypeError("front: a structure must retain its captured member inventory");
    for (let index = inventory.members.length - 1; index >= 0; index -= 1) {
      const member = inventory.members[index];
      if (member === undefined) throw new TypeError("front: a captured member inventory must retain every actual row");
      if (member.readKind === "mapped" && inventory.component !== row.component)
        throw new TypeError("front: a mapped inventory requires its actual structure component");
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
    if (inventory.indexes.length === 0 && inventory.members.length === 0 && (calls.length !== 0 || constructs.length !== 0))
      term = { kind: "callable", calls, constructs };
    else {
      const members = lowerMembers(graph.conversion, inventory.members, id => typeReference(graph, id, memberDependencies), row.component, graph.conversion.typeWork);
      if ("kind" in members) {
        graph.failure = members;
        return members;
      }
      term = { kind: "shape", members, calls, constructs,
        indexes: inventory.indexes.map(index => {
          const selected = sourceOccurrence(deps, index.origin);
          if (selected === null || selected.kind !== "IndexSignature" && selected.kind !== "MappedType")
            throw new TypeError("front: an index requires its genuine declared or mapped source occurrence");
          const key = reference(index.key);
          const read = reference(index.value);
          return { origin: selected.occurrence, key, read, write: index.readonly ? null : read, readonly: index.readonly };
        }).sort(compareIndexSignatures) };
    }
    scheduleDependencies(graph, memberDependencies);
  } else if (form.kind === "merged-interface-dependency" || form.kind === "conditional-alias-application") {
    if (form.kind === "merged-interface-dependency" &&
      (raw.types.interfaceGroups[form.group.ordinal] !== form.group || form.group.slots.length !== form.arguments.length))
      throw new TypeError("front: a merged application requires its independently retained declaration and slot group");
    const argumentsOf: TyId[] = [];
    for (let index = 0; index < form.arguments.length; ++index) {
      const stop = admitTypePublicationStep(graph.conversion.typeWork);
      if (stop !== null) { graph.failure = stop; return stop; }
      const argument = form.arguments[index];
      if (argument === undefined) throw new TypeError("front: a deferred application must retain its actual ordered argument slots");
      const child = raw.types.types[argument];
      const position = child === undefined ? undefined : raw.types.components[child.component];
      const matched = child?.id === argument && isIndexedChild(component, position, "argument-place", index, graph.conversion.typeWork);
      if (typeof matched !== "boolean") { graph.failure = matched; return matched; }
      if (!matched) throw new TypeError("front: a deferred argument must retain its own actual qualified type occurrence");
      argumentsOf.push(reference(argument));
    }
    term = form.kind === "merged-interface-dependency"
      ? { kind: "merged-interface", definitions: form.group.declarations.map(deps.definitionOf), arguments: argumentsOf }
      : { kind: "alias-application", declaration: deps.definitionOf(form.declaration), arguments: argumentsOf };
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
  } else if (form.kind === "enum") term = { kind: "enum", definition: deps.definitionOf(form.declaration) };
  else if (form.kind === "tuple") {
    const elements = [];
    const work = graph.conversion.typeWork;
    for (let index = 0; index < form.elements.length; index += 1) {
      const stop = admitTypePublicationStep(work);
      if (stop !== null) {
        graph.failure = stop;
        return stop;
      }
      const element = form.elements[index];
      if (element === undefined || (element.kind !== "required" && element.kind !== "optional") ||
        element.declaration !== null || element.acceptsOmission !== (element.kind === "optional"))
        throw new TypeError("front: a captured tuple requires its actual required or optional unlabelled slots");
      const { type, component: positionId } = element;
      const child = raw.types.types[type];
      const position = raw.types.components[positionId];
      const matches = child?.id === type && child.component === positionId && position?.id === positionId
        && isIndexedChild(component, position, "tuple-element", index, work);
      if (typeof matches !== "boolean") {
        graph.failure = matches;
        return matches;
      }
      if (!matches)
        throw new TypeError("front: a captured tuple slot must retain its actual type component and position under this tuple");
      elements.push({ kind: element.kind, declaration: element.declaration, type: reference(type) });
    }
    term = { kind: "tuple", readonly: form.readonly, elements };
  } else if (form.kind === "union" || form.kind === "intersection") {
    const members: TyId[] = [];
    const numeric = form.kind === "union" ? form.numericOrigin : undefined;
    const syntax = numeric === undefined ? undefined : sourceOccurrence(deps, numeric.annotation)?.typeSyntax;
    if (numeric !== undefined && (form.members.length < 2 || (numeric.kind === "authored"
      ? syntax?.kind !== "union" || syntax.members.length !== form.members.length
      : syntax?.kind !== "indexed" || numeric.sources.length !== form.members.length)))
      throw new TypeError("front: an exact numeric union requires its actual ordered constituent positions");
    for (const [index, member] of form.members.entries()) {
      if (member === undefined) throw new TypeError("front: a captured composite type cannot lose a member before conversion");
      if (numeric !== undefined) {
        const stop = admitTypePublicationStep(graph.conversion.typeWork);
        if (stop !== null) { graph.failure = stop; return stop; }
        const node = syntax?.kind === "union" ? syntax.members[index] : undefined;
        const reference = numeric.kind === "indexed-read" ? numeric.sources[index]
          : node === undefined ? undefined : { module: numeric.annotation.module, node };
        const selected = reference === undefined ? null : authoredOperandAt(raw, member, reference);
        if (selected === null)
          throw new TypeError("front: an exact numeric union requires its actual ordered constituent positions");
        if (selected.form.kind === "available" && (selected.literal.kind !== "available" || selected.literal.value?.kind !== "number"
          || selected.literal.value.value.kind !== "authored"))
          throw new TypeError("front: an exact numeric union requires its actual exact singleton operands");
      }
      members.push(reference(member));
    }
    term = { kind: form.kind, members };
  } else if (form.kind === "template-literal") {
    const spans = [];
    for (let index = 0; index < form.spans.length; ++index) {
      const stop = admitTypePublicationStep(graph.conversion.typeWork);
      if (stop !== null) { graph.failure = stop; return stop; }
      const span = form.spans[index];
      const operand = span === undefined ? undefined : raw.types.types[span.type];
      const child = operand === undefined ? undefined : raw.types.components[operand.component];
      const related = isIndexedChild(component, child, "template-span", index, graph.conversion.typeWork);
      if (typeof related !== "boolean") { graph.failure = related; return related; }
      if (span === undefined || operand?.id !== span.type || !related)
        throw new TypeError("front: a native template type must retain its actual ordered placeholder components");
      spans.push({ type: reference(span.type), tail: span.tail });
    }
    term = { kind: "template-literal", head: form.head, spans };
  } else if (form.kind === "indexed-access") {
    if (row.alias.kind === "available" && row.alias.value !== null)
      throw new TypeError("front: checked selected indexed transport requires its retained application association");
    const authored = authoredOperator(graph, row, component, form.operator, "IndexedAccessType", source);
    if (authored?.kind === "resource-limit") { graph.failure = authored; return authored; }
    if (authored === null)
      throw new TypeError("front: an indexed projection requires its actual checked operator component");
    term = { kind: "projection", source: reference(form.object), projection: { kind: "indexed", index: reference(form.index) } };
  } else if (form.kind === "keyof") {
    const authored = authoredOperator(graph, row, component, form.operator, "TypeOperator", source);
    if (authored?.kind === "resource-limit") { graph.failure = authored; return authored; }
    if (authored?.typeSyntax?.kind !== "keyof")
      throw new TypeError("front: a key projection requires its actual checked keyof operator and target components");
    const targetStop = admitTypePublicationStep(graph.conversion.typeWork);
    if (targetStop !== null) { graph.failure = targetStop; return targetStop; }
    if (authoredOperandAt(raw, form.target, { module: form.operator.module, node: authored.typeSyntax.target }) === null)
      throw new TypeError("front: a key projection requires its actual checked keyof operator and target components");
    term = { kind: "projection", source: reference(form.target), projection: { kind: "keyof" } };
  } else if (form.kind === "substitution") {
    const work = graph.conversion.typeWork;
    const stop = admitTypePublicationStep(work);
    if (stop !== null) { graph.failure = stop; return stop; }
    const { module } = form.operator;
    if (form.scope.kind === "mapped") {
      const mapped = sourceOccurrence(deps, form.operator)?.typeSyntax;
      if (mapped?.kind !== "mapped" || source.kind !== "TypeReference" || module !== component.root.module ||
        component.path !== null || !sameSource(row.authoredTypeNode, component.root) ||
        !sameSource(form.scope.parameter, { module, node: mapped.parameter }))
        throw new TypeError("front: a mapped key requires its actual checked binder and use");
      let current = source;
      while (current.node !== mapped.value) {
        const stop = admitTypePublicationStep(work);
        if (stop !== null) { graph.failure = stop; return stop; }
        const parent = current.parent === null ? null : sourceOccurrence(deps, { module, node: current.parent });
        if (parent === null || parent.node >= current.node)
          throw new TypeError("front: a mapped key use must belong to its actual checked value subtree");
        current = parent;
      }
      const inputs: readonly { readonly id: RawTypeId; readonly role: "projection-source" | "projection-constraint" }[] =
        [{ id: form.base, role: "projection-source" }, { id: form.constraint, role: "projection-constraint" }];
      for (const { id, role } of inputs) {
        const stop = admitTypePublicationStep(work);
        if (stop !== null) { graph.failure = stop; return stop; }
        const selected = raw.types.types[id];
        const child = selected === undefined ? undefined : raw.types.components[selected.component];
        if (selected?.id !== id || child?.path?.step.kind !== role || child.path.prefix !== null ||
          !sameSource(child.root, component.root) || role === "projection-source" && (selected.form.kind !== "available" ||
          selected.form.value.kind !== "parameter" || !sameSource(selected.form.value.parameter, form.scope.parameter)))
          throw new TypeError("front: a mapped key requires its original native base and constraint");
      }
    } else {
      const conditional = sourceOccurrence(deps, form.operator)?.typeSyntax;
      if (conditional?.kind !== "conditional" || module !== component.root.module || component.path !== null
        || source.kind !== "TypeReference" || source.parent !== conditional.whenTrue || !sameSource(row.authoredTypeNode, component.root))
        throw new TypeError("front: a lexical substitution requires its actual conditional and ordered checked operands");
      const baseStop = admitTypePublicationStep(work);
      if (baseStop !== null) { graph.failure = baseStop; return baseStop; }
      const base = authoredOperandAt(raw, form.base, { module, node: conditional.check })?.form;
      if (base?.kind !== "available" || base.value.kind !== "parameter")
        throw new TypeError("front: a lexical substitution requires its actual conditional and ordered checked operands");
      const constraintStop = admitTypePublicationStep(work);
      if (constraintStop !== null) { graph.failure = constraintStop; return constraintStop; }
      const constraint = authoredOperandAt(raw, form.constraint, { module, node: conditional.extends })?.form;
      if (constraint?.kind !== "available" || constraint.value.kind !== "keyof")
        throw new TypeError("front: a lexical substitution requires its actual conditional and ordered checked operands");
      const indexedStop = admitTypePublicationStep(work);
      if (indexedStop !== null) { graph.failure = indexedStop; return indexedStop; }
      const indexed = sourceOccurrence(deps, { module, node: conditional.whenTrue })?.typeSyntax;
      if (indexed?.kind !== "indexed" || indexed.index !== source.node)
        throw new TypeError("front: a lexical substitution requires its actual checked index occurrence");
    }
    term = { kind: "projection", source: reference(form.base), projection: { kind: "substitution", constraint: reference(form.constraint) } };
  } else if (form.kind === "conditional") {
    const authored = authoredOperator(graph, row, component, form.operator, "ConditionalType", source);
    if (authored?.kind === "resource-limit") { graph.failure = authored; return authored; }
    if (form.application !== null || authored === null
      || form.whenTrue.kind !== "ready" || form.whenFalse.kind !== "ready")
      throw new TypeError("front: a conditional projection requires its actual checked operator component");
    const binders = [];
    for (let index = 0; index < form.inferParameters.length; ++index) {
      const stopped = admitTypePublicationStep(graph.conversion.typeWork);
      if (stopped !== null) { graph.failure = stopped; return stopped; }
      const binder = form.inferParameters[index];
      if (binder === undefined) throw new TypeError("front: a conditional projection requires dense actual inference parameters");
      binders.push(deps.definitionOf(binder));
    }
    term = { kind: "projection", source: reference(form.check), projection: { kind: "conditional",
      extends: reference(form.extends), whenTrue: reference(form.whenTrue.type), whenFalse: reference(form.whenFalse.type),
      distributive: form.distributive,
      inferParameters: binders } };
  } else if (form.kind === "merged-slot-parameter") {
    const parameters = [];
    for (let index = 0; index < form.declarations.length; ++index) {
      const stopped = admitTypePublicationStep(graph.conversion.typeWork);
      if (stopped !== null) { graph.failure = stopped; return stopped; }
      const declaration = form.declarations[index];
      if (declaration === undefined)
        throw new TypeError("front: a symbolic merged slot requires each actual checked parameter declaration");
      parameters.push(deps.definitionOf(declaration));
    }
    if (parameters.length < 2) throw new TypeError("front: a symbolic merged parameter requires its complete declaration group");
    term = { kind: "merged-parameter", parameters };
  } else if (form.kind === "parameter") term = { kind: "param", parameter: deps.definitionOf(form.parameter) };
  else if (form.kind === "self") term = { kind: "self", owner: deps.definitionOf(form.owner) };
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
    : scalar === "null" || scalar === "undefined" ? "absence" : scalar === "object" ? "object" : scalar === "symbol" ? "symbol" : null;
  const prepared: PreparedType = { handle, evidence: { type: handle.reference, component: source.occurrence,
    category: category === null ? { kind: "dynamic" } : { kind: "known", category }, numeric: null, sum: null,
    nominal: term.kind === "enum" ? term.definition : null, pointer: null } };
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

function completeGraph(graph: TypeGraph): TypeGraphResult | CheckedFailure | LiteralStop {
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

export function rawSignatureParameter(raw: RawModule, id: RawTypeId): Extract<RawTypeForm, { readonly kind: "parameter" }> {
  const captured = raw.types.types[id];
  if (captured?.id !== id || captured.form.kind !== "available" || captured.form.value.kind !== "parameter")
    throw new TypeError("front: a signature binder requires its actual captured parameter type");
  const parameter = captured.form.value;
  const position = raw.types.components[captured.component];
  if (position?.root.module !== parameter.parameter.module || position.root.node !== parameter.parameter.node || position.path !== null)
    throw new TypeError("front: a signature binder requires its actual qualified declaration component");
  return parameter;
}

function signatureInput(graph: TypeGraph, signature: RawSignature, result: RawTypeId, dependencies: Dependency[]): SignatureInput {
  if (signature.typeParameters.kind !== "available" || signature.receiver.kind !== "available" || signature.receiver.value !== null)
    throw new TypeError("front: incomplete or receiver-bearing callable type conversion is not implemented");
  if (signature.composition !== null) throw new TypeError("front: composed callable signature conversion is not implemented");
  const declaration = signature.declaration;
  if (declaration === null) throw new TypeError("front: declarationless callable signature conversion is not implemented");
  const definition = graph.conversion.deps.definitionOf(declaration);
  const typeParameters = signature.typeParameters.value.map(id => {
    const parameter = rawSignatureParameter(graph.conversion.raw, id);
    return { declaration: graph.conversion.deps.definitionOf(parameter.parameter),
      constraint: parameter.constraint === null ? null : typeReference(graph, parameter.constraint, dependencies),
      default: parameter.default === null ? null : typeReference(graph, parameter.default, dependencies) };
  });
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
    kind: signature.kind, typeParameters, receiver: null, parameters, result: typeReference(graph, result, dependencies) };
}
