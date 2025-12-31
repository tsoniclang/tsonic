export interface Functor<T> {
  map<U>(fn: (x: T) => U): Functor<U>;
}

export class Maybe<T> implements Functor<T> {
  private value: T | null;

  constructor(value: T | null) {
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
