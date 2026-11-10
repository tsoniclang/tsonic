export const fieldUnionFlowSource = `
export class Mount {
  mountpath: string | string[] = "/";
  path(): string {
    if (typeof this.mountpath === "string") return this.mountpath;
    return this.mountpath[0]!;
  }
  set(value: string | string[]): void { this.mountpath = value; }
}
interface Selected { value: string | number; }
function text(value: Selected): string {
  if (typeof value.value === "string") return value.value;
  return "number";
}
export function run(): boolean {
  const mount = new Mount();
  if (mount.path() !== "/") return false;
  mount.set(["native"]);
  if (mount.path() !== "native") return false;
  mount.set("changed");
  const selected: Selected = { value: "text" };
  if (mount.path() !== "changed" || text(selected) !== "text") return false;
  selected.value = 7;
  return text(selected) === "number";
}
`;
