// Base generic
export class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

// Generic extending generic (same type param)
export class LabeledBox<T> extends Box<T> {
  label: string;
  constructor(value: T, label: string) {
    super(value);
    this.label = label;
  }
  describe(): string {
    return `${this.label}: ${this.value}`;
  }
}

// Generic extending generic (different type param name)
export class WrappedBox<U> extends Box<U> {
  wrap(): Box<U> {
    return new Box(this.value);
  }
}
