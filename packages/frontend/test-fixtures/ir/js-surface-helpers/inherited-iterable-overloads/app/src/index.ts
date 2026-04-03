export function main(length: number): void {
  const copy = new Uint8Array();
  copy.set(copy, length);
}
