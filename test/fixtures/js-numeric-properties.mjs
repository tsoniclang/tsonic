export const jsNumericPropertySource = `
function read(values: Uint8Array | readonly number[], key: number): number | undefined {
  return values[key];
}
export function run(): boolean {
  const nan = Number.NaN;
  const infinity = Number.POSITIVE_INFINITY;
  const values: number[] = [1];
  const alias = values;
  values[-1] = 2;
  values[1.5] = 3;
  values[nan] = 4;
  values[infinity] = 5;
  values[4294967295] = 6;
  values[-0] = 7;
  if (values.length !== 1 || values[0] !== 7 || alias[-1] !== 2 || alias[1.5] !== 3) return false;
  if (values[nan] !== 4 || values[infinity] !== 5 || values[4294967295] !== 6) return false;
  if (read(values, -1) !== 2 || read(values, 1.5) !== 3 || read(values, nan) !== 4) return false;
  const bytes = new Uint8Array([9]);
  if (read(bytes, 0) !== 9 || read(bytes, -1) !== undefined || read(bytes, 1.5) !== undefined) return false;
  if (!(nan in values) || !(1.5 in values) || 1 in values) return false;
  if (Object.keys(values).join("|") !== "0|-1|1.5|NaN|Infinity|4294967295") return false;
  delete values[-1];
  values[-1] = 8;
  delete values[nan];
  if (read(values, nan) !== undefined) return false;
  if (nan in values || alias[-1] !== 8) return false;
  values.length = 0;
  return !(0 in values) && alias[1.5] === 3 &&
    Object.keys(values).join("|") === "1.5|Infinity|4294967295|-1";
}
`;
