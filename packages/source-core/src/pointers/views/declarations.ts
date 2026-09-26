import type { ProviderExportDeclaration, ProviderTypeExpression } from "@tsonic/tsts";
import { tsonicCoreTypesModule } from "../../identity.js";

export const tsonicPointerViewSignatureIds = Object.freeze({
  required: "viewptr<F,T>(pointer,read,write)",
  optional: "viewptr<F,T>(pointer?,read,write)",
});

export function pointerViewDeclaration(): ProviderExportDeclaration {
  const source: ProviderTypeExpression = { kind: "type-parameter", name: "F" };
  const target: ProviderTypeExpression = { kind: "type-parameter", name: "T" };
  const pointer = (type: ProviderTypeExpression): ProviderTypeExpression => ({
    kind: "provider-ref", moduleSpecifier: tsonicCoreTypesModule, exportName: "Pointer", typeArguments: [type],
  });
  const optional = (type: ProviderTypeExpression): ProviderTypeExpression => ({ kind: "union", types: [type, { kind: "undefined" }] });
  return {
    id: "viewptr", name: "viewptr", kind: "function",
    signatures: (["required", "optional"] as const).map(kind => ({
      id: tsonicPointerViewSignatureIds[kind], typeParameters: [{ name: "F" }, { name: "T" }],
      parameters: [
        { name: "pointer", type: kind === "optional" ? optional(pointer(source)) : pointer(source) },
        { name: "read", type: { kind: "function", id: `viewptr.${kind}.read`, parameters: [], returnType: target } },
        { name: "write", type: { kind: "function", id: `viewptr.${kind}.write`,
          parameters: [{ name: "value", type: target }], returnType: { kind: "void" } } },
      ],
      returnType: kind === "optional" ? optional(pointer(target)) : pointer(target),
    })),
  };
}
