export type NamingPolicy = "clr" | "none";

export type NamingPolicyConfig = {
  readonly all?: NamingPolicy;
  readonly namespaces?: NamingPolicy;
  readonly classes?: NamingPolicy;
  readonly methods?: NamingPolicy;
  readonly properties?: NamingPolicy;
  readonly fields?: NamingPolicy;
  readonly enumMembers?: NamingPolicy;
};

export type NamingPolicyBucket = Exclude<keyof NamingPolicyConfig, "all">;

export const resolveNamingPolicy = (
  config: NamingPolicyConfig | undefined,
  bucket: NamingPolicyBucket
): NamingPolicy => {
  if (config?.all) return config.all;
  return config?.[bucket] ?? "clr";
};

const splitIntoWords = (name: string): readonly string[] => {
  const tokens = name.split(/[-_]+/g).filter((t) => t.length > 0);
  const words: string[] = [];

  for (const token of tokens) {
    const matches =
      token.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) ?? [];
    if (matches.length === 0) {
      words.push(token);
    } else {
      words.push(...matches);
    }
  }

  return words;
};

const toPascalWord = (word: string): string => {
  if (word.length === 0) return "";
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
};

/**
 * Apply a naming policy to an identifier fragment.
 *
 * - `none`: preserve case and separators except remove hyphens (`-`)
 * - `clr`: word-based PascalCase (CLR/C# convention)
 */
export const applyNamingPolicy = (
  name: string,
  policy: NamingPolicy
): string => {
  if (policy === "none") {
    return name.replace(/-/g, "");
  }

  const words = splitIntoWords(name);
  if (words.length === 0) return "";

  return words.map(toPascalWord).join("");
};
