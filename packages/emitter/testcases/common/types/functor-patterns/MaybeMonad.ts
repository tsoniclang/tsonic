export class Functor<T> {
  map<U>(fn: (x: T) => U): Functor<U> {
    throw new Error("Not implemented");
  }
}

export class Maybe<T> extends Functor<T> {
  private value: T | null;

  constructor(value: T | null) {
    super();
    this.value = value;
  }

  static just<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  map<U>(fn: (x: T) => U): Maybe<U> {
    if (this.value === null) {
      return Maybe.nothing<U>();
    }
    return Maybe.just(fn(this.value));
  }

  flatMap<U>(fn: (x: T) => Maybe<U>): Maybe<U> {
    if (this.value === null) {
      return Maybe.nothing<U>();
    }
    return fn(this.value);
  }

  getOrElse(defaultValue: T): T {
    return this.value !== null ? this.value : defaultValue;
  }
}
