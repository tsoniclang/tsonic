import type { ProviderExportDeclaration } from "@tsonic/tsts";
import { tsonicFixedArrayProviderIds } from "./provider.js";

export function fixedArrayTypeMarkerDeclaration(
  exportName: string,
): ProviderExportDeclaration {
  const elementType = { kind: "type-parameter" as const, name: "T" };
  return {
    id: exportName,
    name: exportName,
    kind: "interface",
    typeParameters: [
      { name: "T" },
      { name: "TLength", constraints: [{ kind: "union", types: [{ kind: "number" }, { kind: "bigint" }] }] },
    ],
    members: [
      {
        id: tsonicFixedArrayProviderIds.indexMemberId,
        name: "index",
        kind: "indexer",
        signatures: [{
          id: tsonicFixedArrayProviderIds.indexSignatureId,
          parameters: [{ name: "index", type: { kind: "source-primitive", name: "int32" } }],
          returnType: elementType,
        }],
      },
      {
        id: tsonicFixedArrayProviderIds.lengthMemberId,
        name: "length",
        kind: "property",
        readonly: true,
        type: { kind: "source-primitive", name: "int32" },
      },
      {
        id: tsonicFixedArrayProviderIds.iteratorMemberId,
        name: { kind: "well-known-symbol", name: "iterator" },
        kind: "method",
        signatures: [{
          id: tsonicFixedArrayProviderIds.iteratorSignatureId,
          parameters: [],
          returnType: {
            kind: "source-global",
            name: "Iterator",
            typeArguments: [elementType],
          },
        }],
      },
    ],
  };
}
