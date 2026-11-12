import type { ArtifactBindings, BindingVector, TypeExpansionLimits, TypeTransform } from "../ir-types/contract.js";
import type { ArtifactReference, Instantiate, InstantiatedArtifact, InstantiationResult, ModuleBodies, ProgramIndex } from "./contract.js";
import { encodeKey } from "../ids/index.js";
import { requirePresent } from "../diag/index.js";
import type { InvariantFailure } from "../diag/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { BodyFacts, Summary } from "../ir-facts/contract.js";
import { exportTypes, seedTypeInterner, substitute, substituteSignature } from "../ir-types/index.js";
import type { InstantiationMeter, InstantiationStop } from "./program-values.js";
import type { TypeRewrite } from "./canonical-types.js";
import {
  admitBindingVector, bindingData, chargeInstantiationWork, createBindingLookup, createInstantiationMeter,
  createProjectionInventory, drainProjectionInventory, inventoryRecord,
} from "./program-values.js";
import type { ProjectionInventory } from "./program-values.js";
import { admitTypeSeed, stabilizePublication } from "./instantiate-types.js";
import { inventoryBodyFacts, inventorySummary } from "./instantiate-facts.js";
import { inventoryMirBody, inventoryTirBody } from "./instantiate-tir.js";
import { inventoryBodySyntax } from "./instantiate-syntax.js";
import { rewriteBodySyntax } from "./canonical-syntax.js";
import { rewriteMirBody, rewriteTirBody } from "./canonical-tir.js";
import { rewriteBodyFacts, rewriteSummary } from "./canonical-facts.js";

type StructuralArtifact =
  | { readonly kind: "tir"; readonly body: TirBody }
  | { readonly kind: "mir"; readonly body: MirBody }
  | { readonly kind: "facts"; readonly facts: BodyFacts }
  | { readonly kind: "summary"; readonly summary: Summary };

type ArtifactCandidate = {
  readonly artifact: StructuralArtifact;
  readonly bindings: ArtifactBindings;
  readonly dependence: "parametric" | "binding-dependent";
} | {
  readonly artifact: InstantiatedArtifact & { readonly kind: "metadata" };
  readonly bindings: ArtifactBindings;
  readonly dependence: "binding-dependent" | "independent-data";
};

type ArtifactSelection =
  | { readonly kind: "exact"; readonly artifact: InstantiatedArtifact }
  | { readonly kind: "template"; readonly artifact: StructuralArtifact }
  | { readonly kind: "missing" }
  | InstantiationStop;

