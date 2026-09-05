export function exactRecord<T extends object>(
  value: T,
  required: readonly (keyof T)[],
  optional: readonly (keyof T)[] = [],
): T {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Memory evidence requires a data record.");
  }
  const allowed = new Set<PropertyKey>([...required, ...optional]);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!allowed.has(key) || descriptor === undefined || !("value" in descriptor)) {
      throw new Error(`Memory evidence contains an unexpected field or accessor: ${String(key)}.`);
    }
  }
  const result: Record<PropertyKey, unknown> = {};
  for (const key of [...required, ...optional]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (required.includes(key) && (descriptor === undefined || descriptor.value === undefined)) {
      throw new Error(`Memory evidence is missing ${String(key)}.`);
    }
    if (descriptor?.value !== undefined) result[key] = descriptor.value;
  }
  return Object.freeze(result) as T;
}

export function opaqueSubject(value: object): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Memory evidence requires an exact compiler subject.");
  }
}

export function nonEmptyText(value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Memory evidence requires a non-empty identity.");
  }
}

export function recordsEqual<T extends object>(left: T, right: T): boolean {
  const keys = Object.keys(left) as (keyof T)[];
  return keys.length === Object.keys(right).length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key]));
}
