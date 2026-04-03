declare function takesString(value: string): void;

export function bytes(body: string | Uint8Array): number {
  if (body instanceof Uint8Array) {
    return body.length;
  }
  takesString(body);
  return body.length;
}

export function arrays(value: string | string[]): number {
  if (value instanceof Array) {
    return value.length;
  }
  takesString(value);
  return value.length;
}

export function dates(value: string | Date): number {
  if (value instanceof Date) {
    return 1;
  }
  takesString(value);
  return value.length;
}

export function regexps(value: string | RegExp): boolean {
  if (value instanceof RegExp) {
    return value.test("ok");
  }
  takesString(value);
  return value.length > 0;
}

export function maps(value: string | Map<string, string>): number {
  if (value instanceof Map) {
    return value.size;
  }
  takesString(value);
  return value.length;
}

export function sets(value: string | Set<string>): number {
  if (value instanceof Set) {
    return value.size;
  }
  takesString(value);
  return value.length;
}
