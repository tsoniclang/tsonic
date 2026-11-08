import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../../host-input/descriptor-input.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceCategoryDomain, SourceRefusal, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder, SourceDescriptorReader } from "../descriptor-contracts.js";
import type { SourceMemberCorrespondenceProduction } from "../member-correspondence.js";

export interface SourceSemanticProduction {
  readonly ast: AstReader;
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  readonly reader: SourceDescriptorReader;
  readonly objects: SourceMemberCorrespondenceProduction;
}

export interface SourceSyntaxProduction extends SourceSemanticProduction {
  readonly component: SourceInputComponent;
  readonly syntax: Node;
  readonly bindings: readonly SourceTypeBinding[];
}

export function sourceSemanticRefusal(site: Node, message: string, code = "TSONIC_LOCAL_TYPE_UNSUPPORTED"): SourceRefusal {
  return Object.freeze({ kind: "refused", source: "tsonic", code, site, message });
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
