export const unionAssertionSource = `
type Values = string | string[];
type Pair = string | number;
type Wide = Pair | boolean;
function array(value: Values): string[] { return value as string[]; }
function text(value: Values): string { return value as string; }
function subset(value: Wide): Pair { return value as Pair; }
function choose(value: Pair): string { return typeof value === "string" ? value : "number"; }
function invoke(value: string | (() => string)): string { return (value as () => string)(); }
class Counter { calls = 0; }
function counted(counter: Counter): Wide { counter.calls++; return "once"; }
export function run(): boolean {
  const counter = new Counter();
  const selected = choose(counted(counter) as Pair);
  const elements = array(["first", "second"]);
  return elements[0] === "first" && elements[1] === "second" && text("text") === "text" &&
    choose(subset(7)) === "number" && selected === "once" && counter.calls === 1 &&
    invoke(() => "called") === "called";
}
`;
