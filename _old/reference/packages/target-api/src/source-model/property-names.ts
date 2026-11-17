import type { Node, ResolvedSourceWellKnownSymbolInfo } from "@tsonic/tsts";

export type SourcePropertyName =
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "symbol"; readonly declaration: Node }
  | { readonly kind: "well-known-symbol"; readonly name: ResolvedSourceWellKnownSymbolInfo["kind"]; readonly declaration: Node }
  | { readonly kind: "unproven"; readonly reason: string };
