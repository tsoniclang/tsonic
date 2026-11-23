import type { ArtifactBindings, BindingVector, BodyInstance, TypeExpansionLimits, TypeInterner, TypeTable,
  TypeTableAdmissionWork, TypeTransform } from "../ir-types/contract.js";
import type { ArtifactReference, Instantiate, InstantiatedArtifact, InstantiationResult, ModuleBodies, ProgramIndex, SpecializeTir } from "./contract.js";
import { hostDiagnosticCode, requirePresent, throwInvariant } from "../diag/index.js";
import type { InvariantFailure } from "../diag/contract.js";
import type { BodyFacts } from "../ir-facts/contract.js";
import { admitTypeTable, readBindingVectorKey, readSignature, substitute, substituteSignature, viewTypes } from "../ir-types/index.js";
import type { InstantiationAllocationStop, InstantiationMeter, InstantiationStop } from "./work.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { SyntaxCopyResult } from "../ir-hir/contract.js";
import { admitBindingVector, createBindingLookup, createProjectionInventory, drainProjectionInventory, inventoryRecord, summaryBindingsOf, summaryReferenceKey, summaryReferenceOf } from "./program-values.js";
import { chargeInstantiationWork, createInstantiationMeter, ProgramWork } from "./work.js";
import type { ProjectionInventory } from "./program-values.js";
import { foreignTypeDetail, programTypeWork } from "./verification-work.js";
import { prepareSummary } from "./instantiate-facts.js";
import { inventoryTirBody } from "./instantiate-tir.js";
import type { ArtifactPlacement } from "./instantiate-tir.js";
import { inventoryBodySyntax } from "./instantiate-syntax.js";
import { rewriteBodySyntax } from "./canonical-syntax.js";
import { typedSyntaxPhaseCopy } from "./canonical-phase.js";

type ParametricArtifact = Extract<InstantiatedArtifact, { readonly kind: "tir" | "summary" }>;
type ArtifactCandidate =
  | { readonly kind: "bound"; readonly artifact: InstantiatedArtifact; readonly bindings: BindingVector; readonly enclosing: BindingVector }
  | { readonly kind: "parametric"; readonly artifact: ParametricArtifact | null }
  | { readonly kind: "independent"; readonly artifact: Extract<InstantiatedArtifact, { readonly kind: "metadata" }> };

type ArtifactSelection =
  | { readonly kind: "exact"; readonly artifact: InstantiatedArtifact }
  | { readonly kind: "template"; readonly artifact: ParametricArtifact }
  | { readonly kind: "missing" }
  | InstantiationStop;

const missingArtifactRow: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "Artifact selection requires a dense candidate inventory" };

function bindingKey(meter: InstantiationMeter, bindings: BindingVector): string | InstantiationStop {
  const result = readBindingVectorKey(bindings, () => chargeInstantiationWork(meter));
  return result.kind === "complete" ? result.key : result;
}

function admitVector(meter: InstantiationMeter, keys: Set<string>, key: string): InstantiationStop | null {
  if (keys.has(key)) return null;
  const stop = admitBindingVector(meter, keys.size) ?? chargeInstantiationWork(meter);
  if (stop !== null) return stop;
  keys.add(key);
  return null;
}

function select<Value>(
  meter: InstantiationMeter, values: readonly Value[], bindings: BindingVector,
  candidateOf: (value: Value) => ArtifactCandidate | InstantiationStop | null,
): ArtifactSelection {
  const keys = new Set<string>();
  let requested: string | null = null;
  let exact: InstantiatedArtifact | null = null;
  let template: Extract<ArtifactCandidate, { readonly kind: "parametric" }> | null = null;
  for (let position = 0; position < values.length; position += 1) {
    const work = chargeInstantiationWork(meter);
    if (work !== null) return work;
    const value = requirePresent(values[position], missingArtifactRow);
    const candidate = candidateOf(value);
    if (candidate === null) continue;
    if (candidate.kind === "resource-limit" || candidate.kind === "refused") return candidate;
    if (candidate.kind === "independent") return { kind: "exact", artifact: candidate.artifact };
    if (requested === null) {
      const key = bindingKey(meter, bindings);
      if (typeof key !== "string") return key;
      requested = key;
    }
    switch (candidate.kind) {
      case "parametric":
        if (template !== null) throw new TypeError("Duplicate parametric artifact");
        template = candidate;
        break;
      case "bound": {
        const key = bindingKey(meter, candidate.bindings);
        if (typeof key !== "string") return key;
        if (candidate.enclosing !== candidate.bindings) {
          const enclosing = bindingKey(meter, candidate.enclosing);
          if (typeof enclosing !== "string") return enclosing;
          if (key !== enclosing) break;
        }
        const stop = admitVector(meter, keys, key);
        if (stop !== null) return stop;
        if (key === requested) {
          if (exact !== null) throw new TypeError("Duplicate instantiated artifact");
          exact = candidate.artifact;
        }
        break;
      }
    }
  }
  if (exact !== null) return { kind: "exact", artifact: exact };
  if (template === null || template.artifact === null || requested === null) return { kind: "missing" };
  const stop = admitVector(meter, keys, requested);
  return stop ?? { kind: "template", artifact: template.artifact };
}

