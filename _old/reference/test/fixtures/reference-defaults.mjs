export const referenceDefaultSource = `
let defaults = 0;
function next(): string { defaults += 1; return "default"; }
function defaultCount(): number { return defaults; }
function direct(value: string = next()): string { return value; }
const deferred = (value: string = next()): string => value;
export function run(): boolean {
  if (defaultCount() !== 0) return false;
  const explicit = direct("explicit");
  const empty = deferred("");
  if (defaultCount() !== 0 || explicit !== "explicit" || empty !== "") return false;
  const first = direct();
  const second = direct(undefined);
  const third = deferred();
  const fourth = deferred(undefined);
  return defaultCount() === 4 && first === "default" && second === "default" &&
    third === "default" && fourth === "default";
}
`;
