export const contextualClassArgumentsSource = `
class Item { value: number = 0; }
class First extends Item {}
class Second extends Item {}
let order = "";
function flag(value: boolean): boolean { order += "f"; return value; }
function first(value: First): First { order += "a"; return value; }
function second(value: Second): Second { order += "b"; return value; }
function choose(selected: boolean, left: First, right: Second): Item {
  return selected ? left : right;
}
export function run(): boolean {
  const left = new First();
  const right = new Second();
  const items: Item[] = [];
  order = "";
  items.push(flag(true) ? first(left) : second(right));
  items.push((flag(false) ? first(left) : second(right)) satisfies Item);
  items.push(flag(true) ? (flag(false) ? second(right) : first(left)) : second(right));
  const selected = choose(true, left, right);
  selected.value = 7;
  const last = items[2];
  last.value = 9;
  return order === "fafbffa" && items[0] === left && items[1] === right &&
    items[2] === left && selected === left && left.value === 9 && right.value === 0;
}
`;
