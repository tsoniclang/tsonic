import type { Node, ResolvedWellKnownSymbolKind } from "@tsonic/tsts";

export type SourcePropertyName =
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "symbol"; readonly declaration: Node }
  | { readonly kind: "well-known-symbol"; readonly name: ResolvedWellKnownSymbolKind; readonly declaration: Node }
  | { readonly kind: "unproven"; readonly reason: string };
