export function id<T>(x: T): T {
  return x;
}

export const value = id({ ok: true, nested: { x: 1 } });
