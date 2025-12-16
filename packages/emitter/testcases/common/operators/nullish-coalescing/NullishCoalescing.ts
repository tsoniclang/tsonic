export function getDefault(value: string | null | undefined): string {
  return value ?? "default";
}

export function getNumber(value: number | null): number {
  return value ?? 0;
}
