import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageAnalysisOptions, SourceStorageAnalysisSelection } from "../../source-model/storage.js";
import { createSourceStorageBudget } from "./model/resource-budget.js";
import type { SourceStorageAnalysisInputs, SourceStorageProgram } from "./model/program.js";
import { SourceStorageFailure, sourceStorageOutcome } from "./model/program.js";
import { createSourceStorageProfileEffects } from "./model/global-call-effects.js";
import { createSourceStorageQueries } from "./queries.js";

function dataRecord(value: unknown, keys: readonly string[]): boolean {
  if (value === null || typeof value !== "object") return false;
  const fields = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(fields).length === keys.length && keys.every(key => {
    const field = fields[key];
    return field !== undefined && "value" in field;
  });
}

function denseData(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (field === undefined || !("value" in field)) return false;
  }
  return Reflect.ownKeys(value).length === value.length + 1;
}

export function createSourceStorageAnalysis(source: TargetSourceProgram, inputs: SourceStorageAnalysisInputs,
  options: SourceStorageAnalysisOptions): SourceStorageAnalysisSelection {
  if (!dataRecord(options, ["sourceFiles", "limits", "nativeClassConstructors"]) ||
    !denseData(options.sourceFiles) || !denseData(options.nativeClassConstructors))
    throw new Error("Source storage analysis requires its closed dense data options.");
  const files = [...options.sourceFiles];
  const seen = new Set<unknown>();
  for (const file of files) {
    if (!source.sourceFiles.includes(file) || !source.facts.navigation.includes(file) || seen.has(file))
      throw new Error("Source storage analysis requires unique original source-file identities from the same program.");
    seen.add(file);
  }
  const premises = options.nativeClassConstructors.map(premise => {
    if (!dataRecord(premise, ["binding", "constructors"]) || !denseData(premise.constructors))
      throw new Error("Source native-constructor premises require closed original identity data.");
    source.facts.navigation.callableRoles(premise.binding);
    return Object.freeze({ binding: premise.binding, constructors: Object.freeze([...premise.constructors]) });
  });
  const budget = createSourceStorageBudget(options.limits);
  const failure = budget.failure();
  if (failure !== undefined) return Object.freeze({ kind: "unresolved", reason: failure });
  const analysis: SourceStorageProgram = Object.freeze({
    ast: source.ast,
    sourceFiles: source.sourceFiles,
    documents: source.documents,
    facts: source.facts,
    program: source,
    analysis: inputs,
    work(original: Node | undefined) {
      if (original !== undefined) source.facts.navigation.callableRoles(original);
      if (!budget.step()) throw new SourceStorageFailure(budget.failure()!);
    },
  });
  return sourceStorageOutcome((): SourceStorageAnalysisSelection => {
    const effects = createSourceStorageProfileEffects(analysis, budget, Object.freeze(premises));
    const queries = createSourceStorageQueries(analysis, Object.freeze(files), budget, effects);
    const failure = budget.failure();
    return failure === undefined ? Object.freeze({ kind: "resolved", queries })
      : Object.freeze({ kind: "unresolved", reason: failure });
  })();
}
