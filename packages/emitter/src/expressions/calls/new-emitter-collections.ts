import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import {
  decimalIntegerLiteral,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

export const isListConstructorWithArrayLiteral = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  const inferredType = expr.inferredType;
  if (inferredType?.kind !== "referenceType") {
    return false;
  }
  const typeId = inferredType.typeId;
  if (
    !typeId ||
    !typeId.clrName.startsWith("System.Collections.Generic.List")
  ) {
    return false;
  }

  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  if (expr.callee.kind !== "identifier" || expr.callee.name !== "List") {
    return false;
  }

  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread" || arg.kind !== "array") {
    return false;
  }

  for (const element of arg.elements) {
    if (!element || element.kind === "spread") {
      return false;
    }
  }

  return true;
};

export const emitListCollectionInitializer = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext,
  emitFallback: (
    expr: Extract<IrExpression, { kind: "new" }>,
    context: EmitterContext
  ) => [CSharpExpressionAst, EmitterContext]
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const [calleeAst, calleeContext] = emitExpressionAst(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;
  let calleeText = extractCalleeNameFromAst(calleeAst);

  let typeArgAsts: readonly CSharpTypeAst[] = [];
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const arrayLiteral = expr.arguments[0] as Extract<
    IrExpression,
    { kind: "array" }
  >;

  const elemAsts: CSharpExpressionAst[] = [];
  for (const element of arrayLiteral.elements) {
    if (element === undefined) {
      continue;
    }
    if (element.kind === "spread") {
      return emitFallback(expr, currentContext);
    }

    const [elemAst, ctx] = emitExpressionAst(element, currentContext);
    elemAsts.push(elemAst);
    currentContext = ctx;
  }

  const typeAst: CSharpTypeAst =
    typeArgAsts.length > 0
      ? identifierType(calleeText, typeArgAsts)
      : identifierType(calleeText);

  return [
    {
      kind: "objectCreationExpression",
      type: typeAst,
      arguments: [],
      initializer: elemAsts.length > 0 ? elemAsts : undefined,
    },
    currentContext,
  ];
};

export const isArrayConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "Array") {
    return false;
  }

  return !!expr.typeArguments && expr.typeArguments.length === 1;
};

const makeClrValueArrayType = (
  name:
    | "byte"
    | "sbyte"
    | "short"
    | "ushort"
    | "int"
    | "uint"
    | "float"
    | "double",
  clrName: string,
  tsName: string
): IrType => ({
  kind: "arrayType",
  elementType: {
    kind: "referenceType",
    name,
    typeId: {
      stableId: `System.Private.CoreLib:${clrName}`,
      clrName,
      assemblyName: "System.Private.CoreLib",
      tsName,
    },
  },
  origin: "explicit",
});

const typedArrayArgumentTypes = new Map<string, IrType>([
  [
    "Tsonic.JSRuntime.Uint8Array",
    makeClrValueArrayType("byte", "System.Byte", "Byte"),
  ],
  [
    "Tsonic.JSRuntime.Uint8ClampedArray",
    makeClrValueArrayType("byte", "System.Byte", "Byte"),
  ],
  [
    "Tsonic.JSRuntime.Int8Array",
    makeClrValueArrayType("sbyte", "System.SByte", "SByte"),
  ],
  [
    "Tsonic.JSRuntime.Int16Array",
    makeClrValueArrayType("short", "System.Int16", "Int16"),
  ],
  [
    "Tsonic.JSRuntime.Uint16Array",
    makeClrValueArrayType("ushort", "System.UInt16", "UInt16"),
  ],
  [
    "Tsonic.JSRuntime.Int32Array",
    makeClrValueArrayType("int", "System.Int32", "Int32"),
  ],
  [
    "Tsonic.JSRuntime.Uint32Array",
    makeClrValueArrayType("uint", "System.UInt32", "UInt32"),
  ],
  [
    "Tsonic.JSRuntime.Float32Array",
    makeClrValueArrayType("float", "System.Single", "Single"),
  ],
  [
    "Tsonic.JSRuntime.Float64Array",
    makeClrValueArrayType("double", "System.Double", "Double"),
  ],
]);

const typedArrayNumericLengthClrNames = new Set([
  ...typedArrayArgumentTypes.keys(),
  "Tsonic.JSRuntime.ArrayBuffer",
]);

const typedArrayConstructorClrNamesByTsName = new Map<string, string>([
  ["Uint8Array", "Tsonic.JSRuntime.Uint8Array"],
  ["Uint8ClampedArray", "Tsonic.JSRuntime.Uint8ClampedArray"],
  ["Int8Array", "Tsonic.JSRuntime.Int8Array"],
  ["Int16Array", "Tsonic.JSRuntime.Int16Array"],
  ["Uint16Array", "Tsonic.JSRuntime.Uint16Array"],
  ["Int32Array", "Tsonic.JSRuntime.Int32Array"],
  ["Uint32Array", "Tsonic.JSRuntime.Uint32Array"],
  ["Float32Array", "Tsonic.JSRuntime.Float32Array"],
  ["Float64Array", "Tsonic.JSRuntime.Float64Array"],
  ["ArrayBuffer", "Tsonic.JSRuntime.ArrayBuffer"],
]);

