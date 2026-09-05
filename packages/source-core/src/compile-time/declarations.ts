import type {
  ProviderExportDeclaration,
  ProviderTypeExpression,
} from "@tsonic/tsts";

export const tsonicCompileTimeProviderNames = Object.freeze({
  valueExport: "comptime",
  conditionExport: "comptimeIf",
  iterationExport: "unroll",
});

export const tsonicCompileTimeSignatureIds = Object.freeze({
  value: "comptime<T>(value)",
  type: "comptime<T>()",
  condition: "comptimeIf(condition)",
  iteration: "unroll<T>(iterable)",
});

export function compileTimeProviderDeclarations(): readonly ProviderExportDeclaration[] {
  const typeParameter = { kind: "type-parameter" as const, name: "T" };
  return [
    {
      id: tsonicCompileTimeProviderNames.valueExport,
      name: tsonicCompileTimeProviderNames.valueExport,
      kind: "function",
      signatures: [
        signature(
          tsonicCompileTimeSignatureIds.value,
          [{ name: "value", type: typeParameter }],
          typeParameter,
          true,
        ),
        signature(
          tsonicCompileTimeSignatureIds.type,
          [],
          typeParameter,
          true,
        ),
      ],
    },
    {
      id: tsonicCompileTimeProviderNames.conditionExport,
      name: tsonicCompileTimeProviderNames.conditionExport,
      kind: "function",
      signatures: [signature(
        tsonicCompileTimeSignatureIds.condition,
        [{ name: "condition", type: { kind: "boolean" } }],
        { kind: "boolean" },
      )],
    },
    {
      id: tsonicCompileTimeProviderNames.iterationExport,
      name: tsonicCompileTimeProviderNames.iterationExport,
      kind: "function",
      signatures: [signature(
        tsonicCompileTimeSignatureIds.iteration,
        [{ name: "iterable", type: typeParameter }],
        typeParameter,
        true,
      )],
    },
  ];
}

function signature(
  id: string,
  parameters: NonNullable<ProviderExportDeclaration["signatures"]>[number]["parameters"],
  returnType: ProviderTypeExpression,
  generic = false,
): NonNullable<ProviderExportDeclaration["signatures"]>[number] {
  return {
    id,
    ...(generic ? { typeParameters: [{ name: "T" }] } : {}),
    parameters,
    returnType,
  };
}
