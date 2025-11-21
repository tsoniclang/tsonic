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

import type { ExplicitView } from "./metadata.ts";

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
 * Find explicit view for a given interface in type metadata.
 *
 * @param explicitViews - Array of explicit views from metadata
 * @param interfaceName - CLR interface name to find (e.g., "System.Collections.ICollection")
 * @returns Explicit view if found, undefined otherwise
 */
export const findExplicitView = (
  explicitViews: readonly ExplicitView[] | undefined,
  interfaceName: string
): ExplicitView | undefined => {
  if (!explicitViews) {
    return undefined;
  }

  return explicitViews.find((view) => view.interfaceName === interfaceName);
};

/**
 * Check if a member is in an explicit view (view-only member).
 *
 * @param explicitViews - Array of explicit views from metadata
 * @param memberName - CLR member name to check
 * @returns True if member appears in any view
 */
export const isMemberInExplicitView = (
  explicitViews: readonly ExplicitView[] | undefined,
  memberName: string
): boolean => {
  if (!explicitViews) {
    return false;
  }

  for (const view of explicitViews) {
    if (view.members.some((m) => m.clrName === memberName)) {
      return true;
    }
  }

  return false;
};

/**
 * Get all interface names that have explicit views.
 *
 * @param explicitViews - Array of explicit views from metadata
 * @returns Array of interface CLR names
 */
export const getExplicitViewInterfaces = (
  explicitViews: readonly ExplicitView[] | undefined
): readonly string[] => {
  if (!explicitViews) {
    return [];
  }

  return explicitViews.map((view) => view.interfaceName);
};

/**
 * Information about an explicit view member access.
 */
export type ExplicitViewAccess = {
  readonly interfaceName: string;
  readonly interfaceTsName: string;
  readonly memberName: string;
  readonly memberKind: "Method" | "Property" | "Event";
};

/**
 * Parse an explicit view member access expression.
 *
 * Example: obj.As_ICollection.CopyTo
 * Returns: { interfaceName: "ICollection", memberName: "CopyTo", ... }
 *
 * @param viewPropertyName - View property name (e.g., "As_ICollection")
 * @param memberName - Member being accessed (e.g., "CopyTo")
 * @param explicitViews - Array of explicit views from metadata
 * @returns View access info if valid, undefined if invalid
 */
export const parseExplicitViewAccess = (
  viewPropertyName: string,
  memberName: string,
  explicitViews: readonly ExplicitView[] | undefined
): ExplicitViewAccess | undefined => {
  // Extract interface name from view property
  const interfaceTsName = extractInterfaceNameFromView(viewPropertyName);
  if (!interfaceTsName) {
    return undefined;
  }

  // Find the explicit view in metadata
  if (!explicitViews) {
    return undefined;
  }

  // Look for view that matches the property name
  const view = explicitViews.find((v) => v.tsPropertyName === viewPropertyName);
  if (!view) {
    return undefined;
  }

  // Find the member in the view
  const member = view.members.find((m) => m.name === memberName);
  if (!member) {
    return undefined;
  }

  return {
    interfaceName: view.interfaceName,
    interfaceTsName,
    memberName: member.name,
    memberKind: member.kind,
  };
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
