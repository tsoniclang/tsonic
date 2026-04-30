declare function mapIterable<T>(source: Iterable<T>): T[];

export class Array<T = object> {
  static from<T>(source: Iterable<T>): T[];
  static from<T>(source: Iterable<T>): T[] {
    return mapIterable(source);
  }
}
