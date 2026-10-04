export const deferredCapturesSource = `
class Item { size: number; constructor(size: number) { this.size = size; } }
let pending: (() => number) | undefined;
function hold(callback: () => number): Item { pending = callback; return new Item(7); }
export function run(): boolean {
  const item = hold(() => item.size);
  if ((pending?.() ?? 0) !== 7) return false;
  item.size = 11;
  if ((pending?.() ?? 0) !== 11) return false;
  const read = () => forward.size;
  const forward = new Item(13);
  if (read() !== 13) return false;
  forward.size = 17;
  if (read() !== 17) return false;
  const initialized = new Item(19);
  const direct = () => initialized.size;
  return direct() === 19;
}
`;
