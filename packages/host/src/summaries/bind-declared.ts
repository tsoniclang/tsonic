import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { encodeKey } from "../ids/index.js";
import { bindingVectorKey, signatureRequestKey } from "../ir-types/index.js";
import type { Summary } from "../ir-facts/contract.js";
import { admitArtifactIdentity, admitBindingIdentity, admitSelectionIdentity, admitSummaryIdentity } from "../ir-facts/index.js";
import { memberSelectionKey } from "../ir-tir/index.js";
import { libraryExportKey } from "../libraries/index.js";
import type { NativeExportAssociation } from "../libraries/contract.js";
import type { BindDeclaredSummary, DeclaredSummaryDeps, DeclaredSummaryInput } from "./contract.js";
import { admitNativeIdentity, declaredScopeBindings } from "./declared-work.js";
import type { ExportValue } from "./translate-native.js";
import { translateNativeSummary } from "./translate-native.js";
import { unknownDeclaredSummary } from "./unknown-declared.js";

function validOrdinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function validateSelection(account: DataflowAccount, deps: DeclaredSummaryDeps, input: DeclaredSummaryInput): DataflowStop | null {
  const start = chargeWork(account, 4);
  if (start !== null) return start;
  const signature = deps.signature;
  if (signature.declaration !== null && signature.declaration !== input.execution.request.definition) {
    throw new TypeError("A declared summary uses its actual selected declaration signature");
  }
  let fixed = 0;
  let minimum = 0;
  for (let position = 0; position < signature.parameters.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const parameter = signature.parameters[position];
    if (parameter === undefined) throw new TypeError("A declared summary requires the complete selected formal inventory");
    if (parameter.kind === "rest") continue;
    fixed += 1;
    if (!parameter.acceptsOmission) minimum = fixed;
  }
  const provided = input.execution.provided;
  if (!validOrdinal(provided) || provided < minimum || provided > fixed || deps.parameters.length !== signature.parameters.length) {
    throw new TypeError("A declared summary uses an admissible provided-count entry and complete parameter transport");
  }
  let supplied = 0;
  for (let position = 0; position < deps.parameters.length; position += 1) {
    const read = chargeWork(account, 2);
    if (read !== null) return read;
    const mapping = deps.parameters[position];
    const parameter = signature.parameters[position];
    if (mapping === undefined || parameter === undefined || mapping.parameter !== position) {
      throw new TypeError("A declared summary retains its ordered parameter mapping");
    }
    switch (mapping.kind) {
      case "argument":
        if (!validOrdinal(mapping.argument) || position >= provided || mapping.passing !== parameter.passing
          || mapping.component !== null && !validOrdinal(mapping.component) || parameter.kind === "rest") {
          throw new TypeError("A supplied fixed parameter retains its actual passing mode and argument");
        }
        supplied += 1;
        break;
      case "default":
        if (parameter.initializer !== mapping.initializer || parameter.kind !== "default" || !parameter.acceptsOmission || position < provided) {
          throw new TypeError("A default parameter retains its actual selected initializer");
        }
        break;
      case "omitted":
        if (!parameter.acceptsOmission || parameter.kind === "default" || parameter.kind === "rest" || position < provided || mapping.type !== parameter.type) {
          throw new TypeError("An omitted parameter retains its actual omission capability");
        }
        break;
      case "rest":
        if (parameter.kind !== "rest" || mapping.passing !== parameter.passing) {
          throw new TypeError("A rest parameter retains its actual passing mode");
        }
        for (let index = 0; index < mapping.arguments.length; index += 1) {
          const read = chargeWork(account, 1);
          if (read !== null) return read;
          const argument = mapping.arguments[index];
          if (argument === undefined || !validOrdinal(argument)) throw new TypeError("A rest mapping retains actual supplied argument positions");
        }
        break;
    }
  }
  if (supplied !== provided) throw new TypeError("Every supplied fixed entry has its actual parameter transport");
  return null;
}

function failure(request: string): Result<Summary> {
  const rendered = "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID";
  const diagnostic: Diagnostic = { code: { kind: "host", name: hostDiagnosticCode(rendered), rendered }, severity: "error",
    site: { kind: "none" }, source: "summaries", evidence: [request],
    message: "The admitted native guarantee has no exact selected declaration, endpoint and signature association.",
    arguments: [], related: [], fix: null };
  return { kind: "refused", diagnostics: [diagnostic] };
}