const INT_IR_TYPE: IrType = {
  kind: "primitiveType",
  name: "int",
};

const getConstructorClrName = (
  expr: Extract<IrExpression, { kind: "new" }>
): string | undefined =>
  (expr.callee.kind === "identifier"
    ? (expr.callee.resolvedClrType ??
      typedArrayConstructorClrNamesByTsName.get(expr.callee.name))
    : undefined) ??
  (expr.inferredType?.kind === "referenceType"
    ? (expr.inferredType.resolvedClrType ?? expr.inferredType.typeId?.clrName)
    : undefined);

export const isUint8ArrayConstructorWithArrayLiteral = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread" || arg.kind !== "array") {
    return false;
  }

  const clrName = getConstructorClrName(expr);
  return clrName !== undefined && typedArrayArgumentTypes.has(clrName);
};

export const emitUint8ArrayArrayLiteralConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const [calleeAst, calleeContext] = emitExpressionAst(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;
  const calleeText = extractCalleeNameFromAst(calleeAst);

  const typeAst: CSharpTypeAst =
    calleeAst.kind === "typeReferenceExpression"
      ? calleeAst.type
      : identifierType(calleeText);

  const clrName = getConstructorClrName(expr);
  const argumentType =
    (clrName ? typedArrayArgumentTypes.get(clrName) : undefined) ??
    typedArrayArgumentTypes.get("Tsonic.JSRuntime.Uint8Array");
  if (!argumentType) {
    throw new Error("ICE: Missing typed array argument type mapping");
  }

  const [argAst, argContext] = emitExpressionAst(
    expr.arguments[0] as Extract<IrExpression, { kind: "array" }>,
    currentContext,
    argumentType
  );
  currentContext = argContext;

  return [
    {
      kind: "objectCreationExpression",
      type: typeAst,
      arguments: [argAst],
    },
    currentContext,
  ];
};

export const isUint8ArrayConstructorWithNumericLength = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread" || arg.kind === "array") {
    return false;
  }

  const clrName = getConstructorClrName(expr);
  if (!clrName || !typedArrayNumericLengthClrNames.has(clrName)) {
    return false;
  }

  const argType = arg.inferredType;
  return (
    (argType?.kind === "primitiveType" &&
      (argType.name === "number" || argType.name === "int")) ||
    (argType?.kind === "literalType" && typeof argType.value === "number") ||
    (argType?.kind === "referenceType" &&
      (argType.name === "int" ||
        argType.name === "double" ||
        argType.resolvedClrType === "System.Int32" ||
        argType.resolvedClrType === "global::System.Int32" ||
        argType.resolvedClrType === "System.Double" ||
        argType.resolvedClrType === "global::System.Double"))
  );
};

export const emitUint8ArrayNumericLengthConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const [calleeAst, calleeContext] = emitExpressionAst(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;
  const calleeText = extractCalleeNameFromAst(calleeAst);

  const typeAst: CSharpTypeAst =
    calleeAst.kind === "typeReferenceExpression"
      ? calleeAst.type
      : identifierType(calleeText);

  const [argAst, argContext] = emitExpressionAst(
    expr.arguments[0] as IrExpression,
    currentContext,
    INT_IR_TYPE
  );
  currentContext = argContext;

  return [
    {
      kind: "objectCreationExpression",
      type: typeAst,
      arguments: [argAst],
    },
    currentContext,
  ];
};

export const emitArrayConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const elementType = expr.typeArguments?.[0];
  if (!elementType) {
    return [
      {
        kind: "arrayCreationExpression",
        elementType: { kind: "predefinedType", keyword: "object" },
        sizeExpression: decimalIntegerLiteral(0),
      },
      currentContext,
    ];
  }

  const [elementTypeAst, typeContext] = emitTypeAst(
    elementType,
    currentContext
  );
  currentContext = typeContext;

  let sizeAstNode: CSharpExpressionAst = decimalIntegerLiteral(0);
  const sizeArg = expr.arguments[0];
  if (sizeArg && sizeArg.kind !== "spread") {
    const [sizeAst, sizeContext] = emitExpressionAst(sizeArg, currentContext);
    sizeAstNode = sizeAst;
    currentContext = sizeContext;
  }

  return [
    {
      kind: "arrayCreationExpression",
      elementType: elementTypeAst,
      sizeExpression: sizeAstNode,
    },
    currentContext,
  ];
};