function parametricCandidate(artifact: ParametricArtifact, bindings: ArtifactBindings, bindingDependent: boolean): ArtifactCandidate {
  return bindings.kind === "instantiated" ? { kind: "bound", artifact, bindings: bindings.bindings, enclosing: bindings.bindings }
    : { kind: "parametric", artifact: bindingDependent ? null : artifact };
}

function bodyCandidate(enclosing: BodyInstance, payload: BodyInstance, artifact: InstantiatedArtifact,
  template: ParametricArtifact | null = null): ArtifactCandidate | null {
  if (payload.body !== enclosing.body) return null;
  if (enclosing.bindings.kind === "parametric")
    return payload.bindings.kind === "parametric" ? { kind: "parametric", artifact: template } : null;
  return payload.bindings.kind === "instantiated"
    ? { kind: "bound", artifact, bindings: payload.bindings.bindings, enclosing: enclosing.bindings.bindings } : null;
}

export function selectArtifact(
  meter: InstantiationMeter, index: ProgramIndex, module: ModuleBodies,
  artifact: ArtifactReference, bindings: BindingVector,
): ArtifactSelection {
  switch (artifact.kind) {
    case "tir": return select(meter, module.bodies, bindings, value => {
      if (value.instance.body !== artifact.body) return null;
      const selected: Extract<InstantiatedArtifact, { readonly kind: "tir" }> = { kind: "tir", body: value.tir };
      return bodyCandidate(value.instance, value.tir, selected, value.tir.dependence === "parametric" ? selected : null);
    });
    case "mir": return select(meter, module.bodies, bindings, value =>
      value.instance.body !== artifact.body || value.kind !== "selected" || value.instance.bindings.kind !== "instantiated"
        ? null : bodyCandidate(value.instance, value.mir, { kind: "mir", body: value.mir }));
    case "facts": return select(meter, module.bodies, bindings, value => {
      if (value.instance.body !== artifact.body || value.kind !== "selected" || value.instance.bindings.kind !== "instantiated") return null;
      let selected: BodyFacts | null = null;
      const executions = value.facts;
      for (let position = 0; position < executions.length; position += 1) {
        const stop = chargeInstantiationWork(meter);
        if (stop !== null) return stop;
        const facts = requirePresent(executions[position], missingArtifactRow);
        if (facts.execution.provided !== artifact.provided) continue;
        if (selected !== null) throw new TypeError("Duplicate execution facts artifact");
        selected = facts;
      }
      return selected === null ? null : bodyCandidate(value.instance, selected.execution.instance, { kind: "facts", facts: selected });
    });
    case "summary": {
      const reference = summaryReferenceKey(artifact);
      return select(meter, index.summaries, bindings, summary => {
        if (summaryReferenceKey(summaryReferenceOf(summary.key)) !== reference) return null;
        return parametricCandidate({ kind: "summary", summary }, summaryBindingsOf(summary.key), summary.bindingDependent);
      });
    }
    case "metadata": return select(meter, index.metadata, bindings, metadata => {
      if (metadata.key.definition !== artifact.definition) return null;
      const selected: Extract<InstantiatedArtifact, { readonly kind: "metadata" }> = { kind: "metadata", metadata };
      if (metadata.kind === "data-layout") return { kind: "independent", artifact: selected };
      return metadata.key.bindings.kind === "instantiated" ? { kind: "bound", artifact: selected,
        bindings: metadata.key.bindings.bindings, enclosing: metadata.key.bindings.bindings }
        : { kind: "parametric", artifact: null };
    });
  }
}

type ArtifactProjection = {
  readonly kind: "complete";
  readonly project: (rewrite: TypeReferenceRewrite) => SyntaxCopyResult<ParametricArtifact, InstantiationStop>;
};

