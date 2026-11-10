export const structuralArrayStorageSource = `
type Row = { count: number };
function replace(rows: Row[], row: Row): Row {
  const previous = rows[0];
  rows[0] = row;
  rows[1] = previous;
  return rows[0];
}
export function run(): boolean {
  const first = { count: 3 };
  const second = { count: 7 };
  const replacement = { count: 11 };
  const values = [first, second];
  const alias = values;
  const selected = replace(alias, replacement);
  selected.count = 19;
  if (replacement.count !== 19 || values[0].count !== 19 || alias[0].count !== 19) return false;
  first.count = 23;
  if (values[1].count !== 23 || alias[1].count !== 23) return false;
  alias[1].count = 29;
  return first.count === 29 && second.count === 7;
}
`;
