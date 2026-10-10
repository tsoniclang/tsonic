export const optionalArrayComparisonSource = `
export function run(): boolean {
  const original: string[] = ["original"];
  const changed: string[] = ["changed"];
  const values: string[][] = [original];
  let reads = 0;
  const replaceElement = (): string[] => {
    reads++;
    values[0] = changed;
    return original;
  };
  const elementSnapshot = values[0] === replaceElement();
  let optional: string[] | undefined = original;
  const replaceSlot = (): string[] => {
    reads++;
    optional = changed;
    return original;
  };
  const capturedSnapshot = optional === replaceSlot();
  let inline: string[] | undefined = original;
  const inlineSnapshot = inline !== (inline = changed);
  let unrelated = changed;
  let stable: string[] | undefined = original;
  const unrelatedSnapshot = stable === (unrelated = original);
  stable = changed;
  let text: string | undefined = "before";
  const textSnapshot = text !== (text = "after");
  const present: string[] | undefined = original;
  const absent: string[] | undefined = undefined;
  return elementSnapshot && capturedSnapshot && inlineSnapshot && unrelatedSnapshot && textSnapshot && reads === 2 &&
    unrelated === original && stable === changed && text === "after" &&
    values[0] === changed && optional === changed && inline === changed &&
    present === original && original === present && present !== changed &&
    changed !== present && absent !== original && original !== absent &&
    present === present && absent === absent && present !== absent &&
    original[0] === "original" && changed[0] === "changed";
}
`;
