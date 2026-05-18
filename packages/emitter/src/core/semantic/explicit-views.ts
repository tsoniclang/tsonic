/**
 * Explicit interface views.
 *
 * Source packages expose explicit-interface implementation receivers as
 * synthetic `As_<Interface>` properties. The emitter owns the target cast that
 * materializes that view.
 */

const VIEW_PROPERTY_PREFIX = "As_";
const VIEW_PROPERTY_PATTERN = /^As_(.+)$/;

export const isExplicitViewProperty = (propertyName: string): boolean =>
  propertyName.startsWith(VIEW_PROPERTY_PREFIX);

export const extractInterfaceNameFromView = (
  viewPropertyName: string
): string | undefined => viewPropertyName.match(VIEW_PROPERTY_PATTERN)?.[1];

export const buildViewPropertyName = (interfaceName: string): string =>
  `${VIEW_PROPERTY_PREFIX}${interfaceName}`;

export const generateInterfaceCast = (
  objectExpression: string,
  interfaceName: string
): string => {
  const shortName = interfaceName.split(".").pop() || interfaceName;
  return `((${shortName})${objectExpression})`;
};

export const generateGenericInterfaceCast = (
  objectExpression: string,
  interfaceName: string,
  genericArguments: readonly string[]
): string => {
  const shortName = interfaceName.split(".").pop() || interfaceName;
  const nameWithoutArity = shortName.replace(/`\d+$/, "");
  const genericType =
    genericArguments.length > 0
      ? `${nameWithoutArity}<${genericArguments.join(", ")}>`
      : nameWithoutArity;

  return `((${genericType})${objectExpression})`;
};
