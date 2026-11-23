import { ProgramWork } from "./work.js";
import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeWork } from "../dataflow/index.js";
import { orderDiagnostics } from "../diag/index.js";
import type { DefId, ModuleId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { admitArtifactIdentity, summaryKey, verifyDependencyInventory, verifyMetadata, verifySummary } from "../ir-facts/index.js";
import { indexSyntaxTree } from "../ir-hir/index.js";
import { artifactBindingsData, artifactBindingsKey, constantReferenceKey, executionKey, floatingBitsFit, instanceKey, nativeCarrierOf, nativeFactsKey, optionalValueDomainOf, verifyNativeFacts, verifyTypes } from "../ir-types/index.js";
import type { TirVerifierInput } from "../ir-tir/contract.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { BindingVerificationInput, NativeFloatingFormat, TypeRule, TypeSite, TypeTerm } from "../ir-types/contract.js";
import type { Violation } from "../diag/contract.js";
import type {
  ProgramIndex,
  ProgramRule,
  ProgramSite,
  ProgramVerificationContext,
  ProgramVerificationResult,
  SignatureRecord,
  VerifyProgramIndex,
} from "./contract.js";

import type { ProgramLookup } from "./work.js";
import type { ProgramViolation } from "./work-data.js";
import { artifactEnvironmentKey, compareText, numberDetail, programChildRule, programLookup, summaryBindingsOf, summaryReferenceOf, textDetail, uniqueRows } from "./program-values.js";
import { chargeInstantiationWork, requireInstantiationMaximum } from "./work.js";
import type { InstantiationAllocationStop } from "./work.js";
import { matchesProgramTypeTable, refuseVerification, verificationContext, verificationFailure, verificationTypes } from "./verification-work.js";
import { verifyBindingBounds, verifyBodyInventory, verifyModules, verifyPackages } from "./verify-structure.js";
import { verifyModuleBindings } from "./verify-module-bindings.js";
import { verifyInitialization, verifyInitializationEffects } from "./verify-initialization.js";
import { textModuleBinding, textModuleExport } from "./text-module-bindings.js";
import { emitText, sequence, textDiagnostic } from "./text-values.js";

function numericPosition(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) && value < length;
}

function signatureKey(record: SignatureRecord): string {
  return encodeKey([artifactBindingsData(record.bindings), record.kind, record.ordinal]);
}

