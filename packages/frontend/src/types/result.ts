/**
 * Result type for functional error handling
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T, E>(value: T): Result<T, E> => ({
  ok: true,
  value,
});

export const error = <T, E>(error: E): Result<T, E> => ({
  ok: false,
  error,
});

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => (result.ok ? ok(fn(result.value)) : result);

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (result.ok ? fn(result.value) : result);

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => (result.ok ? result : error(fn(result.error)));

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T => (result.ok ? result.value : fn(result.error));

export const isOk = <T, E>(
  result: Result<T, E>
): result is { readonly ok: true; readonly value: T } => result.ok;

export const isError = <T, E>(
  result: Result<T, E>
): result is { readonly ok: false; readonly error: E } => !result.ok;
