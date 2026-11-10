export const indexedCallableSource = `
let events = "";
function observed(): string { return events; }
function index(): number { events += "i"; return 0; }
function argument(): number { events += "a"; return 2; }
export function run(): boolean {
  let total = 0;
  const callbacks: ((value: number) => number)[] = [value => { events += "c"; total += value; return total; }];
  if (callbacks[index()](argument()) !== 2 || observed() !== "iac") return false;
  if ((callbacks[0])(3) !== 5 || total !== 5) return false;
  events = "";
  if (callbacks[1]?.(argument()) !== undefined || observed() !== "") return false;
  if (callbacks[0]?.(argument()) !== 7 || observed() !== "ac") return false;
  return true;
}
`;
