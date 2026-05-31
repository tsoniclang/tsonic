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

const containsAssemblyQualifier = (tail: string): boolean => {
  const parts = tail
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.some(
    (part) =>
      part.startsWith("Version=") ||
      part.startsWith("Culture=") ||
      part.startsWith("PublicKeyToken=")
  );
};

const stripAssemblyQualification = (typeName: string): string => {
  let depth = 0;
  for (let index = 0; index < typeName.length; index += 1) {
    const char = typeName[index];
    if (char === "[") {
      depth += 1;
      continue;
    }
    if (char === "]") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char !== "," || depth !== 0) {
      continue;
    }

    const tail = typeName.slice(index + 1);
    if (containsAssemblyQualifier(tail)) {
      return typeName.slice(0, index).trim();
    }
  }

  return typeName;
};

const splitBracketDelimitedTypeArguments = (
  typeArgsStr: string
): readonly string[] | undefined => {
  if (!typeArgsStr.includes("],[")) {
    return undefined;
  }

  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (let index = 0; index < typeArgsStr.length; index += 1) {
    if (
      depth === 0 &&
      typeArgsStr[index] === "]" &&
      typeArgsStr[index + 1] === "," &&
      typeArgsStr[index + 2] === "["
    ) {
      result.push(current.trim());
      current = "";
      index += 2;
      continue;
    }

    const char = typeArgsStr[index];
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth = Math.max(0, depth - 1);
    }
    current += char;
  }

  if (current.trim().length > 0) {
    result.push(current.trim());
  }

  return result;
};

const splitExternalTypeArguments = (
  typeArgsStr: string,
  arity: number
): readonly string[] => {
  const bracketDelimited = splitBracketDelimitedTypeArguments(typeArgsStr);
  if (bracketDelimited) {
    return bracketDelimited;
  }

  const commaDelimited = splitTypeArguments(typeArgsStr);
  if (commaDelimited.length === arity) {
    return commaDelimited;
  }

  if (arity === 1 && containsAssemblyQualifier(typeArgsStr)) {
    return [typeArgsStr.trim()];
  }

  return commaDelimited;
};

/**
 * Parse a target type string from normalized signature into IrType.
 */
export const parseExternalTypeString = (targetType: string): IrType => {
  const normalizedTargetType = stripAssemblyQualification(targetType.trim());
  const sourceKeyword = parseSourceKeywordTypeString(normalizedTargetType);
  if (sourceKeyword) return sourceKeyword;

  const providerSimpleTypeName = getProviderSimpleTypeName(
    normalizedTargetType
  );
  const sourceWrapper = parseSourceWrapperTypeString(providerSimpleTypeName);
  if (sourceWrapper) return sourceWrapper;

  if (providerSimpleTypeName === "Void") {
    return { kind: "voidType" };
  }

  // Handle array types: T[].
  if (normalizedTargetType.endsWith("[]")) {
    const elementType = normalizedTargetType.slice(0, -2);
    return {
      kind: "arrayType",
      elementType: parseExternalTypeString(elementType),
    };
  }

  // Handle pointer types (convert to ref semantics - just use the base type)
  if (normalizedTargetType.endsWith("*")) {
    return parseExternalTypeString(normalizedTargetType.slice(0, -1));
  }

  // Handle type parameters (single uppercase letter or common patterns)
  if (
    /^T\d*$/.test(normalizedTargetType) ||
    /^T[A-Z][a-zA-Z]*$/.test(normalizedTargetType)
  ) {
    return { kind: "typeParameterType", name: normalizedTargetType };
  }

  // Handle tsbindgen-style generic instantiations using underscore arity:
  //   KeyValuePair_2[[TKey,TValue]]
  // This format is used in bindings.json for inheritance type arguments.
  const underscoreInstantiationMatch = normalizedTargetType.match(
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

    const args = splitExternalTypeArguments(typeArgsStr, arity);

    // Airplane-grade safety: only attach parsed typeArguments when we can prove
    // the arity matches. Otherwise, preserve only the generic *definition* arity
    // and keep the raw provider target string for later resolution.
    const typeArguments: IrType[] | undefined =
      args.length === arity
        ? args.map((arg) => parseExternalTypeString(arg.trim()))
        : undefined;

    return {
      kind: "referenceType",
      name: getProviderSimpleTypeName(`${baseName}_${arity}`),
      typeArguments,
      providerQualifiedName: targetType,
    };
  }

  // Handle generic types: Name`N[[TypeArgs]]
  const genericMatch = normalizedTargetType.match(
    /^(.+)`(\d+)(?:\[\[(.+)\]\])?$/
  );
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = parseInt(genericMatch[2], 10);
    const typeArgsStr = genericMatch[3]; // May be undefined

    let typeArguments: IrType[] | undefined;
    if (typeArgsStr) {
      const args = splitExternalTypeArguments(typeArgsStr, arity);
      if (args.length === arity) {
        typeArguments = args.map((arg) => parseExternalTypeString(arg.trim()));
      }
    } else {
      typeArguments = [];
      for (let index = 0; index < arity; index++) {
        typeArguments.push({
          kind: "typeParameterType",
          name: index === 0 ? "T" : `T${index + 1}`,
        });
      }
    }

    return {
      kind: "referenceType",
      name: getProviderSimpleTypeName(baseName),
      typeArguments,
      providerQualifiedName: targetType,
    };
  }

  // Default: treat as reference type
  return {
    kind: "referenceType",
    name: normalizedTargetType,
    providerQualifiedName: targetType,
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
