export interface Printable {
  toString(): string;
}

export class Printer<T extends Printable> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  print(): string {
    return this.value.toString();
  }
}
