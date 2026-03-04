export function main(): void {
  const message = "  hello  ".trim();
  const upper = message.toUpperCase();
  const parsed = parseInt("42");

  console.log(upper);
  if (parsed !== undefined) {
    console.log(parsed);
  }
}
