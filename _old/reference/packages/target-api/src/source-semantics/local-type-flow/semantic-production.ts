import type { Node } from "@tsonic/tsts";
import type { SourceCategoryDomain, SourceRefusal, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";



export function sourceSemanticRefusal(site: Node, message: string, code = "TSONIC_LOCAL_TYPE_UNSUPPORTED", related?: Node): SourceRefusal {
  return Object.freeze({ kind: "refused", source: "tsonic", code, site, message, ...(related === undefined ? {} : { related }) });
}

export function sourceCategoryChoice(values: readonly SourceTypeEvidence[]): SourceCategoryDomain {
  const categories = values.map(value => value.category);
  if (categories.length === 1) return categories[0]!;
  return Object.freeze({ kind: "choice", alternatives: Object.freeze(categories) });
}

export function sourceProductionValues<Value>(values: readonly SourceProductionResult<Value>[]): SourceProductionResult<readonly Value[]> {
  const selected: Value[] = [];
  const pending = new Set<Extract<SourceProductionResult<never>, { readonly kind: "pending" }>["dependencies"][number]>();
  for (const value of values) {
    if (value.kind === "refused") return value;
    if (value.kind === "pending") {
      for (const dependency of value.dependencies) pending.add(dependency);
    } else selected.push(value.value);
  }
  return pending.size > 0 ? { kind: "pending", dependencies: Object.freeze([...pending]) }
    : { kind: "resolved", value: Object.freeze(selected) };
}
