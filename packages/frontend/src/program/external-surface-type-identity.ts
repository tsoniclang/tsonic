const countTopLevelGenericArguments = (
  argumentList: string
): number | undefined => {
  let depth = 0;
  let count = 1;
  let hasContent = false;

  for (const char of argumentList) {
    if (char === "<") {
      depth += 1;
      hasContent = true;
      continue;
    }
    if (char === ">") {
      depth -= 1;
      if (depth < 0) return undefined;
      continue;
    }
    if (char === "," && depth === 0) {
      count += 1;
      continue;
    }
    if (!/\s/.test(char)) {
      hasContent = true;
    }
  }

  return depth === 0 && hasContent ? count : undefined;
};

const parseGenericSurfaceName = (
  rawName: string
): { readonly name: string; readonly arity: number } | undefined => {
  const openIndex = rawName.indexOf("<");
  if (openIndex < 0 || !rawName.endsWith(">")) {
    return undefined;
  }

  const arity = countTopLevelGenericArguments(rawName.slice(openIndex + 1, -1));
  return arity === undefined
    ? undefined
    : { name: rawName.slice(0, openIndex), arity };
};

export const externalSurfaceTypeIdentityKey = (
  rawName: string,
  typeArgumentArity = 0
): string => {
  const normalizedName = rawName.trim();
  const genericSurface = parseGenericSurfaceName(normalizedName);
  const identityName = genericSurface?.name ?? normalizedName;
  const genericMatch = /^(.*)`([0-9]+)$/.exec(identityName);
  if (!genericMatch) {
    return `${identityName}/${genericSurface?.arity ?? typeArgumentArity}`;
  }

  return `${genericMatch[1] ?? identityName}/${Number(genericMatch[2])}`;
};

export const externalSurfaceTypesMatch = (
  left: string,
  right: string,
  typeArgumentArity = 0
): boolean =>
  externalSurfaceTypeIdentityKey(left, typeArgumentArity) ===
  externalSurfaceTypeIdentityKey(right, typeArgumentArity);
