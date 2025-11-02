export function process(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase();
  } else {
    return value.toString();
  }
}

export function maybeString(value: string | null): number {
  return value?.length ?? 0;
}
