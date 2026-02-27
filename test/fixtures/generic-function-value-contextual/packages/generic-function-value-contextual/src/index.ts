const id = <T>(x: T): T => x;

function use(fn: (x: number) => number): number {
  return fn(1);
}

const out1 = use(id);
const copy: (x: number) => number = id;
const out2 = copy(2);

type Box = { run: (x: number) => number };
const box: Box = { run: id };
const handlers: Array<(x: number) => number> = [id];
const out3 = box.run(3);
const out4 = handlers[0]!(4);

function make(): (x: number) => number {
  const nested = <T>(x: T): T => x;
  return nested;
}

const out5 = make()(5);

void out1;
void out2;
void out3;
void out4;
void out5;
