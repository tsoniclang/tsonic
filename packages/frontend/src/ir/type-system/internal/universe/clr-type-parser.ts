/**
 * CLR Type String Parsing
 *
 * Pure functions for parsing CLR type strings (from normalized signatures
 * and bindings.json) into IrType nodes.
 *
 * Also includes helpers for converting tsbindgen .d.ts TypeNode AST nodes
 * to IrType and computing signature keys for deterministic overload matching.
 */

import * as ts from "typescript";
import type { IrType } from "../../../types/index.js";
import type { TypeId } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// CLR TYPE STRING PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a CLR type string from normalized signature into IrType.
 *
 * Examples:
 * - "System.String" → { kind: "primitiveType", name: "string" }
 * - "System.Int32" → { kind: "primitiveType", name: "int" }
 * - "System.Double" → { kind: "primitiveType", name: "number" }
 * - "System.Boolean" → { kind: "primitiveType", name: "boolean" }
 * - "System.Char" → { kind: "primitiveType", name: "char" }
 * - "System.Void" → { kind: "voidType" }
 * - "System.Object" → { kind: "referenceType", name: "object" }
 * - "T" → { kind: "typeParameterType", name: "T" }
 * - "System.Collections.Generic.List`1[[T]]" → array type or reference
 * - "T[]" → { kind: "arrayType", elementType: ... }
 */
