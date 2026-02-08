export function shadowedVariable(): number {
  const x = 10;
  {
    const x = 20;
    return x;
  }
}

export function shadowInFunction(): number {
  const value = 5;
  const inner = (): number => {
    const value = 10;
    return value;
  };
  return value + inner();
}

export function shadowAfterNestedBlock(): number {
  {
    const q = 1;
  }
  const q = 2;
  return q;
}

export function shadowAfterCatch(): number {
  try {
    // no-op
  } catch (e) {
    const inner = 1;
    inner;
  }
  const e = 2;
  return e;
}

export function shadowAfterForOf(): number {
  for (const i of [1, 2, 3]) {
    i;
  }
  const i = 10;
  return i;
}

export function numberTruthinessTempCollision(): number {
  const __tsonic_truthy_num_1 = 1;
  const n: number = 2;
  if (n) {
    return __tsonic_truthy_num_1 + 1;
  }
  return __tsonic_truthy_num_1;
}

export class SetterValueShadowing {
  private _x = 0;

  public set x(v: number) {
    const value = 123;
    this._x = v + value;
  }
}
