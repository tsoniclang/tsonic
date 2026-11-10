import type { Node, ResolvedSourceWellKnownSymbolInfo } from "@tsonic/tsts";
import type { SourcePresence, SourceResult } from "../public/source/contracts.js";

export interface SourcePropertyNameFacts {
  selectedSymbol(node: Node): SourcePresence<{
    readonly declaration: Node;
    readonly wellKnown: SourcePresence<ResolvedSourceWellKnownSymbolInfo["kind"]>;
  }>;
  selectedName(node: Node): SourcePresence<{ readonly name: string; readonly numericIndex: boolean }>;
  eligible(node: Node): SourceResult<{ readonly kind: "eligible" } | { readonly kind: "unproven"; readonly reason: string }>;
}
