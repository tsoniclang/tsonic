export const constructorReadinessSource = `
let trace: number = 0;
function mark(value: number): number { trace = trace * 10 + value; return value; }
class Alias {
  value: number = mark(1);
  readonly owner: Alias = this;
  constructor(early: boolean) {
    try {
      mark(2);
      this.bump();
      if (early) return;
      mark(3);
    } finally {
      this.bump();
      mark(4);
    }
  }
  bump(): void { this.value += 1; }
  read(): number { return this.value; }
}
class Finalized {
  value!: number;
  constructor() { try { return; } finally { this.value = mark(6); } }
}
class Base {
  base: number = mark(1);
  constructor() { try { mark(2); return; } finally { mark(3); } }
  read(): number { return this.base; }
}
class Child extends Base {
  own: number = mark(4);
  constructor() { super(); mark(5); }
}
class Loop {
  value!: number;
  constructor() {
    outside: do {
      try { this.value = mark(7); break outside; }
      finally { mark(8); }
    } while (true);
  }
}
export function run(): boolean {
  const early = new Alias(true);
  if (trace !== 124 || early.owner !== early || early.read() !== 3) return false;
  trace = 0;
  const normal = new Alias(false);
  if (trace !== 1234 || normal.owner !== normal || normal.read() !== 3) return false;
  trace = 0;
  const finalized = new Finalized();
  if (trace !== 6 || finalized.value !== 6) return false;
  trace = 0;
  const child = new Child();
  if (trace !== 12345 || child.read() !== 1 || child.own !== 4) return false;
  trace = 0;
  const loop = new Loop();
  return trace === 78 && loop.value === 7;
}
`;
