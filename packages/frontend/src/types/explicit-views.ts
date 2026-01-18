/**
 * Explicit Interface Views - Handle As_IInterface pattern for explicit implementations.
 *
 * C# supports explicit interface implementation (EII), where a class implements
 * an interface member explicitly. TypeScript doesn't support EII, so tsbindgen
 * generates special As_IInterface properties that return views of the object.
 *
 * Example:
 * TypeScript: list.As_ICollection.CopyTo(array, 0)
 * C#:         ((ICollection<T>)list).CopyTo(array, 0)
 *
 * @see spec/explicit-interface-views.md for complete documentation
 */

/**
 * Pattern for explicit interface view property names.
 * Format: As_IInterfaceName
 */
const VIEW_PROPERTY_PREFIX = "As_";
const VIEW_PROPERTY_PATTERN = /^As_(.+)$/;

/**
 * Check if a property name matches the explicit view pattern (As_IInterface).
 *
 * @param propertyName - Property name to check
 * @returns True if matches As_IInterface pattern
 */
export const isExplicitViewProperty = (propertyName: string): boolean => {
  return propertyName.startsWith(VIEW_PROPERTY_PREFIX);
};

/**
 * Extract interface name from an explicit view property name.
 *
 * @param viewPropertyName - Property name (e.g., "As_ICollection")
 * @returns Interface name (e.g., "ICollection"), or undefined if not a view property
 */
export const extractInterfaceNameFromView = (
  viewPropertyName: string
): string | undefined => {
  const match = viewPropertyName.match(VIEW_PROPERTY_PATTERN);
  if (!match) {
    return undefined;
  }
  return match[1];
};

/**
 * Build explicit view property name from interface name.
 *
 * @param interfaceName - Interface name (e.g., "ICollection")
 * @returns View property name (e.g., "As_ICollection")
 */
export const buildViewPropertyName = (interfaceName: string): string => {
  return `${VIEW_PROPERTY_PREFIX}${interfaceName}`;
};

/**
 * Generate C# interface cast expression for explicit view access.
 *
 * @param objectExpression - C# expression for the object
 * @param interfaceName - CLR interface name (e.g., "System.Collections.ICollection")
 * @returns C# cast expression (e.g., "((ICollection)obj)")
 */
export const generateInterfaceCast = (
  objectExpression: string,
  interfaceName: string
): string => {
  // Extract short name from fully-qualified name
  const shortName = interfaceName.split(".").pop() || interfaceName;

  return `((${shortName})${objectExpression})`;
};

/**
 * Generate C# interface cast with generics.
 *
 * @param objectExpression - C# expression for the object
 * @param interfaceName - CLR interface name (e.g., "System.Collections.Generic.ICollection`1")
 * @param genericArguments - Generic type arguments in C# syntax (e.g., ["string"])
 * @returns C# cast expression (e.g., "((ICollection<string>)obj)")
 */
export const generateGenericInterfaceCast = (
  objectExpression: string,
  interfaceName: string,
  genericArguments: readonly string[]
): string => {
  // Extract short name from fully-qualified name
  const shortName = interfaceName.split(".").pop() || interfaceName;

  // Remove generic arity suffix (`1, `2, etc.)
  const nameWithoutArity = shortName.replace(/`\d+$/, "");

  // Build generic type
  const genericType =
    genericArguments.length > 0
      ? `${nameWithoutArity}<${genericArguments.join(", ")}>`
      : nameWithoutArity;

  return `((${genericType})${objectExpression})`;
};
