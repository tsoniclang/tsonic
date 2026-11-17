export interface AuthoredFile {
  readonly path: string;
  readonly text: string;
}

export interface SpecProject {
  readonly root: string;
  readonly files: readonly string[];
}

export function withSpecProject<Result>(
  files: readonly AuthoredFile[],
  action: (project: SpecProject) => Result | Promise<Result>
): Promise<Result>;

export function uniqueAnchor<Record>(
  records: readonly Record[],
  matches: (record: Record) => boolean,
  label: string
): Record;

export type SpecScalar = string | number | bigint | boolean | null | undefined;

export function scalarEqual(actual: SpecScalar, expected: SpecScalar, label: string): void;
export function sameIdentity<Value>(actual: Value, expected: Value, label: string): void;
export function orderedDomain<Value>(
  actual: readonly Value[],
  expected: readonly Value[],
  equal: (actual: Value, expected: Value) => boolean,
  label: string
): void;

export interface ClosableProgram {
  close(): void;
}

export function runHostCase<Input, Program extends ClosableProgram>(
  normalEntry: (input: Input) => Program | Promise<Program>,
  input: Input,
  verify: (program: Program) => void | Promise<void>
): Promise<void>;
