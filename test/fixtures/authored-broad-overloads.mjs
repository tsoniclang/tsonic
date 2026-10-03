export const authoredBroadOverloadsSource = `
class Settings {
  label: string = "configured";
  get(name: string): unknown;
  get(name: string, changed: () => void): this;
  get(name: string, changed?: () => void): unknown | this {
    if (changed === undefined) {
      if (name === "numeric") return 7;
      return this.label;
    }
    changed();
    return this;
  }
}
export function run(): boolean {
  const instance = new Settings();
  let called = false;
  const returned = instance.get("path", () => { called = true; });
  returned.label = "updated";
  const read = instance.get("name");
  const numeric = instance.get("numeric");
  return called && read === "updated" && numeric === 7 && instance.label === "updated";
}
`;
