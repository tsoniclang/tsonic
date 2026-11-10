export const bigintOperatorSource = `
let trace = "";
const values = [7n];
function receiver(): bigint[] { trace += "receiver;"; return values; }
function index(): number { trace += "index;"; return 0; }
function right(): bigint { trace += "right;"; values[0] = 100n; return 2n; }
class Counter {
  value: bigint = 21n;
  static shared: bigint = 6n;
}
const counter = new Counter();
function owner(): Counter { trace += "owner;"; return counter; }
function divisor(): bigint { trace += "divisor;"; counter.value = 100n; return 3n; }
export function run(): boolean {
  const result = receiver()[index()] <<= right();
  if (result !== 28n || values[0] !== 28n || trace !== "receiver;index;right;") return false;
  trace = "";
  const divided = owner().value /= divisor();
  if (divided !== 7n || counter.value !== 7n || trace !== "owner;divisor;") return false;
  Counter.shared <<= 2n;
  if (Counter.shared !== 24n) return false;
  const wide = 9007199254740993n;
  if ((wide << 2n) >> 2n !== wide || (-9n >> 2n) !== -3n || (-9n << -2n) !== -3n) return false;
  if ((3n >> -2n) !== 12n || -7n / 3n !== -2n || -7n % 3n !== -1n) return false;
  const huge = 1n << 100n;
  if ((7n >> huge) !== 0n || (-7n >> huge) !== -1n || (0n << huge) !== 0n) return false;
  let value = 3n;
  value &= 2n;
  value |= 4n;
  value ^= 1n;
  value++;
  if (value !== 8n || ~0n !== -1n) return false;
  let errors = 0;
  try { value /= 0n; } catch (error) { if (error instanceof RangeError) errors++; }
  try { value %= 0n; } catch (error) { if (error instanceof RangeError) errors++; }
  return errors === 2 && value === 8n;
}
`;