function prepareArtifact(scan: ProjectionInventory, artifact: ParametricArtifact,
  bindings: ArtifactBindings, placement: ArtifactPlacement,
): ArtifactProjection | InstantiationStop {
  const environment = inventoryRecord(scan, 2);
  if (environment !== null) return environment;
  switch (artifact.kind) {
    case "tir": {
      const body = inventoryTirBody(scan, artifact.body);
      if (body.kind !== "complete") return body;
      const prepared = body.value;
      const syntax = inventoryBodySyntax(scan, prepared.roots, typedSyntaxPhaseCopy(scan, "Instantiation.root"));
      if (syntax.kind !== "complete") return syntax;
      return {
        kind: "complete",
        project: rewrite => {
          const selected = rewriteBodySyntax(rewrite, prepared.roots, syntax.value);
          return selected.kind === "refused" ? selected : { kind: "copied", value: { kind: "tir",
            body: prepared.project(rewrite, selected.value.root, selected.value.params, bindings, placement),
          } };
        },
      };
    }
    case "summary": {
      const header = inventoryRecord(scan, 2);
      if (header !== null) return header;
      const body = prepareSummary(scan, artifact.summary, bindings);
      if (body.kind === "refused") return body.stop;
      const stop = drainProjectionInventory(scan);
      return stop === null ? {
        kind: "complete",
        project: rewrite => ({ kind: "copied", value: { kind: "summary", summary: body.value(rewrite) } }),
      } : stop;
    }
  }
}

function expansionStop<Value>(result: TypeTransform<Value> & { readonly kind: "resource-limit" }): InstantiationResult & { readonly kind: "resource-limit" } {
  switch (result.dimension) {
    case "depth": return { kind: "resource-limit", dimension: "type-depth", maximum: result.maximum };
    case "visits": return { kind: "resource-limit", dimension: "type-visits", maximum: result.maximum };
    case "union-members":
    case "intersection-members": return { kind: "resource-limit", dimension: result.dimension, maximum: result.maximum };
  }
}

const missingSubstitutionImage: InvariantFailure = ({
  owner: "ir-program", query: null, origin: null,
  message: "Artifact type/signature reference was not inventoried",
});

function transformed<Identity>(values: ReadonlyMap<Identity, Identity>, identity: Identity): Identity {
  return requirePresent(values.get(identity), missingSubstitutionImage);
}

function substituteReferences<Identity extends number>(
  meter: InstantiationMeter, roots: ReadonlySet<Identity>,
  apply: (roots: readonly Identity[]) => TypeTransform<readonly Identity[]> | InstantiationAllocationStop,
): { readonly kind: "complete"; readonly values: ReadonlyMap<Identity, Identity> }
  | (InstantiationResult & { readonly kind: "resource-limit" | "refused" }) {
  const requested: Identity[] = [];
  for (const root of roots) {
    const work = chargeInstantiationWork(meter);
    if (work !== null) return work;
    requested.push(root);
  }
  const result = apply(requested);
  if (result.kind === "refused") return result;
  if (result.kind === "resource-limit") {
    switch (result.dimension) {
      case "depth": case "visits": case "union-members": case "intersection-members": return expansionStop(result);
      default: return result;
    }
  }
  const values = new Map<Identity, Identity>();
  for (const [position, root] of requested.entries()) values.set(root, requirePresent(result.value[position], missingSubstitutionImage));
  return { kind: "complete", values };
}

function admitInstantiationTypes(table: TypeTable, work: TypeTableAdmissionWork<InstantiationAllocationStop>):
  { readonly kind: "complete"; readonly types: TypeInterner } | InstantiationAllocationStop {
  const admitted = admitTypeTable(table, work);
  if (admitted.kind === "invalid") {
    const row = admitted.violations[0];
    if (row === undefined) throw new TypeError("Types admission retains its actual offending row.");
    const code = hostDiagnosticCode("TSONIC_PROGRAM_TYPE_TABLE_INVALID");
    return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
      site: { kind: "none" }, source: "ir-program", evidence: [],
      message: "Instantiation requires a canonical type table at its original ordinals.",
      arguments: foreignTypeDetail(row), related: [], fix: null }] };
  }
  return admitted;
}

