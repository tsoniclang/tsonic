import type { Node } from "@tsonic/tsts";

export type SourceIndexSelection =
  | { readonly kind: "array-element" | "string-character"; readonly declarations: readonly Node[] }
  | { readonly kind: "tuple-element"; readonly index: number; readonly declarations: readonly Node[] }
  | { readonly kind: "index-signature"; readonly declarations: readonly Node[] };