function verifySignatures(
  lookup: ProgramLookup,
  index: ProgramIndex,
  context: ProgramVerificationContext,
  modules: ReadonlyMap<ModuleId, TirVerifierInput | null>,
  bindings: BindingVerificationInput[],
  bindingSites: ProgramSite[],
  account: DataflowAccount,
): DataflowResult<readonly ProgramViolation[]> {
  const violations: ProgramViolation[] = [];
  interface EndpointRoles {
    readonly advertised: HirCallableEndpoint[];
    readonly "api-signature": HirCallableEndpoint[];
    readonly "api-body": HirCallableEndpoint[];
  }
  const endpoints = new Map<DefId, EndpointRoles | null>();
  let previous: SignatureRecord | null = null;
  let previousKey: string | null = null;
  for (let position = 0; position < index.signatures.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const record = index.signatures[position];
    if (record === undefined) throw new TypeError("The Program signature inventory must be dense.");
    let key: string | null = null;
    const site: ProgramSite = { kind: "signature", signature: record.signature };
    if (previous !== null) {
      const definitions = chargeWork(account, previous.definition.length + record.definition.length);
      if (definitions !== null) return definitions;
      const definitionOrder = compareText(previous.definition, record.definition);
      if (definitionOrder >= 0) {
        if (previousKey === null) {
          const encoding = admitArtifactIdentity(previous.bindings, account);
          if (encoding !== null) return encoding;
          previousKey = signatureKey(previous);
        }
        const encoding = admitArtifactIdentity(record.bindings, account);
        if (encoding !== null) return encoding;
        key = signatureKey(record);
        const comparison = definitionOrder === 0 ? chargeWork(account, previousKey.length + key.length) : null;
        if (comparison !== null) return comparison;
        if (definitionOrder > 0 || compareText(previousKey, key) >= 0) {
          violations.push({ rule: "signatures-order", site, detail: [textDetail(previous.definition), textDetail(previousKey), textDetail(record.definition), textDetail(key)] });
        }
      }
    }
    previous = record;
    previousKey = key;
    if (!numericPosition(record.signature, index.types.signatures.length)) {
      violations.push({ rule: "signature-reference-resolves", site, detail: [numberDetail(record.signature)] });
    }
    let roles = endpoints.get(record.definition);
    if (roles === undefined) {
      const owner = lookup.definitions.get(record.definition);
      const input = owner === undefined || owner === null ? null : modules.get(owner.module);
      const declaration = input === undefined || input === null ? null : input.declarationOf(record.definition);
      if (declaration === null) roles = null;
      else {
        roles = { advertised: [], "api-signature": [], "api-body": [] };
        for (const endpoint of declaration.endpoints) roles[endpoint.role].push(endpoint);
      }
      endpoints.set(record.definition, roles);
    }
    const ordinalValid = Number.isSafeInteger(record.ordinal) && record.ordinal >= 0 && !Object.is(record.ordinal, -0);
    if (ordinalValid) {
      const identity = chargeWork(account, record.definition.length) ?? admitArtifactIdentity(record.bindings, account);
      if (identity !== null) return identity;
    }
    const answer = ordinalValid ? context.signatureIdOf(record.definition, record.kind, record.ordinal, record.bindings) : null;
    const endpoint = roles === null ? undefined : roles[record.kind][record.ordinal];
    if (endpoint === undefined || endpoint.declaration !== record.definition || !ordinalValid
      || answer === null || !Object.is(answer, record.signature)
      || (record.kind === "api-body" && endpoint.body !== record.body)) {
      violations.push({ rule: "signature-endpoints-exact", site, detail: [textDetail(record.definition), textDetail(record.kind), numberDetail(record.ordinal)] });
    }
    switch (record.bindings.kind) {
      case "parametric": break;
      case "instantiated": {
        const scope = context.facts.bindingScopeOf(record.definition);
        if (scope === null) {
          violations.push({ rule: "bindings-complete", site, detail: [textDetail(record.definition)] });
        } else {
          bindings.push({ vector: record.bindings.bindings, scope });
          bindingSites.push(site);
        }
        break;
      }
    }
  }
  return { kind: "complete", value: violations };
}