export const parseClrTypeString = (clrType: string): IrType => {
  // Handle void
  if (clrType === "System.Void" || clrType === "void") {
    return { kind: "voidType" };
  }

  // Handle primitive mappings
  const primitiveMap: Record<string, IrType> = {
    "System.String": { kind: "primitiveType", name: "string" },
    string: { kind: "primitiveType", name: "string" },
    "System.Int32": { kind: "primitiveType", name: "int" },
    int: { kind: "primitiveType", name: "int" },
    // Distinct CLR numeric aliases from @tsonic/core
    "System.SByte": { kind: "referenceType", name: "sbyte" },
    sbyte: { kind: "referenceType", name: "sbyte" },
    "System.Byte": { kind: "referenceType", name: "byte" },
    byte: { kind: "referenceType", name: "byte" },
    "System.Int16": { kind: "referenceType", name: "short" },
    short: { kind: "referenceType", name: "short" },
    "System.UInt16": { kind: "referenceType", name: "ushort" },
    ushort: { kind: "referenceType", name: "ushort" },
    "System.UInt32": { kind: "referenceType", name: "uint" },
    uint: { kind: "referenceType", name: "uint" },
    "System.Int64": { kind: "referenceType", name: "long" },
    long: { kind: "referenceType", name: "long" },
    "System.UInt64": { kind: "referenceType", name: "ulong" },
    ulong: { kind: "referenceType", name: "ulong" },
    "System.IntPtr": { kind: "referenceType", name: "nint" },
    nint: { kind: "referenceType", name: "nint" },
    "System.UIntPtr": { kind: "referenceType", name: "nuint" },
    nuint: { kind: "referenceType", name: "nuint" },
    "System.Int128": { kind: "referenceType", name: "int128" },
    int128: { kind: "referenceType", name: "int128" },
    "System.UInt128": { kind: "referenceType", name: "uint128" },
    uint128: { kind: "referenceType", name: "uint128" },
    "System.Double": { kind: "primitiveType", name: "number" },
    double: { kind: "primitiveType", name: "number" },
    "System.Single": { kind: "referenceType", name: "float" },
    float: { kind: "referenceType", name: "float" },
    "System.Half": { kind: "referenceType", name: "half" },
    half: { kind: "referenceType", name: "half" },
    "System.Decimal": { kind: "referenceType", name: "decimal" },
    decimal: { kind: "referenceType", name: "decimal" },
    "System.Boolean": { kind: "primitiveType", name: "boolean" },
    bool: { kind: "primitiveType", name: "boolean" },
    "System.Char": { kind: "primitiveType", name: "char" },
    char: { kind: "primitiveType", name: "char" },
    // System.Object is the CLR "top" reference type. Treat it as C# `object`,
    // not TypeScript `any` (airplane-grade: no implicit "any" in IR).
    "System.Object": { kind: "referenceType", name: "object" },
    object: { kind: "referenceType", name: "object" },
  };

  const primitive = primitiveMap[clrType];
  if (primitive) return primitive;

  // Handle array types: T[] or System.Array`1[[T]]
  if (clrType.endsWith("[]")) {
    const elementType = clrType.slice(0, -2);
    return {
      kind: "arrayType",
      elementType: parseClrTypeString(elementType),
    };
  }

  // Handle pointer types (convert to ref semantics - just use the base type)
  if (clrType.endsWith("*")) {
    return parseClrTypeString(clrType.slice(0, -1));
  }

  // Handle nullable: Nullable<T> or T?
  if (clrType.startsWith("System.Nullable`1")) {
    // Extract inner type
    const innerMatch = clrType.match(/System\.Nullable`1\[\[([^\]]+)\]\]/);
    if (innerMatch && innerMatch[1]) {
      const innerType = parseClrTypeString(innerMatch[1]);
      return {
        kind: "unionType",
        types: [innerType, { kind: "primitiveType", name: "undefined" }],
      };
    }
  }

  // Handle type parameters (single uppercase letter or common patterns)
  if (/^T\d*$/.test(clrType) || /^T[A-Z][a-zA-Z]*$/.test(clrType)) {
    return { kind: "typeParameterType", name: clrType };
  }

  // Handle tsbindgen-style generic instantiations using underscore arity:
  //   KeyValuePair_2[[TKey,TValue]]
  // This format is used in bindings.json for inheritance type arguments.
  const underscoreInstantiationMatch = clrType.match(
    /^(.+?)_(\d+)\[\[(.+)\]\]$/
  );
  if (
    underscoreInstantiationMatch &&
    underscoreInstantiationMatch[1] &&
    underscoreInstantiationMatch[2] &&
    underscoreInstantiationMatch[3]
  ) {
    const baseName = underscoreInstantiationMatch[1];
    const arity = parseInt(underscoreInstantiationMatch[2], 10);
    const typeArgsStr = underscoreInstantiationMatch[3];

    // NOTE: CLR type strings inside normalized signatures often use assembly-qualified
    // type arguments (commas for AssemblyName/Version/Culture/PublicKeyToken).
    // Those commas are not type-argument separators. Only parse `[[...]]` payloads
    // that follow our deterministic tsbindgen encoding for bindings.json heritage
    // (no assembly identity segments).
    //
    // If we mis-parse assembly-qualified args, we break signatureKey matching which
    // hydrates optional/rest flags from tsbindgen .d.ts (airplane-grade determinism).
    const looksAssemblyQualified =
      /\bVersion=|\bCulture=|\bPublicKeyToken=/.test(typeArgsStr);

    const args = looksAssemblyQualified ? [] : splitTypeArguments(typeArgsStr);

    // Airplane-grade safety: only attach parsed typeArguments when we can prove
    // the arity matches. Otherwise, preserve only the generic *definition* arity
    // and keep the raw CLR string for later resolution.
    const typeArguments: IrType[] | undefined =
      !looksAssemblyQualified && args.length === arity
        ? args.map((arg) => parseClrTypeString(arg.trim()))
        : undefined;

    return {
      kind: "referenceType",
      name: `${baseName}_${arity}`,
      typeArguments,
      resolvedClrType: clrType,
    };
  }

  // Handle generic types: Name`N[[TypeArgs]]
  const genericMatch = clrType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = parseInt(genericMatch[2], 10);
    const typeArgsStr = genericMatch[3]; // May be undefined

    // Extract type arguments if present
    const typeArguments: IrType[] = [];
    if (typeArgsStr) {
      // Parse comma-separated type args (this is simplified, may need proper parsing)
      const args = splitTypeArguments(typeArgsStr);
      for (const arg of args) {
        typeArguments.push(parseClrTypeString(arg.trim()));
      }
    } else {
      // Generate placeholder type parameters
      for (let i = 0; i < arity; i++) {
        typeArguments.push({
          kind: "typeParameterType",
          name: i === 0 ? "T" : `T${i + 1}`,
        });
      }
    }

    return {
      kind: "referenceType",
      name: baseName,
      typeArguments: typeArguments.length > 0 ? typeArguments : undefined,
      resolvedClrType: clrType,
    };
  }

  // Default: treat as reference type
  return {
    kind: "referenceType",
    name: clrType,
    resolvedClrType: clrType,
  };
};

/**
 * Split type arguments handling nested brackets.
 */
export const splitTypeArguments = (str: string): string[] => {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of str) {
    if (char === "[") {
      depth++;
      current += char;
    } else if (char === "]") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
};

// ═══════════════════════════════════════════════════════════════════════════
// TSBINDGEN .D.TS TYPE NODE CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

export const INSTANCE_SUFFIX = "$instance";
export const VIEWS_PREFIX = "__";
export const VIEWS_SUFFIX = "$views";

export const stripTsBindgenInstanceSuffix = (name: string): string => {
  return name.endsWith(INSTANCE_SUFFIX)
    ? name.slice(0, -INSTANCE_SUFFIX.length)
    : name;
};

export const stripTsBindgenViewsWrapper = (
  name: string
): string | undefined => {
  if (!name.startsWith(VIEWS_PREFIX)) return undefined;
  if (!name.endsWith(VIEWS_SUFFIX)) return undefined;
  return name.slice(VIEWS_PREFIX.length, -VIEWS_SUFFIX.length);
};

export const getRightmostQualifiedNameText = (name: ts.EntityName): string => {
  if (ts.isIdentifier(name)) return name.text;
  return getRightmostQualifiedNameText(name.right);
};

export const getRightmostPropertyAccessText = (
  expr: ts.Expression
): string | undefined => {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isCallExpression(expr))
    return getRightmostPropertyAccessText(expr.expression);
  if (ts.isParenthesizedExpression(expr))
    return getRightmostPropertyAccessText(expr.expression);
  return undefined;
};

