export class Array<T> {
  public static from<TValue>(values: TValue[]): Array<TValue> {
    void values;
    return new Array<TValue>();
  }

  public push(...items: T[]): number {
    return items.length;
  }
}
