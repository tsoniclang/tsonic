const takeParts = (parts: string[]): string => parts.join(",");

export function main(): void {
  const path = "docs/getting-started";
  const parts: string[] = path.split("/");
  const maybeMatch: string[] | undefined = path.match("docs");
  const allMatches: string[][] = "a-a".matchAll("a");
  const empty: string[] = [];
  const selected: string[] = path.trim() === "" ? empty : path.split("/");
  const firstMatch = maybeMatch === undefined ? "" : maybeMatch[0]!;
  const firstAll = allMatches.length === 0 ? "" : allMatches[0]![0]!;

  console.log(
    takeParts(parts),
    firstMatch,
    firstAll,
    selected.length.toString()
  );
}