export const dtsTypeNodeToIrType = (
  node: ts.TypeNode,
  inScopeTypeParams: ReadonlySet<string>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>
): IrType => {
  // Parenthesized type
  if (ts.isParenthesizedTypeNode(node)) {
    return dtsTypeNodeToIrType(node.type, inScopeTypeParams, tsNameToTypeId);
  }

  // Type references (including type parameters)
  if (ts.isTypeReferenceNode(node)) {
    const rawName = getRightmostQualifiedNameText(node.typeName);
    const baseName = stripTsBindgenInstanceSuffix(rawName);

    // tsbindgen imports CLR numeric aliases from @tsonic/core as type references.
    // For IR purposes, `int` is a distinct primitive type (not referenceType).
    if (baseName === "int" && !node.typeArguments?.length) {
      return { kind: "primitiveType", name: "int" };
    }

    // Type parameter reference: `T` (no type args) where T is in scope
    if (inScopeTypeParams.has(baseName) && !node.typeArguments?.length) {
      return { kind: "typeParameterType", name: baseName };
    }

    const typeArguments = node.typeArguments?.map((a) =>
      dtsTypeNodeToIrType(a, inScopeTypeParams, tsNameToTypeId)
    );

    const resolvedName =
      typeArguments && typeArguments.length > 0
        ? (() => {
            const arityName = `${baseName}_${typeArguments.length}`;
            return tsNameToTypeId.has(arityName) ? arityName : baseName;
          })()
        : baseName;

    return {
      kind: "referenceType",
      name: resolvedName,
      typeArguments:
        typeArguments && typeArguments.length > 0 ? typeArguments : undefined,
    };
  }

  // Array types
  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "arrayType",
      elementType: dtsTypeNodeToIrType(
        node.elementType,
        inScopeTypeParams,
        tsNameToTypeId
      ),
    };
  }

  // Union / intersection
  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: node.types.map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }
  if (ts.isIntersectionTypeNode(node)) {
    return {
      kind: "intersectionType",
      types: node.types.map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }

  // Literal types
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal;
    if (ts.isStringLiteral(lit))
      return { kind: "literalType", value: lit.text };
    if (ts.isNumericLiteral(lit))
      return { kind: "literalType", value: Number(lit.text) };
    if (lit.kind === ts.SyntaxKind.TrueKeyword)
      return { kind: "literalType", value: true };
    if (lit.kind === ts.SyntaxKind.FalseKeyword)
      return { kind: "literalType", value: false };
  }

  // Keywords
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "anyType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    default:
      return { kind: "unknownType" };
  }
};

