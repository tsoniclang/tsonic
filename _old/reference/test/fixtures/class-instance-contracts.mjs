export const classInstanceContractSource = `
abstract class Root {
  abstract readonly label: string;
  abstract read(): number;
}
interface Reader extends Root { change(value: number): void; }
interface TaggedReader extends Reader { tag: number; }
class NativeReader extends Root implements TaggedReader {
  readonly label: string = "native";
  tag: number = 2;
  value: number = 3;
  read(): number { return this.value; }
  change(value: number): void { this.value = value; }
}
class PublicBase {
  value: number = 7;
  read(): number { return this.value; }
}
interface PublicReader extends PublicBase { label: string; }
class SeparateReader implements PublicReader {
  value: number = 9;
  label: string = "separate";
  read(): number { return this.value; }
}
class DerivedReader extends PublicBase implements PublicReader {
  label: string = "derived";
}
function use(reader: TaggedReader): boolean {
  const alias: Root = reader;
  reader.change(11);
  return alias.read() === 11 && reader.label === "native" && reader.tag === 2 &&
    reader instanceof Root && reader instanceof NativeReader;
}
function isBase(reader: PublicReader): boolean { return reader instanceof PublicBase; }
function asBase(reader: PublicBase): boolean { return reader instanceof PublicBase; }
export function run(): boolean {
  const native = new NativeReader();
  const separate = new SeparateReader();
  const derived = new DerivedReader();
  const alias: PublicReader = separate;
  alias.value = 13;
  return use(native) && native.read() === 11 && alias.read() === 13 &&
    !isBase(separate) && isBase(derived) && !asBase(alias) && asBase(derived);
}
`;
