export const nativeLiteralRefinementsSource = `
type Kind = "one" | "two" | "three";
interface Options { readonly kind?: Kind | null; }
class Holder {
  #kind: Kind | null | undefined;
  publicKind: Kind | null | undefined;
  constructor(value?: Kind | null) { this.#kind = value; this.publicKind = value; }
  set(value: Kind | null | undefined): void { this.#kind = value; this.publicKind = value; }
  privateSelection(): number { return this.#kind === "one" ? 1 : this.#kind === "two" ? 2 : 3; }
  publicSelection(): number { return this.publicKind === "one" ? 1 : this.publicKind === "two" ? 2 : 3; }
}
function readonlySelection(options: Options): number {
  return options.kind === "one" ? 1 : options.kind === "two" ? 2 : 3;
}
function present(value: Kind | null | undefined): boolean {
  if (value === "one") return false;
  if (value === "two") return false;
  return value === "three";
}
export function run(): boolean {
  const holder = new Holder();
  if (holder.privateSelection() !== 3 || holder.publicSelection() !== 3) return false;
  holder.set("two");
  if (holder.privateSelection() !== 2 || holder.publicSelection() !== 2) return false;
  holder.set("one");
  if (holder.privateSelection() !== 1 || holder.publicSelection() !== 1) return false;
  holder.set(null);
  if (holder.privateSelection() !== 3 || holder.publicSelection() !== 3) return false;
  holder.set(undefined);
  return holder.privateSelection() === 3 && holder.publicSelection() === 3 &&
    readonlySelection({ kind: "one" }) === 1 && readonlySelection({ kind: "two" }) === 2 &&
    readonlySelection({ kind: "three" }) === 3 && readonlySelection({}) === 3 &&
    readonlySelection({ kind: null }) === 3 &&
    !present("one") && !present("two") && present("three") && !present(null) && !present(undefined);
}
`;
