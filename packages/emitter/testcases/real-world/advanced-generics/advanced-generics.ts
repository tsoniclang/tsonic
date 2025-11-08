// Generic pair
export class Pair<T, U> {
  constructor(
    public first: T,
    public second: U
  ) {}

  swap(): Pair<U, T> {
    return new Pair(this.second, this.first);
  }

  map<V, W>(
    firstMapper: (value: T) => V,
    secondMapper: (value: U) => W
  ): Pair<V, W> {
    return new Pair(firstMapper(this.first), secondMapper(this.second));
  }
}

// Generic result type
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>
): result is { ok: true; value: T } {
  return result.ok === true;
}

export function isErr<T, E>(
  result: Result<T, E>
): result is { ok: false; error: E } {
  return result.ok === false;
}

// Generic tree structure
export class TreeNode<T> {
  children: TreeNode<T>[] = [];

  constructor(public value: T) {}

  addChild(value: T): TreeNode<T> {
    const child = new TreeNode(value);
    this.children.push(child);
    return child;
  }

  forEach(callback: (value: T) => void): void {
    callback(this.value);
    for (const child of this.children) {
      child.forEach(callback);
    }
  }

  map<U>(mapper: (value: T) => U): TreeNode<U> {
    const mapped = new TreeNode(mapper(this.value));
    for (const child of this.children) {
      mapped.children.push(child.map(mapper));
    }
    return mapped;
  }
}

// Constrained generics
export interface Comparable<T> {
  compareTo(other: T): number;
}

export function min<T extends Comparable<T>>(items: T[]): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  let result = items[0];
  for (let i = 1; i < items.length; i++) {
    if (items[i].compareTo(result) < 0) {
      result = items[i];
    }
  }
  return result;
}

export function max<T extends Comparable<T>>(items: T[]): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  let result = items[0];
  for (let i = 1; i < items.length; i++) {
    if (items[i].compareTo(result) > 0) {
      result = items[i];
    }
  }
  return result;
}

// Generic builder pattern
export class Builder<T> {
  private props: Partial<T> = {};

  set<K extends keyof T>(key: K, value: T[K]): Builder<T> {
    this.props[key] = value;
    return this;
  }

  build(): T {
    return this.props as T;
  }
}
