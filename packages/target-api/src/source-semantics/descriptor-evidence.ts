import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../host-input/identities.js";
import { sourceFiniteLiteralDomain, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import type {
  SourceCategoryDomain, SourceNumericOrigin, SourceSumApplication, SourceTypeDescriptor,
  SourceTypeEvidence,
} from "../public/source/contracts.js";
import type { SourceEvidenceComponent } from "./descriptor-contracts.js";
import type { SourceComponentOwner } from "./descriptor-components.js";

export interface SourceEvidenceRecord {
  readonly value: SourceTypeEvidence;
  readonly components: ReadonlyMap<string, SourceEvidenceComponent>;
  readonly original: SourceInputComponent | undefined;
  readonly domain: SourceLiteralDomain;
}

export interface SourceEvidenceOwner {
  assert(value: SourceTypeEvidence): void;
  record(value: SourceTypeEvidence): SourceEvidenceRecord;
  create(value: SourceTypeEvidence, children: readonly SourceEvidenceComponent[], original: SourceInputComponent | undefined, domain: SourceLiteralDomain): SourceTypeEvidence;
  category(value: SourceCategoryDomain): SourceCategoryDomain;
  categoryKey(value: SourceCategoryDomain): string;
}

export function createSourceEvidenceOwner(input: {
  components: SourceComponentOwner;
  assertNode(node: Node): void;
  assertDescriptor(value: SourceTypeDescriptor): void;
  assertOriginal(value: SourceInputComponent): void;
  assertSum(value: SourceSumApplication): void;
}): SourceEvidenceOwner {
  const records = new WeakMap<SourceTypeEvidence, SourceEvidenceRecord>();
  const categories = new Map<string, SourceCategoryDomain>();

  function categoryKey(value: SourceCategoryDomain): string {
    switch (value.kind) {
      case "known": return JSON.stringify([value.kind, value.category]);
      case "dynamic": return value.kind;
      case "parameter": {
        input.assertNode(value.declaration);
        return JSON.stringify([value.kind, input.components.objectKey(value.declaration)]);
      }
      case "choice": return JSON.stringify([value.kind, value.alternatives.map(categoryKey)]);
    }
  }

  function category(value: SourceCategoryDomain): SourceCategoryDomain {
    const key = categoryKey(value);
    const previous = categories.get(key);
    if (previous !== undefined) return previous;
    const selected = value.kind === "choice"
      ? Object.freeze({ kind: "choice" as const, alternatives: Object.freeze(value.alternatives.map(category)) })
      : Object.freeze({ ...value });
    categories.set(key, selected);
    return selected;
  }

  function record(value: SourceTypeEvidence): SourceEvidenceRecord {
    const selected = records.get(value);
    if (selected === undefined) throw new Error("Source type evidence must belong to this exact descriptor view.");
    return selected;
  }

  function numeric(value: SourceNumericOrigin | undefined): SourceNumericOrigin | undefined {
    if (value === undefined) return undefined;
    input.assertNode(value.producer);
    return Object.freeze({ ...value, category: category(value.category) });
  }

  function create(value: SourceTypeEvidence, children: readonly SourceEvidenceComponent[], original: SourceInputComponent | undefined, domain: SourceLiteralDomain): SourceTypeEvidence {
    input.assertDescriptor(value.type);
    input.components.assert(value.component);
    if (original !== undefined) input.assertOriginal(original);
    if (value.sum !== undefined) input.assertSum(value.sum);
    const selectedCategory = category(value.category);
    const selectedNumeric = numeric(value.numeric);
    if (domain.kind === "finite") for (const unit of domain.values) {
      if (unit.kind === "symbol") input.assertNode(unit.declaration);
    }
    const selectedDomain = domain.kind === "finite" ? sourceFiniteLiteralDomain(domain.values) : Object.freeze({ ...domain });
    const entries = new Map<string, SourceEvidenceComponent>();
    for (const child of children) {
      record(child.value);
      const selectorKey = input.components.selectorKey(child.selector);
      const previous = entries.get(selectorKey);
      if (previous !== undefined && previous.value !== child.value) throw new Error("A Source evidence component requires one exact published child.");
      const childComponent = input.components.identity(value.component.root, [...value.component.path, child.selector]);
      entries.set(selectorKey, Object.freeze({ selector: childComponent.path[childComponent.path.length - 1]!, value: child.value }));
    }
    const selected: SourceTypeEvidence = Object.freeze({ type: value.type, component: value.component,
      category: selectedCategory, numeric: selectedNumeric, sum: value.sum });
    records.set(selected, Object.freeze({ value: selected, components: entries, original, domain: selectedDomain }));
    return selected;
  }

  return Object.freeze({ assert: (value: SourceTypeEvidence): void => { record(value); }, record, create, category, categoryKey });
}
