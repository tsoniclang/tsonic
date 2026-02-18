export interface Box<T> {
  value: T;
}

export type Bad = Box<never>;

