import type { CallerRefusal, DataflowAccount } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Result } from "../diag/contract.js";
import { orderDiagnostics, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import { decodeModuleId, encodeKey } from "../ids/index.js";
import type { BodyRecord, HostProgram, ModuleBodies, ProgramIndex, ProgramVerificationContext, SignatureRecord } from "../ir-program/contract.js";
import { createProgramVerificationWork, verifyModuleBodies, verifyProgramIndex } from "../ir-program/index.js";
import { artifactBindingsData, artifactBindingsKey, executionKey, instanceKey, nativeFactsKey, signatureRequestKey, viewTypes } from "../ir-types/index.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import type { AnalysisBarrier } from "./analysis-barrier.js";
import { analysisStop } from "./analysis-barrier.js";
import type { BodyFacts, Summary } from "../ir-facts/contract.js";
import { admitSummaryIdentity } from "../ir-facts/index.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export function publishHostProgram(inputs: HostAnalysisInputs, typed: TypedSourceBarrier,
  analysis: AnalysisBarrier, account: DataflowAccount): Result<HostProgram> {
  const { source } = typed;
  const unit = { query: "AnalyzeHostProgram", key: inputs.snapshot.packages.fingerprint };
  const summaryGrowth = chargeResultEntries(account, analysis.summaries.size * 4);
  if (summaryGrowth !== null) return analysisStop(summaryGrowth, unit);
  let orderedSummaries: { readonly key: string; readonly value: Summary }[] = [];
  let scratch: { readonly key: string; readonly value: Summary }[] = [];
  for (const [key, answer] of analysis.summaries) {
    const stop = chargeWork(account, 1);
    if (stop !== null) return analysisStop(stop, unit);
    if ("kind" in answer.value) return fail("An error-valued summary cannot pass the publication barrier.");
    orderedSummaries.push({ key, value: answer.value });
  }
  for (let width = 1; width < orderedSummaries.length; width *= 2) {
    for (let start = 0; start < orderedSummaries.length; start += width * 2) {
      const middle = Math.min(start + width, orderedSummaries.length);
      const end = Math.min(start + width * 2, orderedSummaries.length);
      let left = start;
      let right = middle;
      for (let position = start; position < end; position++) {
        const stop = chargeWork(account, 1);
        if (stop !== null) return analysisStop(stop, unit);
        const first = orderedSummaries[left];
        const second = orderedSummaries[right];
        const takeLeft = left < middle && (right >= end || first !== undefined && second !== undefined && first.key <= second.key);
        const row = takeLeft ? orderedSummaries[left++] : orderedSummaries[right++];
        if (row === undefined) return fail("The completed summary inventory is dense.");
        scratch[position] = row;
      }
    }
    const previous = orderedSummaries;
    orderedSummaries = scratch;
    scratch = previous;
  }
  const bodies: BodyRecord[] = [];
  const modules: ModuleBodies[] = [];
  const signatures = new Map<string, SignatureRecord>();
  for (const module of typed.modules.values()) {
    const published: ModuleBodies["bodies"][number][] = [];
    const ordered = [...module.bodies].sort((left, right) => compareText(left.body, right.body)
      || compareText(artifactBindingsKey(left.bindings), artifactBindingsKey(right.bindings)));
    for (const tir of ordered) {
      const instance = { body: tir.body, bindings: tir.bindings };
      const common = { instance, module: module.module, owner: tir.owner, root: tir.root.id };
      if (tir.bindings.kind === "parametric") {
        bodies.push({ ...common, kind: "template" });
        published.push({ kind: "template", instance, tir });
      } else {
        const mir = analysis.mir.get(instanceKey(instance));
        const observations = analysis.observations.get(instanceKey(instance));
        if (mir === undefined || observations === undefined)
          return fail("A selected publication requires its actual verified MIR and completed observations.");
        const inventory = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (inventory !== null) return analysisStop(inventory, unit);
        const facts: BodyFacts[] = [];
        for (let position = mir.entries.length - 1; position >= 0; position -= 1) {
          const row = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
          if (row !== null) return analysisStop(row, unit);
          const entry = mir.entries[position];
          if (entry === undefined) return fail("The verified selected entry inventory is dense.");
          const execution = { instance, provided: entry.provided };
          const identity = admitSummaryIdentity({ kind: "body", execution }, account);
          if (identity !== null) return analysisStop(identity, unit);
          facts.push(analysis.facts.get(executionKey(execution))
            ?? fail("A selected execution requires its actual verified stable Facts projection."));
        }
        bodies.push({ ...common, kind: "selected", mirLocalCount: mir.locals.length, mirConstantCount: mir.constants.length,
          mirPlaceCount: mir.places.length, mirBlockCount: mir.blocks.length });
        published.push({ kind: "selected", instance, tir, mir, observations, facts });
      }
      const declaration = typed.declarationOf(tir.owner);
      const ordinals = new Map<SignatureRecord["kind"], number>();
      for (const endpoint of declaration?.endpoints ?? []) {
        const ordinal = ordinals.get(endpoint.role) ?? 0;
        ordinals.set(endpoint.role, ordinal + 1);
        if (endpoint.body !== tir.body) continue;
        const request = { definition: endpoint.declaration, endpoint: endpoint.role, ordinal, bindings: tir.bindings };
        const common = { definition: endpoint.declaration, bindings: tir.bindings, ordinal, signature: tir.signature };
        const record: SignatureRecord = endpoint.role === "api-body" ? { ...common, kind: "api-body", body: endpoint.body }
          : { ...common, kind: endpoint.role };
        signatures.set(signatureRequestKey(request), record);
      }
    }
    modules.push({ module: module.module, tree: module.tree, bodies: published });
  }
  bodies.sort((left, right) => compareText(left.instance.body, right.instance.body)
    || compareText(artifactBindingsKey(left.instance.bindings), artifactBindingsKey(right.instance.bindings)));
  modules.sort((left, right) => compareText(left.module, right.module));
  const selectedNativeFactsKey = nativeFactsKey(inputs.snapshot.nativeFacts);
  const index: ProgramIndex = {
    schema: 1, nativeFactsKey: selectedNativeFactsKey, rootPackage: inputs.snapshot.packages.rootPackage,
    packages: inputs.snapshot.packages.packages.map(record => ({ id: record.id, name: record.name,
      packageRoot: record.packageRoot, sourceRoot: record.sourceRoot,
      dependencies: record.dependencies.flatMap(dependency => dependency.resolved === null ? [] : [dependency.resolved]).sort(compareText), exports: record.exports })),
    modules: source.modules.map(({ module }) => {
      const decoded = decodeModuleId(module.module);
      if (decoded.kind !== "decoded") return fail("A checked module retains its actual qualified package identity.");
      const items = [...module.items, { definition: module.tree.tsonic.definition, node: module.tree.id }]
        .sort((left, right) => compareText(left.definition, right.definition));
      return { module: module.module, package: decoded.value.package, items, exports: module.exports,
        bindings: module.bindings, checkerDiagnostics: module.checkerDiagnostics };
    }), types: viewTypes(source.types), signatures: [...signatures.values()].sort((left, right) => compareText(left.definition, right.definition)
      || compareText(encodeKey([artifactBindingsData(left.bindings), left.kind, left.ordinal]),
        encodeKey([artifactBindingsData(right.bindings), right.kind, right.ordinal]))),
    bodies, dependencyInventory: analysis.inventory, metadata: [], constants: [],
    summaries: orderedSummaries.map(row => row.value),
    diagnostics: orderDiagnostics(typed.database.diagnostics()),
  };
  const conditionRefusal: CallerRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: "condition alternatives", maximum: inputs.limits.analyses.maximumConditionAlternatives, site: { kind: "none" },
    unit: { request: unit, position: { kind: "result" } } })] };
  const context: ProgramVerificationContext = {
    nativeFactsKey: selectedNativeFactsKey, selectedNativeFacts: inputs.snapshot.nativeFacts,
    facts: analysis.verification, resources: createProgramVerificationWork(inputs.limits.instantiation, account),
    conditionRefusal, mirVerification: inputs.limits.mirVerification,
    modulePathOf: module => { const path = decodeModuleId(module); return path.kind === "decoded" ? path.value : null; },
    definitionPathOf: definition => source.definitionPaths.get(definition) ?? null,
    tirOf: typed.verifierOf,
    signatureIdOf: (definition, endpoint, ordinal, bindings) => signatures.get(signatureRequestKey({ definition, endpoint, ordinal, bindings }))?.signature ?? null,
  };
  const verifiedIndex = verifyProgramIndex(index, context);
  if (verifiedIndex.kind === "refused") return verifiedIndex;
  if (verifiedIndex.kind === "resource-limit") return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: verifiedIndex.dimension, maximum: verifiedIndex.maximum, site: { kind: "none" },
    unit: { request: unit, position: { kind: "result" } } })] };
  if (verifiedIndex.violations.length !== 0) {
    const first = verifiedIndex.violations[0];
    return fail(`The actual Program index violates ${first?.rule}: ${first?.detail[0]?.kind === "text" ? first.detail[0].value : ""}.`);
  }
  for (const module of modules) {
    const result = verifyModuleBodies(index, module, context);
    if (result.kind === "refused") return result;
    if (result.kind === "resource-limit") return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
      limit: result.dimension, maximum: result.maximum, site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] };
    if (result.violations.length !== 0) {
      const first = result.violations[0];
      return fail(`The actual Program publication violates ${first?.rule}: ${first?.detail[0]?.kind === "text" ? first.detail[0].value : ""}.`);
    }
  }
  return { kind: "ok", diagnostics: index.diagnostics, value: { index, modules } };
}