function verifySourceInventory(
  index: ProgramIndex,
  modules: ReadonlyMap<ModuleId, TirVerifierInput | null>,
  account: DataflowAccount,
): DataflowResult<readonly ProgramViolation[]> {
  const violations: ProgramViolation[] = [];
  const nodeCounts = new Map<ModuleId, number>();
  for (const record of index.modules) {
    const input = modules.get(record.module);
    if (input === undefined || input === null) {
      violations.push({ rule: "tir-valid", site: { kind: "module", module: record.module }, detail: [textDetail("missing-module-data")] });
      continue;
    }
    const inventories: readonly (readonly [string, string, ProgramRule])[] = [
      [emitText(sequence(record.exports, textModuleExport), "exports"), emitText(sequence(input.source.exports, textModuleExport), "exports"), "export-target-resolves"],
      [emitText(sequence(record.bindings, textModuleBinding), "bindings"), emitText(sequence(input.source.bindings, textModuleBinding), "bindings"), "binding-target-resolves"],
      [emitText(sequence(record.checkerDiagnostics, textDiagnostic), "checkerDiagnostics"), emitText(sequence(input.source.checkerDiagnostics, textDiagnostic), "checkerDiagnostics"), "binding-diagnostic-resolves"],
    ];
    for (const [actual, expected, rule] of inventories) if (actual !== expected)
      violations.push({ rule, site: { kind: "module", module: record.module }, detail: [textDetail("checked-module-inventory-exact")] });
    const nodes = indexSyntaxTree(input.source.tree);
    nodeCounts.set(record.module, nodes.length);
    const byId = uniqueRows(nodes, node => node.id);
    const definitions = uniqueRows(input.source.items, item => item.definition);
    for (const [position, node] of nodes.entries()) {
      if (node.id !== position || Object.is(node.id, -0)) {
        violations.push({ rule: "module-node-id-dense", site: { kind: "node", module: record.module, node: node.id }, detail: [numberDetail(position), numberDetail(node.id)] });
      }
    }
    for (const item of record.items) {
      const site: ProgramSite = { kind: "definition", definition: item.definition };
      const original = item.definition === input.source.tree.tsonic.definition ? input.source.tree
        : definitions.get(item.definition);
      const originalNode = original === undefined || original === null ? undefined : "node" in original ? original.node : original.id;
      if (originalNode === undefined || !Object.is(originalNode, item.node)) {
        violations.push({ rule: "item-definition-resolves", site, detail: [numberDetail(item.node)] });
      }
      const node = byId.get(item.node);
      if (!numericPosition(item.node, nodes.length) || node === undefined || node === null) {
        violations.push({ rule: "definition-node-resolves", site, detail: [numberDetail(item.node)] });
      } else if (node.origin.module !== record.module) {
        violations.push({ rule: "definition-node-owner-exact", site, detail: [textDetail(node.origin.module), numberDetail(node.id)] });
      }
    }
  }
  for (let position = 0; position < index.bodies.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const record = index.bodies[position];
    if (record === undefined) throw new TypeError("The Program body inventory must be dense.");
    const input = modules.get(record.module);
    const site: ProgramSite = { kind: "body", instance: record.instance };
    if (input !== undefined && input !== null) {
      const identity = chargeWork(account, record.instance.body.length) ?? admitArtifactIdentity(record.instance.bindings, account);
      if (identity !== null) return identity;
    }
    const body = input === undefined || input === null ? null : input.bodyOf(record.instance);
    const count = nodeCounts.get(record.module);
    if (count === undefined || !numericPosition(record.root, count) || body === null || !Object.is(body.root.id, record.root)) {
      violations.push({ rule: "body-root-resolves", site, detail: [numberDetail(record.root)] });
    } else if (body.owner !== record.owner || body.body !== record.instance.body || body.root.origin.module !== record.module) {
      violations.push({ rule: "node-body-ownership", site, detail: [textDetail(body.owner), textDetail(body.body), numberDetail(body.root.id)] });
    }
  }
  return { kind: "complete", value: violations };
}

function verifyBodyBindings(
  index: ProgramIndex, context: ProgramVerificationContext,
  bindings: BindingVerificationInput[], sites: ProgramSite[],
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  for (const record of index.bodies) {
    switch (record.instance.bindings.kind) {
      case "parametric": break;
      case "instantiated": {
        const site: ProgramSite = { kind: "body", instance: record.instance };
        const scope = context.facts.bindingScopeOf(record.owner);
        if (scope === null) violations.push({ rule: "bindings-complete", site, detail: [textDetail(record.owner)] });
        else {
          bindings.push({ vector: record.instance.bindings.bindings, scope });
          sites.push(site);
        }
        break;
      }
    }
  }
  for (const constant of index.constants) {
    const site: ProgramSite = { kind: "body", instance: constant.reference.initializer };
    const owner = context.facts.bodyOwner(constant.reference.initializer.body);
    if (owner === null) {
      violations.push({ rule: "cross-owner-reference-resolves", site, detail: [textDetail(constant.reference.initializer.body)] });
    } else if (constant.reference.initializer.bindings.kind === "instantiated") {
      const scope = context.facts.bindingScopeOf(owner);
      if (scope === null) violations.push({ rule: "bindings-complete", site, detail: [textDetail(owner)] });
      else {
        bindings.push({ vector: constant.reference.initializer.bindings.bindings, scope });
        sites.push(site);
      }
    }
  }
  return violations;
}

