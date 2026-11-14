import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import type { BindingVector } from "../ir-types/contract.js";
import { bindingVectorKey, rigidBindings, signatureRequestKey } from "../ir-types/index.js";
import type { Summary } from "../ir-facts/contract.js";
import { memberSelectionKey } from "../ir-tir/index.js";
import { libraryExportKey } from "../libraries/index.js";
import type { NativeExportAssociation } from "../libraries/contract.js";
import type { BindDeclaredSummary, DeclaredSummaryDeps, DeclaredSummaryInput } from "./contract.js";
import type { ExportValue } from "./translate-native.js";
import { translateNativeSummary } from "./translate-native.js";
import { unknownDeclaredSummary } from "./unknown-declared.js";

function validOrdinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function validateSelection(deps: DeclaredSummaryDeps, input: DeclaredSummaryInput): void {
  const signature = deps.signature;
  if (signature.declaration !== null && signature.declaration !== input.execution.request.definition) {
    throw new TypeError("A declared summary uses its actual selected declaration signature");
  }
  let fixed = 0;
  let minimum = 0;
  for (const parameter of signature.parameters) {
    if (parameter.kind === "rest") continue;
    fixed += 1;
    if (parameter.kind === "required" && parameter.initializer === null) minimum = fixed;
  }
  const provided = input.execution.provided;
  if (!validOrdinal(provided) || provided < minimum || provided > fixed || deps.parameters.length !== signature.parameters.length) {
    throw new TypeError("A declared summary uses an admissible provided-count entry and complete parameter transport");
  }
  const supplied = new Set<number>();
  for (let position = 0; position < deps.parameters.length; position += 1) {
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
        supplied.add(position);
        break;
      case "default":
        if (parameter.initializer !== mapping.initializer || parameter.kind !== "default" || position < provided) {
          throw new TypeError("A default parameter retains its actual selected initializer");
        }
        break;
      case "omitted":
        if (parameter.kind !== "optional" || position < provided || mapping.type !== parameter.type) {
          throw new TypeError("An omitted parameter retains its actual optional declaration");
        }
        break;
      case "rest":
        if (parameter.kind !== "rest" || mapping.passing !== parameter.passing) {
          throw new TypeError("A rest parameter retains its actual passing mode");
        }
        for (const argument of mapping.arguments) if (!validOrdinal(argument)) {
          throw new TypeError("A rest mapping retains actual supplied argument positions");
        }
        break;
    }
  }
  for (let position = 0; position < provided; position += 1) if (!supplied.has(position)) {
    throw new TypeError("Every supplied fixed entry has its actual parameter transport");
  }
}

function failure(input: DeclaredSummaryInput): Result<Summary> {
  const rendered = "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID";
  const diagnostic: Diagnostic = { code: { kind: "host", name: hostDiagnosticCode(rendered), rendered }, severity: "error",
    site: { kind: "none" }, source: "summaries", evidence: [signatureRequestKey(input.execution.request)],
    message: "The admitted native guarantee has no exact selected declaration, endpoint and signature association.",
    arguments: [], related: [], fix: null };
  return { kind: "refused", diagnostics: [diagnostic] };
}

export const bindDeclaredSummary: BindDeclaredSummary = (deps, input) => {
  validateSelection(deps, input);
  if (input.kind === "unknown") return { kind: "ok", value: unknownDeclaredSummary(deps, input), diagnostics: [] };
  const associated = new Map<string, NativeExportAssociation | null>();
  for (const association of input.associations) {
    const key = libraryExportKey(association.identity);
    associated.set(key, associated.has(key) ? null : association);
  }
  const values = new Map<string, ExportValue | null>();
  const environments = new Map<string, number>();
  const members = new Map<string, number>();
  const token = (index: Map<string, number>, key: string): number => {
    const previous = index.get(key);
    if (previous !== undefined) return previous;
    const result = index.size;
    index.set(key, result);
    return result;
  };
  const lookup = (identity: NativeExportAssociation["identity"]): ExportValue | null => {
    const key = libraryExportKey(identity);
    const previous = values.get(key);
    if (previous !== undefined) return previous;
    const association = associated.get(key);
    if (association === undefined || association === null
      || (identity.memberId !== null) !== (association.member !== null)) {
      values.set(key, null);
      return null;
    }
    const bindings: BindingVector = association.kind === "noncallable" ? association.bindings
      : association.request.bindings.kind === "instantiated" ? association.request.bindings.bindings : rigidBindings(association.scope);
    const result: ExportValue = { association,
      environment: { value: bindings, token: token(environments, bindingVectorKey(bindings)) },
      member: association.member === null ? null
        : { value: association.member, token: token(members, encodeKey(memberSelectionKey(association.member))) } };
    values.set(key, result);
    return result;
  };
  const selected = lookup(input.guarantee.statement.identity);
  if (selected === null || selected.association.kind !== "callable"
    || selected.association.guarantee === null
    || libraryExportKey(selected.association.guarantee) !== libraryExportKey(input.guarantee.statement.identity)
    || selected.association.request.definition !== input.guarantee.declaration
    || signatureRequestKey(selected.association.request) !== signatureRequestKey(input.execution.request)
    || selected.association.signature.id !== deps.signature.id
    || selected.association.signature.declaration !== null
      && selected.association.signature.declaration !== input.execution.request.definition) return failure(input);
  const summary = translateNativeSummary(input.guarantee.statement, selected, deps.signature, input.execution, lookup);
  return summary === null ? failure(input) : { kind: "ok", value: summary, diagnostics: [] };
};
