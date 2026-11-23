import type { DefId, SigId, TyId } from "../ids/contract.js";
import type { ConstValue, SelfBinding, TypeBinding, TypePublication } from "../ir-types/contract.js";

export interface BindingLookup {
  readonly parameterBinding: (value: { readonly kind: "rigid"; readonly parameter: DefId }) => TypeBinding;
  readonly selfBinding: (value: { readonly kind: "rigid"; readonly owner: DefId }) => SelfBinding;
}

export interface TypeReferenceRewrite {
  readonly type: (value: TyId) => TyId;
  readonly signature: (value: SigId) => SigId;
}

export function publicationRewrite(publication: TypePublication): TypeReferenceRewrite & BindingLookup {
  return {
    type: value => issuedMapping(publication.types, value, "type"),
    signature: value => issuedMapping(publication.signatures, value, "signature"),
    parameterBinding: value => value,
    selfBinding: value => value,
  };
}

function issuedMapping<Identity extends number>(values: readonly Identity[], value: number, kind: string): Identity {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`Type publication has no issued ${kind} mapping for ${Object.is(value, -0) ? "-0" : String(value)}`);
  }
  const mapped = values[value];
  if (mapped === undefined) {
    throw new TypeError(`Type publication has no issued ${kind} mapping for ${String(value)}`);
  }
  return mapped;
}

export function rewriteConstant(rewrite: TypeReferenceRewrite, value: ConstValue): ConstValue {
  const type = rewrite.type(value.type);
  switch (value.kind) {
    case "number": return { type, kind: "number", value: value.value };
    case "floating": return { type, kind: "floating", bits: value.bits };
    case "bigint": return { type, kind: "bigint", value: value.value };
    case "string": return { type, kind: "string", value: value.value };
    case "boolean": return { type, kind: "boolean", value: value.value };
    case "absence": return { type, kind: "absence" };
    case "unique-symbol": return { type, kind: "unique-symbol", declaration: value.declaration };
    case "error": return { type, kind: "error" };
  }
}
