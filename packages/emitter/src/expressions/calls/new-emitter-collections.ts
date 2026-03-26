import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  clrTypeNameToTypeAst,
  extractCalleeNameFromAst,
  normalizeClrQualifiedName,
} from "../../core/format/backend-ast/utils.js";
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
    "Uint8Array",
    makeClrValueArrayType("byte", "System.Byte", "Byte"),
  ],
  [
    "Uint8ClampedArray",
    makeClrValueArrayType("byte", "System.Byte", "Byte"),
  ],
  [
    "Int8Array",
    makeClrValueArrayType("sbyte", "System.SByte", "SByte"),
  ],
  [
    "Int16Array",
    makeClrValueArrayType("short", "System.Int16", "Int16"),
  ],
  [
    "Uint16Array",
    makeClrValueArrayType("ushort", "System.UInt16", "UInt16"),
  ],
  [
    "Int32Array",
    makeClrValueArrayType("int", "System.Int32", "Int32"),
  ],
  [
    "Uint32Array",
    makeClrValueArrayType("uint", "System.UInt32", "UInt32"),
  ],
  [
    "Float32Array",
    makeClrValueArrayType("float", "System.Single", "Single"),
  ],
  [
    "Float64Array",
    makeClrValueArrayType("double", "System.Double", "Double"),
  ],
]);

const typedArrayNumericLengthClrNames = new Set([
  ...typedArrayArgumentTypes.keys(),
  "ArrayBuffer",
]);

const isQualifiedConstructorIdentity = (
  name: string | undefined
): name is string => {
  if (!name) {
    return false;
  }

  const trimmed = name.trim();
  return (
    trimmed.startsWith("global::") ||
    trimmed.includes(".") ||
    trimmed.includes("+")
  );
};

const INT_IR_TYPE: IrType = {
  kind: "primitiveType",
  name: "int",
};

const getConstructorKey = (
  expr: Extract<IrExpression, { kind: "new" }>
): string | undefined => {
  const calleeKey =
    expr.callee.kind === "identifier"
      ? (expr.callee.name ?? expr.callee.resolvedClrType)
      : undefined;
  if (calleeKey) {
    return calleeKey;
  }

  const inferredType = expr.inferredType;
  if (!inferredType || inferredType.kind !== "referenceType") {
    return undefined;
  }

  const referenceType = inferredType as Extract<IrType, { kind: "referenceType" }>;
  return (
    referenceType.name ??
    referenceType.resolvedClrType ??
    referenceType.typeId?.tsName ??
    referenceType.typeId?.clrName
  );
};

const getConstructorGlobalTypeName = (
  expr: Extract<IrExpression, { kind: "new" }>
): string | undefined => {
  const key = getConstructorKey(expr);
  if (!isQualifiedConstructorIdentity(key)) return undefined;
  const leaf = key.split(".").pop();
  return leaf ? normalizeClrQualifiedName(leaf, true) : undefined;
};

const getConstructorTypeAst = (
  expr: Extract<IrExpression, { kind: "new" }>,
  calleeAst: CSharpExpressionAst
): CSharpTypeAst => {
  if (calleeAst.kind === "typeReferenceExpression") {
    return calleeAst.type;
  }

  const globalTypeName = getConstructorGlobalTypeName(expr);
  if (globalTypeName) {
    return clrTypeNameToTypeAst(globalTypeName);
  }

  return identifierType(extractCalleeNameFromAst(calleeAst));
};

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

  const key = getConstructorKey(expr);
  return key !== undefined && typedArrayArgumentTypes.has(key.split(".").pop() ?? key);
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
  const typeAst = getConstructorTypeAst(expr, calleeAst);

  const key = getConstructorKey(expr)?.split(".").pop();
  const argumentType =
    (key ? typedArrayArgumentTypes.get(key) : undefined) ??
    typedArrayArgumentTypes.get("Uint8Array");
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

  const key = getConstructorKey(expr)?.split(".").pop();
  if (!key || !typedArrayNumericLengthClrNames.has(key)) {
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
  const typeAst = getConstructorTypeAst(expr, calleeAst);

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
