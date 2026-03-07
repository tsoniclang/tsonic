export function main(): void {
  const counts = new Map<string, number>();
  counts.set("alpha", 1);
  counts.set("beta", 2);

  const keys = Array.from(counts.keys());
  console.log(keys.join(","));
}
