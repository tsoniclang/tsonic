/**
 * CLR Type String Parsing
 *
 * Pure functions for parsing CLR type strings (from normalized signatures
 * and bindings.json) into IrType nodes.
 */

import type { IrType } from "../../../types/index.js";

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
