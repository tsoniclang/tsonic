import type { SourceDeferredProjection, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { produceSourceAwaitedType } from "./awaited.js";
import type { SourceSemanticProduction } from "./semantic-production.js";

export interface SourceProjectionProduction extends SourceSemanticProduction {
  readonly source: SourceTypeEvidence;
  readonly originalSource: SourceTypeEvidence;
  readonly projection: SourceDeferredProjection;
  readonly bindings: readonly SourceTypeBinding[];
}

export function produceSourceProjection(context: SourceProjectionProduction): SourceProductionResult<SourceTypeEvidence> {
  context.builder.assertEvidence(context.source);
  context.builder.assertEvidence(context.originalSource);
  if (context.projection.kind === "awaited") return produceSourceAwaitedType(context, context.source);
  const component = context.projection.component;
  let selected = context.reader.describeSyntax(component.root, context.bindings);
  if (selected.kind !== "resolved") return selected;
  for (const selector of component.path) {
    selected = context.builder.component(selected.value, selector);
    if (selected.kind !== "resolved") return selected;
  }
  return selected;
}
