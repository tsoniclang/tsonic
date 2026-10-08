export const constrainedNamedFieldsSource = `
import type { int64 } from "@tsonic/core/types.js";
interface Score { score: int64; }
function read<T extends Score>(value: T): int64 { return value.score; }
function write<T extends Score>(value: T, score: int64): void { value.score = score; }
class Entry implements Score { score: int64 = 9007199254740993n; }
export function run(): boolean {
  const entry = new Entry();
  const alias = entry;
  const record: Score = { score: 9007199254740995n };
  if (read(entry) !== 9007199254740993n || read(record) !== 9007199254740995n) return false;
  write(entry, 9223372036854775807n);
  write(record, -9223372036854775808n);
  return read(alias) === 9223372036854775807n && read(record) === -9223372036854775808n;
}
`;