function bindingKey(meter: InstantiationMeter, bindings: BindingVector): string | InstantiationStop {
  for (const family of [bindings.classBindings, bindings.methodBindings, bindings.capturedBindings, bindings.selfBindings]) {
    for (const _binding of family) {
      const stop = chargeInstantiationWork(meter);
      if (stop !== null) return stop;
    }
  }
  return encodeKey(bindingData(bindings));
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
  candidateOf: (value: Value) => ArtifactCandidate | null,
): ArtifactSelection {
  const keys = new Set<string>();
  let requested: string | null = null;
  let exact: InstantiatedArtifact | null = null;
  let template: ArtifactCandidate | null = null;
  for (const value of values) {
    const work = chargeInstantiationWork(meter);
    if (work !== null) return work;
    const candidate = candidateOf(value);
    if (candidate === null) continue;
    if (candidate.dependence === "independent-data") return { kind: "exact", artifact: candidate.artifact };
    if (requested === null) {
      const key = bindingKey(meter, bindings);
      if (typeof key !== "string") return key;
      requested = key;
    }
    switch (candidate.bindings.kind) {
      case "parametric":
        if (template !== null) throw new TypeError("Duplicate parametric artifact");
        template = candidate;
        break;
      case "instantiated": {
        const key = bindingKey(meter, candidate.bindings.bindings);
        if (typeof key !== "string") return key;
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
  if (template === null || requested === null || template.dependence !== "parametric") return { kind: "missing" };
  const stop = admitVector(meter, keys, requested);
  return stop ?? { kind: "template", artifact: template.artifact };
}

export function selectArtifact(
  meter: InstantiationMeter, index: ProgramIndex, module: ModuleBodies,
  artifact: ArtifactReference, bindings: BindingVector,
): ArtifactSelection {
  switch (artifact.kind) {
    case "tir":
    case "mir":
    case "facts": return select(meter, module.bodies, bindings, value => {
      if (value.instance.body !== artifact.body) return null;
      const selected: StructuralArtifact = artifact.kind === "tir" ? { kind: "tir", body: value.tir }
        : artifact.kind === "mir" ? { kind: "mir", body: value.mir } : { kind: "facts", facts: value.facts };
      return { artifact: selected, bindings: value.instance.bindings, dependence: value.tir.dependence };
    });
    case "summary": return select(meter, index.summaries, bindings, summary => {
      if (summary.key.definition !== artifact.definition) return null;
      return {
        artifact: { kind: "summary", summary }, bindings: summary.key.bindings,
        dependence: summary.bindingDependent ? "binding-dependent" : "parametric",
      };
    });
    case "metadata": return select(meter, index.metadata, bindings, metadata => {
      if (metadata.key.definition !== artifact.definition) return null;
      return {
        artifact: { kind: "metadata", metadata }, bindings: metadata.key.bindings,
        dependence: metadata.kind === "data-layout" ? "independent-data" : "binding-dependent",
      };
    });
  }
}

type ArtifactProjection = {
  readonly kind: "complete";
  readonly project: (rewrite: TypeRewrite, bindings: ArtifactBindings) => StructuralArtifact;
};

function prepareArtifact(scan: ProjectionInventory, artifact: StructuralArtifact): ArtifactProjection | InstantiationStop {
  const environment = inventoryRecord(scan, 2);
  if (environment !== null) return environment;
  switch (artifact.kind) {
    case "tir": {
      const body = inventoryTirBody(scan, artifact.body) ?? drainProjectionInventory(scan);
      if (body !== null) return body;
      const syntax = inventoryBodySyntax(scan, artifact.body.root);
      if (syntax.kind !== "complete") return syntax;
      return {
        kind: "complete",
        project: (rewrite, bindings) => ({ kind: "tir", body: rewriteTirBody(
          rewrite, artifact.body, rewriteBodySyntax(rewrite, artifact.body.root, syntax.syntax, "Instantiation.root"), bindings,
        ) }),
      };
    }
    case "mir": {
      const body = inventoryMirBody(scan, artifact.body) ?? drainProjectionInventory(scan);
      if (body !== null) return body;
      return { kind: "complete", project: (rewrite, bindings) => ({
        kind: "mir", body: rewriteMirBody(rewrite, artifact.body, "Instantiation.mir", bindings),
      }) };
    }
    case "facts": {
      const body = inventoryRecord(scan, 2) ?? inventoryBodyFacts(scan, artifact.facts) ?? drainProjectionInventory(scan);
      if (body !== null) return body;
      return { kind: "complete", project: (rewrite, bindings) => ({
        kind: "facts", facts: rewriteBodyFacts(rewrite, artifact.facts, { body: artifact.facts.instance.body, bindings }),
      }) };
    }
    case "summary": {
      const body = inventoryRecord(scan, 2) ?? inventorySummary(scan, artifact.summary) ?? drainProjectionInventory(scan);
      if (body !== null) return body;
      return { kind: "complete", project: (rewrite, bindings) => ({
        kind: "summary", summary: rewriteSummary(rewrite, artifact.summary, { definition: artifact.summary.key.definition, bindings }),
      }) };
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
  apply: (roots: readonly Identity[]) => TypeTransform<readonly Identity[]>,
): { readonly kind: "complete"; readonly values: ReadonlyMap<Identity, Identity> }
  | (InstantiationResult & { readonly kind: "resource-limit" }) {
  const requested: Identity[] = [];
  for (const root of roots) {
    const work = chargeInstantiationWork(meter);
    if (work !== null) return work;
    requested.push(root);
  }
  const result = apply(requested);
  if (result.kind !== "complete") return expansionStop(result);
  const values = new Map<Identity, Identity>();
  for (const [position, root] of requested.entries()) values.set(root, requirePresent(result.value[position], missingSubstitutionImage));
  return { kind: "complete", values };
}

export const instantiate: Instantiate = (index, module, artifact, bindings, limits) => {
  const meter = createInstantiationMeter(limits);
  const selected = selectArtifact(meter, index, module, artifact, bindings);
  switch (selected.kind) {
    case "resource-limit": return selected;
    case "missing": return { kind: "missing-binding-artifact", artifact, bindings };
    case "exact": return { kind: "instantiated", artifact: selected.artifact, types: index.types };
    case "template": break;
  }
  const lookup = createBindingLookup(meter, bindings);
  if (lookup.kind !== "complete") return lookup;
  const seed = admitTypeSeed(meter, index.types);
  if (seed !== null) return seed;
  const interner = seedTypeInterner(index.types);
  const scan = createProjectionInventory(meter, lookup.lookup);
  const projection = prepareArtifact(scan, selected.artifact);
  if (projection.kind !== "complete") return projection;
  const expansion: TypeExpansionLimits = limits.typeExpansion;
  const types = substituteReferences(meter, scan.types, roots => substitute(interner, roots, bindings, expansion));
  if (types.kind !== "complete") return types;
  const signatures = substituteReferences(meter, scan.signatures, roots => substituteSignature(interner, roots, bindings, expansion));
  if (signatures.kind !== "complete") return signatures;
  const publication = exportTypes(interner, {
    maximumWork: limits.maximumWork - meter.work,
    maximumCreatedRecords: limits.maximumCreatedRecords - meter.created,
  });
  if (publication.kind !== "complete") return publication;
  meter.work += publication.work;
  meter.created += publication.createdRecords;
  const stable = stabilizePublication(meter, index.types, publication.value);
  if (stable.kind !== "complete") return stable;
  const rewrite: TypeRewrite = {
    ...lookup.lookup,
    type: value => stable.rewrite.type(transformed(types.values, value)),
    signature: value => stable.rewrite.signature(transformed(signatures.values, value)),
  };
  return {
    kind: "instantiated",
    artifact: projection.project(rewrite, { kind: "instantiated", bindings }),
    types: stable.types,
  };
};
