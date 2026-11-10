export const closedNativeNominalValuesSource = `
type Payload = object;
class Base {
  constructor(public count: number) {}
  read(): number { return this.count; }
}
class Derived extends Base { readonly label = "derived"; }
class Other { readonly label = "other"; }
class Envelope { constructor(public value: Payload) {} }
function pass(value: Payload): Payload { return value; }
function raise(value: Payload): never { throw value; }
export function run(): boolean {
  const original = new Derived(3);
  const envelope = new Envelope(pass(original));
  let caughtCount = 0;
  try { raise(envelope.value); } catch (caught) {
    if (!(caught instanceof Base)) return false;
    if (!(caught instanceof Derived)) return false;
    if (caught instanceof Other) return false;
    if (caught !== original || caught.count !== 3 || caught.label !== "derived") return false;
    caught.count = 7;
    if (original.read() !== 7) return false;
    caughtCount++;
  }
  const alias = pass(original);
  if (!(alias instanceof Base)) return false;
  if (alias instanceof Other) return false;
  alias.count = 9;
  if (original.read() !== 9 || alias !== original) return false;
  return caughtCount === 1;
}
`;
