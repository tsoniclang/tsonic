export function nestedScopes(x: number): number {
  const a = 10;
  {
    const b = 20;
    {
      const c = 30;
      return a + b + c + x;
    }
  }
}
