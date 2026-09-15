export const logicalAccessAssignmentSource = `
let receivers = 0;
let rights = 0;
let reads = 0;
let writes = 0;

class Cache {
  current: number | undefined = undefined;
  get value(): number | undefined { reads += 1; return this.current; }
  set value(next: number | undefined) { writes += 1; this.current = next; }
}

const cache = new Cache();
function owner(): Cache { receivers += 1; return cache; }
function right(): number { rights += 1; return 6 + rights; }

export function run(): boolean {
  const first = (owner().value ??= right());
  const second = (owner()["value"] ??= right());
  const third = (owner().value &&= right());
  const fourth = (owner()["value"] ||= right());
  cache.current = 0;
  const fifth = (owner().value ||= right());
  cache.current = undefined;
  const sixth = (owner()["value"] &&= right());
  return first === 7 && second === 7 && third === 8 && fourth === 8 &&
    fifth === 9 && sixth === undefined && receivers === 6 && rights === 3 &&
    reads === 6 && writes === 3;
}
`;
