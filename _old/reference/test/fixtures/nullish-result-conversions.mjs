export const nullishResultConversionsSource = `
let fallbacks = 0;
let consumed = 0;
function fallback(): string { fallbacks++; return "fallback"; }
function selected(value: string | null | undefined): string { return value ?? fallback(); }
function widened(value: string | null | undefined): unknown { return value ?? fallback(); }
function union(value: string | null | undefined): string | number { return value ?? fallback(); }
function consume(value: unknown): void { consumed++; }
function invoke(callback: (value?: string) => void): void { callback("kept"); callback(); }
class Holder {
  value: unknown;
  constructor(value?: string) { this.value = value ?? fallback(); }
  replace(value?: string): void { this.value = value ?? fallback(); }
  format(value?: string): void { consume(value ?? fallback()); }
}
export function run(): boolean {
  if (selected("kept") !== "kept" || selected(null) !== "fallback" ||
    selected(undefined) !== "fallback") return false;
  const present = union("kept");
  const absent = union(undefined);
  if (typeof present !== "string" || present !== "kept" ||
    typeof absent !== "string" || absent !== "fallback") return false;
  widened("kept");
  widened(null);
  const holder = new Holder("kept");
  holder.replace();
  invoke(value => consume(value ?? fallback()));
  holder.format("kept");
  holder.format();
  return fallbacks === 7 && consumed === 4;
}
`;
