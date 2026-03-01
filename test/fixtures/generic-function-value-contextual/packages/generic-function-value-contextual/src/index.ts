const id = <T>(x: T): T => x;

function use(fn: (x: number) => number): number {
  return fn(1);
}

const out1 = use(id);
const copy: (x: number) => number = id;
const out2 = copy(2);

type Box = { run: (x: number) => number };
const box: Box = { run: id };
type Box2 = { id: (x: number) => number };
const box2: Box2 = { id };
const handlers: Array<(x: number) => number> = [id];
const out3 = box.run(3);
const out4 = box2.id(4);
const out5 = handlers[0]!(5);

function make(): (x: number) => number {
  const nested = <T>(x: T): T => x;
  return nested;
}

const out6 = make()(6);

void out1;
void out2;
void out3;
void out4;
void out5;
void out6;
