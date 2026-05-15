import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../types/emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import {
  clrTypeNameToTypeAst,
  extractCalleeNameFromAst,
  normalizeClrQualifiedName,
} from "../../core/format/backend-ast/utils.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { referenceTypeHasClrIdentity } from "../../core/semantic/clr-type-identity.js";

const TYPED_ARRAY_NUMERIC_LENGTH_CLR_NAMES = new Set([
  "System.Int32",
  "global::System.Int32",
  "System.Double",
  "global::System.Double",
]);

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
  ["Uint8Array", makeClrValueArrayType("byte", "System.Byte", "Byte")],
  ["Uint8ClampedArray", makeClrValueArrayType("byte", "System.Byte", "Byte")],
  ["Int8Array", makeClrValueArrayType("sbyte", "System.SByte", "SByte")],
  ["Int16Array", makeClrValueArrayType("short", "System.Int16", "Int16")],
  ["Uint16Array", makeClrValueArrayType("ushort", "System.UInt16", "UInt16")],
  ["Int32Array", makeClrValueArrayType("int", "System.Int32", "Int32")],
  ["Uint32Array", makeClrValueArrayType("uint", "System.UInt32", "UInt32")],
  ["Float32Array", makeClrValueArrayType("float", "System.Single", "Single")],
  ["Float64Array", makeClrValueArrayType("double", "System.Double", "Double")],
]);

const typedArrayNumericLengthClrNames = new Set([
  ...typedArrayArgumentTypes.keys(),
  "ArrayBuffer",
]);

const getTypedArrayLeafName = (
  type: IrType | undefined
): string | undefined => {
  if (!type || type.kind !== "referenceType") {
    return undefined;
  }

  const candidates = [
    type.resolvedClrType,
    type.typeId?.clrName,
    type.typeId?.tsName,
    type.name,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const leaf = candidate.split(".").pop() ?? candidate;
    if (typedArrayArgumentTypes.has(leaf)) {
      return leaf;
    }
    if (leaf === "ArrayBuffer") {
      return leaf;
    }
  }

  return undefined;
};

const getReferenceTypeIdentity = (
  type: IrType | undefined
): string | undefined => {
  if (!type || type.kind !== "referenceType") {
    return undefined;
  }

  return (
    type.resolvedClrType ??
    type.typeId?.clrName ??
    type.typeId?.tsName ??
    type.name
  );
};

export const getTypedArrayStorageElementType = (
  type: IrType | undefined
): IrType | undefined => {
  const leaf = getTypedArrayLeafName(type);
  if (!leaf) {
    return undefined;
  }

  const arrayType = typedArrayArgumentTypes.get(leaf);
  return arrayType?.kind === "arrayType" ? arrayType.elementType : undefined;
};

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
  const inferredTypeKey = getReferenceTypeIdentity(expr.inferredType);
  if (inferredTypeKey) {
    return inferredTypeKey;
  }

  const calleeTypeKey = getReferenceTypeIdentity(expr.callee.inferredType);
  if (calleeTypeKey) {
    return calleeTypeKey;
  }

  if (expr.callee.kind === "identifier") {
    return expr.callee.resolvedClrType ?? expr.callee.name;
  }

  return undefined;
};

const getConstructorGlobalTypeName = (
  expr: Extract<IrExpression, { kind: "new" }>
): string | undefined => {
  const key = getConstructorKey(expr);
  if (!isQualifiedConstructorIdentity(key)) return undefined;
  return normalizeClrQualifiedName(key, true);
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
  return (
    key !== undefined &&
    typedArrayArgumentTypes.has(key.split(".").pop() ?? key)
  );
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
        referenceTypeHasClrIdentity(
          argType,
          TYPED_ARRAY_NUMERIC_LENGTH_CLR_NAMES
        )))
  );
};

const isNumericLengthExpression = (expr: IrExpression): boolean => {
  const type = expr.inferredType;
  return (
    (type?.kind === "primitiveType" &&
      (type.name === "number" || type.name === "int")) ||
    (type?.kind === "literalType" && typeof type.value === "number") ||
    (type?.kind === "referenceType" &&
      (type.name === "int" ||
        type.name === "double" ||
        referenceTypeHasClrIdentity(
          type,
          TYPED_ARRAY_NUMERIC_LENGTH_CLR_NAMES
        )))
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

const isJsArrayConstructorIdentity = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "Array") {
    return false;
  }

  const key = getConstructorKey(expr);
  if (!key) {
    return false;
  }

  const normalized = key.replace(/^global::/, "");
  return (
    normalized === "js.Array" ||
    normalized.startsWith("js.Array<") ||
    (normalized === "Array" && expr.inferredType?.kind === "arrayType")
  );
};

export const isJsArrayConstructorWithNumericLength = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (!isJsArrayConstructorIdentity(expr)) {
    return false;
  }

  if (getJsArrayConstructorElementType(expr) === undefined) {
    return false;
  }

  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  return !!arg && arg.kind !== "spread" && isNumericLengthExpression(arg);
};

const getJsArrayConstructorElementType = (
  expr: Extract<IrExpression, { kind: "new" }>
): IrType | undefined => {
  if (expr.inferredType?.kind === "arrayType") {
    return expr.inferredType.elementType;
  }

  return expr.typeArguments?.[0];
};

export const isJsArrayNativeConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean =>
  isJsArrayConstructorIdentity(expr) &&
  getJsArrayConstructorElementType(expr) !== undefined &&
  expr.arguments.every((arg) => arg !== undefined && arg.kind !== "spread");

export const emitJsArrayNativeConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const elementType = getJsArrayConstructorElementType(expr);
  if (!elementType) {
    throw new Error("ICE: JS Array native constructor missing element type");
  }

  const [elementTypeAst, typeContext] = emitTypeAst(elementType, context);
  let currentContext = typeContext;

  if (isJsArrayConstructorWithNumericLength(expr)) {
    const [sizeAst, sizeContext] = emitExpressionAst(
      expr.arguments[0] as IrExpression,
      currentContext,
      INT_IR_TYPE
    );

    return [
      {
        kind: "arrayCreationExpression",
        elementType: elementTypeAst,
        sizeExpression: sizeAst,
      },
      sizeContext,
    ];
  }

  const initializer: CSharpExpressionAst[] = [];
  for (const arg of expr.arguments) {
    const [argAst, argContext] = emitExpressionAst(
      arg as IrExpression,
      currentContext,
      elementType
    );
    initializer.push(argAst);
    currentContext = argContext;
  }

  return [
    {
      kind: "arrayCreationExpression",
      elementType: elementTypeAst,
      initializer: initializer.length > 0 ? initializer : undefined,
    },
    currentContext,
  ];
};
