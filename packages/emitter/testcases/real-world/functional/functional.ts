// Option type (Maybe monad)
export type Option<T> = Some<T> | None;

export class Some<T> {
  readonly _tag = "Some";
  constructor(readonly value: T) {}
}

export class None {
  readonly _tag = "None";
}

export function some<T>(value: T): Option<T> {
  return new Some(value);
}

export function none<T>(): Option<T> {
  return new None();
}

export function isSome<T>(option: Option<T>): option is Some<T> {
  return (option as Some<T>)._tag === "Some";
}

export function isNone<T>(option: Option<T>): option is None {
  return (option as None)._tag === "None";
}

export function getOrElse<T>(option: Option<T>, defaultValue: T): T {
  if (isSome(option)) {
    return option.value;
  }
  return defaultValue;
}

// Pure functions for array operations
export function pipe<A, B>(value: A, fn: (a: A) => B): B {
  return fn(value);
}

export function compose<A, B, C>(
  f: (b: B) => C,
  g: (a: A) => B
): (a: A) => C {
  return (a: A) => f(g(a));
}

export function curry<A, B, C>(
  fn: (a: A, b: B) => C
): (a: A) => (b: B) => C {
  return (a: A) => (b: B) => fn(a, b);
}

export function partial<A, B, C>(
  fn: (a: A, b: B) => C,
  a: A
): (b: B) => C {
  return (b: B) => fn(a, b);
}

// Higher-order functions
export function memoize<T extends any[], R>(
  fn: (...args: T) => R
): (...args: T) => R {
  const cache = new Map<string, R>();

  return (...args: T): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

export function debounce<T extends any[]>(
  fn: (...args: T) => void,
  delayMs: number
): (...args: T) => void {
  let timeoutId: any;

  return (...args: T): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}

// Lazy evaluation
export class Lazy<T> {
  private value: T | undefined;
  private computed: boolean = false;

  constructor(private computer: () => T) {}

  get(): T {
    if (!this.computed) {
      this.value = this.computer();
      this.computed = true;
    }
    return this.value!;
  }

  map<U>(mapper: (value: T) => U): Lazy<U> {
    return new Lazy(() => mapper(this.get()));
  }
}

// Immutable operations
export function assoc<T, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K]
): T {
  return { ...obj, [key]: value };
}

export function dissoc<T, K extends keyof T>(
  obj: T,
  key: K
): Omit<T, K> {
  const { [key]: _, ...rest } = obj;
  return rest;
}
