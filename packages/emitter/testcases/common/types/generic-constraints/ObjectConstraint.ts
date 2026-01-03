// Reference type constraint (class)
export class RefWrapper<T extends object> {
  value: T | null;
  constructor(value: T | null) {
    this.value = value;
  }
  isNull(): boolean {
    return this.value === null;
  }
}
