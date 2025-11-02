export function identity<T>(value: T): T {
  return value;
}

export function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}

export class Box<T> {
  constructor(public value: T) {}

  getValue(): T {
    return this.value;
  }
}