export const irTypeToSignatureKey = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return `p:${type.name}`;
    case "literalType":
      return `lit:${JSON.stringify(type.value)}`;
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "unknownType":
      return "unknown";
    case "anyType":
      return "any";
    case "typeParameterType":
      // Canonicalize all type parameters to a stable placeholder so tsbindgen's
      // `TContext` matches metadata's `T0`/`T` deterministically.
      return "T";
    case "arrayType":
      return `${irTypeToSignatureKey(type.elementType)}[]`;
    case "tupleType":
      return `[${type.elementTypes
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .join(",")}]`;
    case "unionType": {
      const parts = type.types
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .sort();
      return `(${parts.join("|")})`;
    }
    case "intersectionType": {
      const parts = type.types
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .sort();
      return `(${parts.join("&")})`;
    }
    case "dictionaryType":
      return `{[${irTypeToSignatureKey(type.keyType)}]:${irTypeToSignatureKey(type.valueType)}}`;
    case "functionType": {
      const params = type.parameters
        .map((p) => (p.type ? irTypeToSignatureKey(p.type) : "unknown"))
        .join(",");
      return `fn(${params})->${irTypeToSignatureKey(type.returnType)}`;
    }
    case "objectType":
      return "object";
    case "referenceType": {
      const raw = type.resolvedClrType ?? type.name;
      const withoutArgs = raw.includes("[[")
        ? (raw.split("[[")[0] ?? raw)
        : raw;
      const lastSep = Math.max(
        withoutArgs.lastIndexOf("."),
        withoutArgs.lastIndexOf("+")
      );
      let simple = lastSep >= 0 ? withoutArgs.slice(lastSep + 1) : withoutArgs;

      // Canonicalize CLR backtick arity: `Action`1` -> `Action_1`.
      const backtickMatch = simple.match(/`(\d+)$/);
      if (backtickMatch && backtickMatch[1]) {
        simple = `${simple.slice(0, -backtickMatch[0].length)}_${backtickMatch[1]}`;
      }

      const underscoreMatch = simple.match(/_(\d+)$/);
      const arity =
        underscoreMatch && underscoreMatch[1]
          ? Number(underscoreMatch[1])
          : undefined;
      const argCount = type.typeArguments?.length ?? arity ?? 0;

      // Signature matching is used only to hydrate optional/rest flags from tsbindgen .d.ts
      // into CLR metadata signatures. To keep matching robust across:
      // - CLR names vs TS names
      // - generic instantiation encodings (Action_1[[...]] vs Action_1<T>)
      // we intentionally ignore concrete type argument *identities* and retain only arity.
      if (argCount <= 0) return simple;
      return `${simple}<${Array.from({ length: argCount }, () => "*").join(",")}>`;
    }
    default:
      return "unknown";
  }
};

export const makeMethodSignatureKey = (args: {
  readonly isStatic: boolean;
  readonly name: string;
  readonly typeParamCount: number;
  readonly parameters: readonly {
    readonly type: IrType;
    readonly isRest: boolean;
  }[];
  readonly returnType: IrType;
}): string => {
  const params = args.parameters
    .map((p) => `${p.isRest ? "..." : ""}${irTypeToSignatureKey(p.type)}`)
    .join(",");
  return `${args.isStatic ? "static" : "instance"}|${args.name}|${
    args.typeParamCount
  }|(${params})->${irTypeToSignatureKey(args.returnType)}`;
};
