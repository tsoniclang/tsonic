const id = <T>(x: T): T => x;

function use(fn: (x: number) => number): number {
  return fn(1);
}

const out1 = use(id);
const copy: (x: number) => number = id;
const out2 = copy(2);

void out1;
void out2;
