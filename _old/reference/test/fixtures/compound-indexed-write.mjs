export const compoundIndexedWriteSource = `
const values: number[] = [2, 8];
let trace = "";
function receiver(): number[] { trace += "receiver;"; return values; }
function index(): number { trace += "index;"; return 0; }
function right(): number { trace += "right;"; values[0] = 20; return 3; }
export function run(): boolean {
  receiver()[index()] += right();
  const words = ["a"];
  words[0] += "b";
  const integers = [3n];
  integers[0] <<= 2n;
  return trace === "receiver;index;right;" && values[0] === 5 && values[1] === 8 &&
    words[0] === "ab" && integers[0] === 12n;
}
`;
