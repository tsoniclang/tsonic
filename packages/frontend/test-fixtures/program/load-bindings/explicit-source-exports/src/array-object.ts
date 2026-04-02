export class Array<T> {
  private readonly valuesStore: T[] = [];

  private createWrapped(values: readonly T[] | T[]): Array<T> {
    void values;
    return new Array<T>();
  }

  public push(...items: T[]): number {
    return items.length;
  }

  public slice(start?: number, end?: number): T[] {
    void start;
    void end;
    return [];
  }
}