function verifyPublishedRecords(index: ProgramIndex, context: ProgramVerificationContext): ProgramVerificationResult {
  const violations: ProgramViolation[] = [];
  const account = ProgramWork.state(context.resources).account;
  let previousMetadata: { readonly definition: DefId; readonly environment: string } | null = null;
  const metadataKeys = new Set<string>();
  for (const record of index.metadata) {
    const environment = artifactBindingsKey(record.key.bindings);
    const key = artifactEnvironmentKey(record.key.definition, record.key.bindings);
    const site: ProgramSite = { kind: "artifact", artifact: { kind: "metadata", definition: record.key.definition }, bindings: record.key.bindings };
    if (previousMetadata !== null && (compareText(previousMetadata.definition, record.key.definition) || compareText(previousMetadata.environment, environment)) > 0) {
      violations.push({ rule: "metadata-order", site, detail: [textDetail(previousMetadata.definition), textDetail(previousMetadata.environment), textDetail(key)] });
    }
    if (metadataKeys.has(key)) violations.push({ rule: "metadata-key-unique", site, detail: [textDetail(key)] });
    metadataKeys.add(key);
    previousMetadata = { definition: record.key.definition, environment };
    const metadata = verifyMetadata(record, context.facts, account);
    if (metadata.kind !== "complete") return refuseVerification(index, context.resources, metadata);
    for (const child of metadata.violations) {
      violations.push({ rule: programChildRule("metadata-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  let previousSummary: string | null = null;
  const summaryKeys = new Set<string>();
  for (const summary of index.summaries) {
    const key = summaryKey(summary.key);
    const site: ProgramSite = { kind: "artifact", artifact: summaryReferenceOf(summary.key), bindings: summaryBindingsOf(summary.key) };
    if (previousSummary !== null && compareText(previousSummary, key) > 0) {
      violations.push({ rule: "summaries-order", site, detail: [textDetail(previousSummary), textDetail(key)] });
    }
    if (summaryKeys.has(key)) violations.push({ rule: "summary-key-unique", site, detail: [textDetail(key)] });
    summaryKeys.add(key);
    previousSummary = key;
    const checked = verifySummary(summary, context.facts, { account, conditionRefusal: context.conditionRefusal });
    if (checked.kind !== "complete") return refuseVerification(index, context.resources, checked);
    for (const child of checked.violations) {
      violations.push({ rule: programChildRule("summary-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  let previousConstant: string | null = null;
  const constantKeys = new Set<string>();
  for (const constant of index.constants) {
    const key = constantReferenceKey(constant.reference);
    const site: ProgramSite = { kind: "body", instance: constant.reference.initializer };
    if (previousConstant !== null && previousConstant > key) {
      violations.push({ rule: "constants-order", site, detail: [textDetail(previousConstant), textDetail(key)] });
    }
    if (constantKeys.has(key)) violations.push({ rule: "constant-key-unique", site, detail: [textDetail(key)] });
    constantKeys.add(key);
    previousConstant = key;
    if (!numericPosition(constant.value.type, index.types.terms.length)) {
      violations.push({ rule: "constant-type-resolves", site, detail: [numberDetail(constant.value.type)] });
    } else {
      if (constant.value.kind !== "floating" && constant.value.kind !== "number") continue;
      let carrierStop: InstantiationAllocationStop | null = null;
      const readType = (type: TyId): TypeTerm | null | undefined => {
        carrierStop ??= chargeInstantiationWork(ProgramWork.state(context.resources));
        if (carrierStop !== null) return null;
        return index.types.terms[type];
      };
      let enclosingOptional: Extract<TypeTerm, { readonly kind: "optional" }> | undefined;
      const selected = nativeCarrierOf(index.types, constant.value.type, type => {
        const term = readType(type);
        if (term?.kind === "optional") enclosingOptional = term;
        return term;
      });
      if (carrierStop !== null) return refuseVerification(index, context.resources, carrierStop);
      let carrier = selected.kind === "primitive" ? selected.primitive : null;
      if (enclosingOptional !== undefined) {
        const optional = optionalValueDomainOf(enclosingOptional, type => {
          const term = readType(type);
          if (term === undefined) throw new TypeError("An optional constant requires its actual ready payload type");
          return term;
        });
        if (carrierStop !== null) return refuseVerification(index, context.resources, carrierStop);
        if (optional.kind === "optional-value" && optional.payload === "float64") carrier = "float64";
      }
      if (constant.value.kind === "floating") {
        if (carrier === null) throw new TypeError("Program floating constants require their actual selected native carrier");
        const formats = context.selectedNativeFacts.floatingFormats;
        let format: NativeFloatingFormat | undefined;
        let remainingFormats = formats.length;
        if (remainingFormats !== 0) {
          const read = chargeWork(account, 1);
          if (read !== null) return refuseVerification(index, context.resources, read);
          for (const candidate of formats) {
            if (candidate.carrier === carrier) {
              format = candidate;
              break;
            }
            remainingFormats -= 1;
            if (remainingFormats !== 0) {
              const next = chargeWork(account, 1);
              if (next !== null) return refuseVerification(index, context.resources, next);
            }
          }
        }
        if (format === undefined && (carrier === "float16" || carrier === "float32" || carrier === "float64")) {
          throw new TypeError("Program floating constants require the selected carrier format");
        }
        if (format === undefined || !floatingBitsFit(constant.value.bits, format)) {
          violations.push({ rule: "constant-floating-value", site, detail: [] });
        }
      } else if (constant.value.kind === "number" && (carrier === "float16" || carrier === "float32" || carrier === "float64")) {
        violations.push({ rule: "constant-floating-value", site, detail: [] });
      }
    }
  }
  const ordered = orderDiagnostics(index.diagnostics);
  if (ordered.some((diagnostic, position) => diagnostic !== index.diagnostics[position])) {
    violations.push({ rule: "diagnostics-order", site: { kind: "index" }, detail: [] });
  }
  return { kind: "complete", violations };
}

function verifyExecutions(lookup: ProgramLookup, index: ProgramIndex): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  for (const operation of index.dependencyInventory.operations) {
    if (operation.kind !== "body") continue;
    const execution = operation.execution;
    const site: ProgramSite = { kind: "body", instance: execution.instance };
    const key = executionKey(execution);
    const body = lookup.instances.get(instanceKey(execution.instance));
    if (body === undefined || body === null || body.kind !== "selected") {
      violations.push({ rule: "execution-body-resolves", site, detail: [textDetail(key)] });
    }
    if (!Number.isSafeInteger(execution.provided) || execution.provided < 0 || Object.is(execution.provided, -0)) {
      violations.push({ rule: "execution-entry-resolves", site, detail: [numberDetail(execution.provided)] });
    }
  }
  return violations;
}

export const verifyProgramIndex: VerifyProgramIndex = (index, context) => {
  const prior = verificationFailure(index, context.resources);
  if (prior !== null) return prior;
  const state = ProgramWork.state(context.resources);
  state.verifiedIndex = null;
  if (typeof context.nativeFactsKey !== "string" || context.nativeFactsKey.length === 0) {
    throw new TypeError("Program verification requires the selected native facts identity");
  }
  if (verifyNativeFacts(context.selectedNativeFacts).length !== 0 || nativeFactsKey(context.selectedNativeFacts) !== context.nativeFactsKey) {
    throw new TypeError("Program verification requires the matching selected native facts record");
  }
  const admitted = verificationTypes(index, context.resources);
  if (admitted.kind === "invalid") return { kind: "complete", violations: admitted.violations };
  if (admitted.kind !== "complete") return admitted;
  const input = index;
  context = verificationContext(context, index.types, admitted.index.types);
  index = admitted.index;
  requireInstantiationMaximum(state.limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  const inventory = verifyDependencyInventory(index.dependencyInventory, context.facts, state.account);
  if (inventory.kind !== "complete") return refuseVerification(index, context.resources, inventory);
  const lookup = programLookup(index);
  const violations: ProgramViolation[] = [];
  for (const child of inventory.violations) violations.push({ rule: programChildRule("dependency-inventory-valid", child.rule), site: { kind: "index" }, detail: [textDetail(child.rule), ...child.detail] });
  if (index.schema !== 1) violations.push({ rule: "schema-supported", site: { kind: "index" }, detail: [numberDetail(index.schema)] });
  if (typeof index.nativeFactsKey !== "string" || index.nativeFactsKey.length === 0 || index.nativeFactsKey !== context.nativeFactsKey) {
    violations.push({ rule: "native-facts-identity", site: { kind: "index" }, detail: [] });
  }
  for (const group of [verifyPackages(lookup, index), verifyModules(lookup, index, context), verifyBodyInventory(lookup, index, context), verifyExecutions(lookup, index)]) {
    for (const violation of group) violations.push(violation);
  }
  if (!matchesProgramTypeTable(index.types, context.facts.types)) {
    violations.push({ rule: "shared-type-table", site: { kind: "index" }, detail: [] });
  }
  const modules = new Map<ModuleId, TirVerifierInput | null>();
  for (const record of index.modules) modules.set(record.module, context.tirOf(record.module));
  const bindings: BindingVerificationInput[] = [];
  const bindingSites: ProgramSite[] = [];
  const sourceInventory = verifySourceInventory(index, modules, state.account);
  if (sourceInventory.kind !== "complete") return refuseVerification(index, context.resources, sourceInventory);
  for (const violation of sourceInventory.value) violations.push(violation);
  for (const violation of verifyModuleBindings(lookup, index, context, modules)) violations.push(violation);
  const signatures = verifySignatures(lookup, index, context, modules, bindings, bindingSites, state.account);
  if (signatures.kind !== "complete") return refuseVerification(index, context.resources, signatures);
  for (const violation of signatures.value) violations.push(violation);
  for (const violation of verifyBodyBindings(index, context, bindings, bindingSites)) violations.push(violation);
  const records = verifyPublishedRecords(index, context);
  if (records.kind !== "complete") return refuseVerification(index, context.resources, records);
  for (const violation of records.violations) violations.push(violation);
  const initialization = verifyInitialization(index, lookup, context.initialization, state.account);
  if (initialization.kind !== "complete") return refuseVerification(index, context.resources, initialization);
  for (const violation of initialization.value) violations.push(violation);
  if (initialization.value.length === 0 && records.violations.length === 0) {
    const effects = verifyInitializationEffects(index.initialization, lookup, {
      account: state.account, eventCount: 0,
      maximumConditionAlternatives: context.facts.limits.maximumConditionAlternatives, refusal: context.conditionRefusal,
    });
    if (effects.kind !== "complete") return refuseVerification(index, context.resources, effects);
    if (effects.value !== null) violations.push(effects.value);
  }
  const bounds = verifyBindingBounds(index, context);
  if (bounds.kind !== "complete") return refuseVerification(index, context.resources, bounds);
  for (const violation of bounds.value) violations.push(violation);
  const bindingViolations = new Map<number, Violation<TypeRule, TypeSite>[]>();
  for (const child of verifyTypes({
    table: index.types, bindings, evidence: [], nominalOf: context.facts.nominalOf,
    nodeExists: context.facts.nodeExists, localExists: context.facts.localExists,
  })) {
    if (child.site.kind === "binding") {
      const previous = bindingViolations.get(child.site.vector);
      if (previous === undefined) bindingViolations.set(child.site.vector, [child]);
      else previous.push(child);
    } else violations.push({ rule: "types-valid", site: { kind: "index" }, detail: [textDetail(child.rule), ...child.detail] });
  }
  for (const [position, site] of bindingSites.entries()) {
    for (const child of bindingViolations.get(position) ?? []) {
      const rule = child.rule === "binding-vector-complete" || child.rule === "self-binding-order" ? "bindings-complete" : "types-valid";
      violations.push({ rule, site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  if (violations.length === 0) state.verifiedIndex = { index: input, lookup };
  return { kind: "complete", violations };
};
