export class Functor<T extends object> {
  map<U extends object>(fn: (x: T) => U): Functor<U> {
    throw "Not implemented";
  }
}

export class Maybe<T extends object> extends Functor<T> {
  private value: T | null;

  constructor(value: T | null) {
    super();
    this.value = value;
  }

  static just<T extends object>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T extends object>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  map<U extends object>(fn: (x: T) => U): Maybe<U> {
    if (this.value === null) {
      return Maybe.nothing<U>();
    }
    return Maybe.just(fn(this.value));
  }

  flatMap<U extends object>(fn: (x: T) => Maybe<U>): Maybe<U> {
    if (this.value === null) {
      return Maybe.nothing<U>();
    }
    return fn(this.value);
  }

  getOrElse(defaultValue: T): T {
    return this.value !== null ? this.value : defaultValue;
  }
}
