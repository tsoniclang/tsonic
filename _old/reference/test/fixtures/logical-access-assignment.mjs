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
function right(): number { rights += 1; cache.current = 100; return 6 + rights; }

class Registry {
  value: Cache | undefined = undefined;
  builds: number = 0;
  get(): Cache { this.value ??= this.make(); return this.value; }
  make(): Cache { this.builds += 1; return new Cache(); }
}

export function run(): boolean {
  const first = (owner().value ??= right());
  const second = ((owner().value) ??= right());
  let local: number | undefined = undefined;
  const third = (local ??= right());
  const fourth = (local ??= right());
  cache.current = undefined;
  let caught = false;
  try {
    owner().value ??= fail();
  } catch {
    caught = true;
  }
  const registry = new Registry();
  const reference = registry.get();
  return first === 7 && second === 7 && third === 8 && fourth === 8 &&
    local === 8 && caught && cache.current === undefined &&
    receivers === 3 && rights === 3 && reads === 3 && writes === 1 &&
    registry.get() === reference && registry.builds === 1;
}

function fail(): number { rights += 1; throw new Error("factory failed"); }
`;
