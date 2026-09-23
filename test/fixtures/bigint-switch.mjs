export const bigintSwitchSource = `
let trace = "";
function input(value: bigint): bigint { trace += "input;"; return value; }
function choice(value: bigint, label: string): bigint { trace += label; return value; }
function selected(value: bigint): string {
  let output = "";
  switch (input(value)) {
    case choice(9007199254740993n, "first;"):
      output += "wide";
      break;
    default:
      output += "default";
    case choice(-170141183460469231731687303715884105729n, "second;"):
      output += "negative";
      break;
    case choice(3n, "third;"):
      output += "three";
  }
  return output;
}
export function run(): boolean {
  if (selected(9007199254740993n) !== "wide" || trace !== "input;first;") return false;
  trace = "";
  if (selected(-170141183460469231731687303715884105729n) !== "negative" ||
      trace !== "input;first;second;") return false;
  trace = "";
  if (selected(4n) !== "defaultnegative" || trace !== "input;first;second;third;") return false;
  trace = "";
  return selected(3n) === "three" && trace === "input;first;second;third;";
}
`;
