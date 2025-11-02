export function isValid(name: string, age: number): boolean {
  return name.length > 0 && age >= 18;
}

export function getDisplayName(name: string | null): string {
  return name || "Anonymous";
}

export function classify(age: number): string {
  return age >= 18 ? "adult" : "minor";
}
