export const partialRecordAbsenceSource = `
type Headers = Record<string, string[] | undefined>;
class Store {
  readonly values: Headers = {};
  read(key: string, fallback: Headers): string[] {
    return [...(this.values[key] ?? fallback[key] ?? [])];
  }
}
export function run(): boolean {
  const store = new Store();
  const native: Headers = { label: ["before"] };
  const missing = store.read("missing", native);
  const copied = store.read("label", native);
  copied.push("copy only");
  store.values["label"] = ["after"];
  const counts: Record<string, number | undefined> = {};
  counts["first"] = (counts["first"] ?? 0) + 1;
  counts["first"] = (counts["first"] ?? 0) + 1;
  counts["zero"] = 0;
  return missing.length === 0 && copied.length === 2 &&
    native["label"]!.length === 1 && store.read("label", native)[0] === "after" &&
    counts["first"] === 2 && (counts["zero"] ?? 5) === 0;
}
`;