export const instantiate: Instantiate = (index, module, artifact, bindings, limits) => {
  const meter = createInstantiationMeter(limits);
  const typeWork = programTypeWork(meter);
  const table = index.types;
  const empty = Array.isArray(table.terms) && table.terms.length === 0
    && Array.isArray(table.signatures) && table.signatures.length === 0;
  const prepared = empty ? null : admitInstantiationTypes(table, typeWork);
  if (prepared !== null && prepared.kind !== "complete") return prepared;
  const selected = selectArtifact(meter, index, module, artifact, bindings);
  switch (selected.kind) {
    case "resource-limit": case "refused": return selected;
    case "missing": return { kind: "missing-binding-artifact", artifact, bindings };
  }
  const admitted = prepared ?? admitInstantiationTypes(table, typeWork);
  if (admitted.kind !== "complete") return admitted;
  const interner = admitted.types;
  if (selected.kind === "exact") return { kind: "instantiated", artifact: selected.artifact, types: viewTypes(interner) };
  return projectArtifact(meter, interner, selected.artifact, { kind: "instantiated", bindings }, { kind: "structural" });
};

function projectArtifact(meter: InstantiationMeter, interner: TypeInterner, artifact: ParametricArtifact,
  instance: Extract<ArtifactBindings, { readonly kind: "instantiated" }>, placement: ArtifactPlacement):
  Extract<InstantiationResult, { readonly kind: "instantiated" | "resource-limit" | "refused" }> {
  const bindings = instance.bindings;
  const typeWork = programTypeWork(meter);
  const lookup = createBindingLookup(meter, bindings);
  if (lookup.kind !== "complete") return lookup;
  const scan = createProjectionInventory(meter, lookup.lookup, () => {
    throw new TypeError("Inline cycle in instantiation TypeComponent");
  });
  const projection = prepareArtifact(scan, artifact, instance, placement);
  if (projection.kind !== "complete") return projection;
  const expansion: TypeExpansionLimits = meter.limits.typeExpansion;
  const types = substituteReferences(meter, scan.types, roots => substitute(interner, roots, bindings, expansion, typeWork));
  if (types.kind !== "complete") return types;
  const signatures = substituteReferences(meter, scan.signatures, roots => substituteSignature(interner, roots, bindings, expansion, "lexical", typeWork));
  if (signatures.kind !== "complete") return signatures;
  const rewrite: TypeReferenceRewrite = {
    type: value => transformed(types.values, value),
    signature: value => transformed(signatures.values, value),
  };
  const projected = projection.project(rewrite);
  if (projected.kind === "refused") return projected.stop;
  return {
    kind: "instantiated",
    artifact: projected.value,
    types: viewTypes(interner),
  };
}

const wrongSpecialization: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A selected Typed projection needs its actual substitution-ready template and placed signature." };

export const specializeTir: SpecializeTir = (template, instance, placement, types, resources) => {
  const meter = ProgramWork.state(resources);
  const initial = chargeInstantiationWork(meter);
  if (initial !== null) return initial;
  const original = placement.template;
  if (instance.body !== template.body || instance.bindings.kind !== "instantiated" || template.bindings.kind !== "parametric"
    || template.dependence !== "parametric" || original.signature.id !== template.signature
    || readSignature(types, template.signature) !== original.signature)
    return throwInvariant(wrongSpecialization);
  let artifactPlacement: ArtifactPlacement;
  if (placement.kind === "execution") {
    const owner = original.signature.owner;
    if (original.request !== null || original.signature.declaration !== null || owner?.kind !== "body"
      || owner.value.body !== template.body || owner.value.node !== template.root.id)
      return throwInvariant(wrongSpecialization);
    artifactPlacement = { kind: "structural" };
  } else {
    const selected = placement.selected;
    if (original.request === null || original.request.definition !== template.owner || original.request.bindings.kind !== "parametric"
      || original.signature.declaration !== template.owner || selected.request?.bindings !== instance.bindings
      || selected.request.definition !== template.owner || selected.request.endpoint !== original.request.endpoint
      || selected.request.ordinal !== original.request.ordinal || selected.signature.declaration !== template.owner
      || readSignature(types, selected.signature.id) !== selected.signature)
      return throwInvariant(wrongSpecialization);
    artifactPlacement = { kind: "selected", signature: selected.signature.id };
  }
  const projected = projectArtifact(meter, types, { kind: "tir", body: template }, instance.bindings, artifactPlacement);
  if (projected.kind !== "instantiated") return projected;
  if (projected.artifact.kind !== "tir") return throwInvariant(wrongSpecialization);
  return { kind: "complete", value: projected.artifact.body };
};
