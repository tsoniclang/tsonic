export function capitalize(str: string): string {
  if (str.length === 0) {
    return str;
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function reverse(str: string): string {
  return str.split("").reverse().join("");
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + "...";
}

export function countWords(str: string): number {
  return str.trim().split(/\s+/).length;
}

export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === reverse(cleaned);
}

// Generic array utilities using idiomatic C# TryGet pattern
export function tryFirst<T>(arr: T[], result: out<T>): boolean {
  if (arr.length === 0) {
    return false;
  }
  result = arr[0];
  return true;
}

export function tryLast<T>(arr: T[], result: out<T>): boolean {
  if (arr.length === 0) {
    return false;
  }
  result = arr[arr.length - 1];
  return true;
}

export function unique<T>(arr: T[]): T[] {
  return arr.filter(
    (item: T, index: number): boolean => arr.indexOf(item) === index
  );
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
