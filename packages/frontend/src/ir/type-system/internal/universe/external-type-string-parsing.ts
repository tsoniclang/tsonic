/**
 * External Type String Parsing
 *
 * Pure functions for parsing target type strings (from normalized signatures
 * and bindings.json) into IrType nodes.
 */

import type { IrType } from "../../../types/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL TYPE STRING PARSING
// ═══════════════════════════════════════════════════════════════════════════

const SOURCE_PRIMITIVE_NAMES = new Set([
  "string",
  "number",
  "int",
  "boolean",
  "bool",
  "char",
  "null",
  "undefined",
]);

const parseSourceKeywordTypeString = (typeName: string): IrType | undefined => {
  if (typeName === "void") {
    return { kind: "voidType" };
  }

  if (typeName === "bool") {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (SOURCE_PRIMITIVE_NAMES.has(typeName)) {
    switch (typeName) {
      case "string":
      case "number":
      case "int":
      case "boolean":
      case "char":
      case "null":
      case "undefined":
        return { kind: "primitiveType", name: typeName };
    }
  }

  return undefined;
};

const parseSourceWrapperTypeString = (typeName: string): IrType | undefined => {
  switch (typeName) {
    case "String":
      return { kind: "primitiveType", name: "string" };
    case "Number":
      return { kind: "primitiveType", name: "number" };
    case "Boolean":
      return { kind: "primitiveType", name: "boolean" };
    default:
      return undefined;
  }
};

const getProviderSimpleTypeName = (typeName: string): string => {
  const withoutInstantiation = typeName.includes("[[")
    ? (typeName.split("[[")[0] ?? typeName)
    : typeName;
  const lastSeparator = Math.max(
    withoutInstantiation.lastIndexOf("."),
    withoutInstantiation.lastIndexOf("+")
  );
  const simple =
    lastSeparator >= 0
      ? withoutInstantiation.slice(lastSeparator + 1)
      : withoutInstantiation;
  return simple.replace(/`\d+$/, "");
};

/**
 * Parse a target type string from normalized signature into IrType.
 */
export const parseExternalTypeString = (targetType: string): IrType => {
  const sourceKeyword = parseSourceKeywordTypeString(targetType);
  if (sourceKeyword) return sourceKeyword;

  const providerSimpleTypeName = getProviderSimpleTypeName(targetType);
  const sourceWrapper = parseSourceWrapperTypeString(providerSimpleTypeName);
  if (sourceWrapper) return sourceWrapper;

  if (providerSimpleTypeName === "Void") {
    return { kind: "voidType" };
  }

  // Handle array types: T[].
  if (targetType.endsWith("[]")) {
    const elementType = targetType.slice(0, -2);
    return {
      kind: "arrayType",
      elementType: parseExternalTypeString(elementType),
    };
  }

  // Handle pointer types (convert to ref semantics - just use the base type)
  if (targetType.endsWith("*")) {
    return parseExternalTypeString(targetType.slice(0, -1));
  }

  // Handle type parameters (single uppercase letter or common patterns)
  if (/^T\d*$/.test(targetType) || /^T[A-Z][a-zA-Z]*$/.test(targetType)) {
    return { kind: "typeParameterType", name: targetType };
  }

  // Handle tsbindgen-style generic instantiations using underscore arity:
  //   KeyValuePair_2[[TKey,TValue]]
  // This format is used in bindings.json for inheritance type arguments.
  const underscoreInstantiationMatch = targetType.match(
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

    // NOTE: target type strings inside normalized signatures often use assembly-qualified
    // type arguments (commas for provider metadata components).
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
    // and keep the raw provider target string for later resolution.
    const typeArguments: IrType[] | undefined =
      !looksAssemblyQualified && args.length === arity
        ? args.map((arg) => parseExternalTypeString(arg.trim()))
        : undefined;

    return {
      kind: "referenceType",
      name: `${baseName}_${arity}`,
      typeArguments,
      targetQualifiedName: targetType,
    };
  }

  // Handle generic types: Name`N[[TypeArgs]]
  const genericMatch = targetType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
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
        typeArguments.push(parseExternalTypeString(arg.trim()));
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
      targetQualifiedName: targetType,
    };
  }

  // Default: treat as reference type
  return {
    kind: "referenceType",
    name: targetType,
    targetQualifiedName: targetType,
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
