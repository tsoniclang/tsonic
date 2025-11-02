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
