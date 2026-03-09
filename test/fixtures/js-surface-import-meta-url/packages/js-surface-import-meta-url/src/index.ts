export function main(): void {
  const total =
    import.meta.url.length +
    import.meta.filename.length +
    import.meta.dirname.length;
  console.log(total > 0);
}
