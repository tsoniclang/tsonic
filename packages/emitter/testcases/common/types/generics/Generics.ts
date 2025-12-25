export function identity<T>(value: T): T {
  return value;
}

// Idiomatic C# pattern: TryGet with out parameter
export function tryFirstElement<T>(arr: T[], result: out<T>): boolean {
  if (arr.length === 0) {
    return false;
  }
  result = arr[0];
  return true;
}

export class Box<T> {
  constructor(public value: T) {}

  getValue(): T {
    return this.value;
  }
}