export const bindDeclaredSummary: BindDeclaredSummary = (account, deps, input) => {
  const selection = validateSelection(account, deps, input);
  if (selection !== null) return selection;
  if (input.kind === "unknown") {
    const summary = unknownDeclaredSummary(account, deps, input);
    return summary.kind === "complete" ? { kind: "complete", value: { kind: "ok", value: summary.value, diagnostics: [] } } : summary;
  }
  const setup = admitSummaryIdentity({ kind: "declared", execution: input.execution }, account)
    ?? admitNativeIdentity(account, input.guarantee.statement.identity) ?? chargeResultEntries(account, 4);
  if (setup !== null) return setup;
  const associated = new Map<string, NativeExportAssociation | null>();
  const request = signatureRequestKey(input.execution.request);
  const guarantee = libraryExportKey(input.guarantee.statement.identity);
  const refused = (): DataflowResult<Result<Summary>> => chargeResultEntries(account, 9) ?? { kind: "complete", value: failure(request) };
  let selectedAssociation: Extract<NativeExportAssociation, { readonly kind: "callable" }> | null = null;
  for (let position = 0; position < input.associations.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const association = input.associations[position];
    if (association === undefined) return refused();
    const identity = admitNativeIdentity(account, association.identity);
    if (identity !== null) return identity;
    const key = libraryExportKey(association.identity);
    const duplicate = associated.has(key);
    const retain = duplicate ? null : chargeResultEntries(account, 1);
    if (retain !== null) return retain;
    associated.set(key, duplicate ? null : association);
    if (association.kind !== "callable") continue;
    if (association.guarantee === undefined)
      throw new TypeError("A native callable association requires ready canonical guarantee-origin evidence");
    const qualified = chargeWork(account, association.request.definition.length) ?? admitArtifactIdentity(association.request.bindings, account);
    if (qualified !== null) return qualified;
    if (signatureRequestKey(association.request) !== request) continue;
    if (association.guarantee === null) return refused();
    const claimed = admitNativeIdentity(account, association.guarantee);
    if (claimed !== null) return claimed;
    if (libraryExportKey(association.guarantee) !== guarantee || association.signature.id !== deps.signature.id) return refused();
    if (key === guarantee) selectedAssociation = association;
  }
  const values = new Map<string, ExportValue | null>();
  const environments = new Map<string, number>();
  const members = new Map<string, number>();
  const token = (index: Map<string, number>, key: string): number | DataflowStop => {
    const previous = index.get(key);
    if (previous !== undefined) return previous;
    const retain = chargeResultEntries(account, 1);
    if (retain !== null) return retain;
    const result = index.size;
    index.set(key, result);
    return result;
  };
  const lookup = (identity: NativeExportAssociation["identity"]): ExportValue | null | DataflowStop => {
    const admitted = admitNativeIdentity(account, identity);
    if (admitted !== null) return admitted;
    const key = libraryExportKey(identity);
    const previous = values.get(key);
    if (previous !== undefined) return previous;
    const association = associated.get(key);
    const keep = chargeResultEntries(account, 1);
    if (keep !== null) return keep;
    if (association === undefined || association === null
      || (identity.memberId !== null) !== (association.member !== null)) {
      values.set(key, null);
      return null;
    }
    const bindings = association.kind === "noncallable" ? association.bindings : declaredScopeBindings(account, association.request, association.scope);
    if ("kind" in bindings) return bindings;
    const admission = admitBindingIdentity(bindings, account) ?? chargeResultEntries(account, 2);
    if (admission !== null) return admission;
    const environment = token(environments, bindingVectorKey(bindings));
    if (typeof environment !== "number") return environment;
    let member: ExportValue["member"] = null;
    if (association.member !== null) {
      const admitted = admitSelectionIdentity(association.member, account) ?? chargeResultEntries(account, 1);
      if (admitted !== null) return admitted;
      const id = token(members, encodeKey(memberSelectionKey(association.member)));
      if (typeof id !== "number") return id;
      member = { value: association.member, token: id };
    }
    const result: ExportValue = { association, environment: { value: bindings, token: environment }, member };
    values.set(key, result);
    return result;
  };
  const selected = lookup(input.guarantee.statement.identity);
  if (selected !== null && "kind" in selected) return selected;
  if (selected === null || selectedAssociation === null || selected.association !== selectedAssociation
    || selectedAssociation.request.definition !== input.guarantee.declaration
    || selectedAssociation.signature.declaration !== null
      && selectedAssociation.signature.declaration !== input.execution.request.definition) return refused();
  const cells = admitSummaryIdentity({ kind: "declared", execution: input.cells.execution }, account)
    ?? admitNativeIdentity(account, input.cells.origin);
  if (cells !== null) return cells;
  if (input.cells.execution.provided !== input.execution.provided || signatureRequestKey(input.cells.execution.request) !== request
    || libraryExportKey(input.cells.origin) !== guarantee)
    throw new TypeError("Native cells retain the same complete selected execution and admitted guarantee origin");
  const summary = translateNativeSummary(account, input.guarantee.statement, selected, deps.signature, input.execution,
    deps.source, input.cells, input.relations, lookup);
  if (summary !== null && "kind" in summary) return summary;
  return summary === null ? refused() : { kind: "complete", value: { kind: "ok", value: summary, diagnostics: [] } };
};
