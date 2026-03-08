const base = {
  mul(x: number): number {
    return x * 2;
  },
};

const ops = {
  __proto__: base,
  mul(x: number): number {
    return super.mul(x);
  },
};

void ops;
