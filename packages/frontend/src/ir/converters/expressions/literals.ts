/**
 * Literal expression converters.
 */

import { getTstsNodeText, TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { IrLiteralExpression, IrNewExpression, IrType } from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { inferNumericKindFromRaw } from "../../types/numeric-helpers.js";
import { NumericKind } from "../../types/numeric-kind.js";
import type { ProgramContext } from "../../program-context.js";
import { resolveAmbientGlobalSourceOwnerByName } from "./ambient-global-source-owner.js";
import { buildSourceBackedConstructorParameterTypes } from "./calls/source-backed-constructor-metadata.js";

const deriveTypeFromNumericIntent = (numericIntent: NumericKind): IrType => {
  if (numericIntent === "int32") {
    return { kind: "primitiveType", name: "int" };
  } else if (numericIntent === "float64") {
    return { kind: "primitiveType", name: "number" };
  } else if (numericIntent === "int64") {
    return { kind: "referenceType", name: "long" };
  } else if (numericIntent === "float32") {
    return { kind: "referenceType", name: "float" };
  } else if (numericIntent === "uint8") {
    return { kind: "referenceType", name: "byte" };
  } else if (numericIntent === "int16") {
    return { kind: "referenceType", name: "short" };
  } else if (numericIntent === "uint32") {
    return { kind: "referenceType", name: "uint" };
  } else if (numericIntent === "uint64") {
    return { kind: "referenceType", name: "ulong" };
  } else if (numericIntent === "uint16") {
    return { kind: "referenceType", name: "ushort" };
  } else if (numericIntent === "int8") {
    return { kind: "referenceType", name: "sbyte" };
  }
  return { kind: "primitiveType", name: "number" };
};

export const convertLiteral = (
  node: TstsNode,
  _ctx: ProgramContext
): IrLiteralExpression => {
  const raw = getTstsNodeText(node) ?? "";
  const value =
    node.Kind === TstsSyntax.KindStringLiteral
      ? raw
      : node.Kind === TstsSyntax.KindBigIntLiteral
        ? BigInt(raw.slice(0, -1).replace(/_/g, ""))
        : Number(raw);

  const numericIntent =
    typeof value === "number" ? inferNumericKindFromRaw(raw) : undefined;

  const inferredType: IrType | undefined =
    typeof value === "string"
      ? { kind: "primitiveType", name: "string" }
      : typeof value === "bigint"
        ? { kind: "primitiveType", name: "bigint" }
        : numericIntent
          ? deriveTypeFromNumericIntent(numericIntent)
          : undefined;

  return {
    kind: "literal",
    value,
    raw,
    inferredType,
    sourceSpan: getSourceSpan(node),
    numericIntent,
  };
};

const splitRegularExpressionLiteral = (
  raw: string
): { readonly pattern: string; readonly flags: string } => {
  let closingSlash = -1;

  for (let index = raw.length - 1; index > 0; index--) {
    if (raw[index] !== "/") continue;

    let backslashCount = 0;
    for (let j = index - 1; j > 0 && raw[j] === "\\"; j--) {
      backslashCount++;
    }

    if (backslashCount % 2 === 0) {
      closingSlash = index;
      break;
    }
  }

  if (closingSlash <= 0) {
    return { pattern: raw, flags: "" };
  }

  return {
    pattern: raw.slice(1, closingSlash),
    flags: raw.slice(closingSlash + 1),
  };
};

export const convertRegularExpressionLiteral = (
  node: TstsNode,
  ctx: ProgramContext
): IrNewExpression => {
  const raw = getTstsNodeText(node) ?? "";
  const { pattern, flags } = splitRegularExpressionLiteral(raw);
  const regExpBinding = ctx.bindings.getBinding("RegExp");
  const providerQualifiedName =
    regExpBinding && regExpBinding.kind === "global"
      ? regExpBinding.type
      : (resolveAmbientGlobalSourceOwnerByName("RegExp", node, ctx) ??
        undefined);
  const providerOwnerIdentity =
    regExpBinding && regExpBinding.kind === "global"
      ? regExpBinding.ownerIdentity
      : undefined;

  const args: IrNewExpression["arguments"][number][] = [
    {
      kind: "literal",
      value: pattern,
      raw: JSON.stringify(pattern),
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    },
  ];

  if (flags !== "") {
    args.push({
      kind: "literal",
      value: flags,
      raw: JSON.stringify(flags),
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    });
  }

  const inferredType: IrType = {
    kind: "referenceType",
    name: "RegExp",
    providerQualifiedName,
  };
  const sourceBackedConstructorParameterTypes =
    buildSourceBackedConstructorParameterTypes({
      sourceNode: node,
      callee: {
        kind: "identifier",
        name: "RegExp",
        inferredType,
        providerQualifiedName,
        providerOwnerIdentity,
        sourceSpan: getSourceSpan(node),
      },
      constructedType: inferredType,
      argumentCount: args.length,
      actualArgTypes: args.map((arg) => arg.inferredType),
      ctx,
    });

  return {
    kind: "new",
    callee: {
      kind: "identifier",
      name: "RegExp",
      inferredType,
      providerQualifiedName,
      providerOwnerIdentity,
      sourceSpan: getSourceSpan(node),
    },
    arguments: args,
    inferredType,
    parameterTypes: sourceBackedConstructorParameterTypes?.parameterTypes,
    surfaceParameterTypes:
      sourceBackedConstructorParameterTypes?.surfaceParameterTypes,
    sourceBackedParameterTypes:
      sourceBackedConstructorParameterTypes?.parameterTypes,
    sourceBackedSurfaceParameterTypes:
      sourceBackedConstructorParameterTypes?.surfaceParameterTypes,
    sourceBackedRestParameter:
      sourceBackedConstructorParameterTypes?.restParameter,
    sourceBackedReturnType: inferredType,
    surfaceRestParameter: sourceBackedConstructorParameterTypes?.restParameter,
    sourceSpan: getSourceSpan(node),
  };
};
