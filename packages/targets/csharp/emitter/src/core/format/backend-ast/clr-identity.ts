export const stripGlobalClrAlias = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const parseSurfaceGenericIdentity = (
  rawName: string
): { readonly name: string; readonly arity: number } | undefined => {
  const openIndex = rawName.indexOf("<");
  if (openIndex < 0 || !rawName.endsWith(">")) {
    return undefined;
  }

  const argumentList = rawName.slice(openIndex + 1, -1);
  const arity = countTopLevelGenericArguments(argumentList);
  return arity === undefined
    ? undefined
    : { name: rawName.slice(0, openIndex), arity };
};

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
      if (depth < 0) {
        return undefined;
      }
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

const parseClrIdentity = (
  rawName: string
): { readonly name: string; readonly arity: number | undefined } => {
  const normalizedName = stripGlobalClrAlias(rawName.trim());
  const surfaceGeneric = parseSurfaceGenericIdentity(normalizedName);
  const identityName = surfaceGeneric?.name ?? normalizedName;
  const genericMatch = /^(.*)`([0-9]+)$/.exec(identityName);
  if (!genericMatch) {
    return { name: identityName, arity: surfaceGeneric?.arity };
  }

  return {
    name: genericMatch[1] ?? identityName,
    arity: Number(genericMatch[2]),
  };
};

export const getClrIdentityKey = (
  rawName: string,
  typeArgumentArity = 0
): string => {
  const parsed = parseClrIdentity(rawName);
  const arity = parsed.arity ?? typeArgumentArity;
  return `${parsed.name}/${arity}`;
};
