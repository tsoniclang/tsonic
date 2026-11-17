export const conditionalReadonlySequencesSource = `
interface Options { index?: false | string | readonly string[]; }
interface MutableOptions { index?: false | string | string[]; }
class Effects { calls = 0; }
function count(values: readonly string[]): number {
  let total = 0;
  for (const value of values) { if (typeof value === "string") total++; }
  return total;
}
function fallback(effects: Effects): readonly string[] {
  effects.calls++;
  return ["fallback"];
}
function select(options: Options | undefined, effects: Effects) {
  const configured = options?.index;
  return configured === false ? [] : typeof configured === "string"
    ? [configured] : configured ?? fallback(effects);
}
function mutableFallback(effects: Effects): string[] {
  effects.calls++;
  return ["mutable"];
}
function selectMutable(options: MutableOptions | undefined, effects: Effects) {
  const configured = options?.index;
  return configured === false ? [] : typeof configured === "string"
    ? [configured] : configured ?? mutableFallback(effects);
}
function emptyLast(present: boolean, values: readonly string[]) {
  return present ? values : [];
}
function selectedAlias(present: boolean, values: readonly string[]) {
  const selected = present ? values : [];
  return selected;
}
export function run(): boolean {
  const effects = new Effects();
  const absent = select(undefined, effects);
  const emptyOptions = select({}, effects);
  const disabled = select({ index: false }, effects);
  const text = select({ index: "manual" }, effects);
  const sequence = select({ index: ["alpha", "beta"] }, effects);
  const lastEmpty = emptyLast(false, ["unused"]);
  const lastPresent = emptyLast(true, ["present"]);
  const aliasEmpty = selectedAlias(false, ["unused"]);
  const aliasPresent = selectedAlias(true, ["alias"]);
  const mutableAbsent = selectMutable(undefined, effects);
  const mutableEmpty = selectMutable({}, effects);
  const mutableDisabled = selectMutable({ index: false }, effects);
  const mutableText = selectMutable({ index: "manual" }, effects);
  const mutableSequence = selectMutable({ index: ["left", "right"] }, effects);
  mutableSequence[1] = "last";
  return effects.calls === 4 && count(absent) === 1 && absent[0] === "fallback" &&
    count(emptyOptions) === 1 && emptyOptions[0] === "fallback" && count(disabled) === 0 &&
    count(text) === 1 && text[0] === "manual" && count(sequence) === 2 &&
    sequence[0] === "alpha" && sequence[1] === "beta" && count(lastEmpty) === 0 &&
    count(lastPresent) === 1 && lastPresent[0] === "present" && count(aliasEmpty) === 0 &&
    count(aliasPresent) === 1 && aliasPresent[0] === "alias" &&
    count(mutableAbsent) === 1 && mutableAbsent[0] === "mutable" &&
    count(mutableEmpty) === 1 && mutableEmpty[0] === "mutable" &&
    count(mutableDisabled) === 0 && count(mutableText) === 1 && mutableText[0] === "manual" &&
    count(mutableSequence) === 2 && mutableSequence[0] === "left" && mutableSequence[1] === "last";
}
`;
