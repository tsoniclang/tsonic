export const nullishMemberStorageSource = `
class Value {
  kind: string;
  constructor(kind: string) { this.kind = kind; }
}
class NullValue extends Value {
  value: null;
  missing: undefined;
  nullable: string | null;
  optional: string | undefined;
  constructor() {
    super("null");
    this.value = null;
    this.missing = undefined;
    this.nullable = null;
    this.optional = undefined;
  }
}
let effects = 0;
function selected(value: NullValue): NullValue { effects++; return value; }
let order = "";
function nil(): null { order += "n"; return null; }
function absent(): undefined { order += "u"; return undefined; }
function present(text: string): boolean { return text !== undefined && text !== null; }
export function run(): boolean {
  const value = new NullValue();
  const record: { value: null; missing: undefined } = { value: null, missing: undefined };
  effects = 0;
  const exact = selected(value).value === null && selected(value).missing === undefined;
  order = "";
  const comparisons = nil() === nil() && absent() === absent() &&
    nil() !== absent() && absent() !== nil() &&
    nil() == absent() && absent() == nil() &&
    !(nil() != absent()) && !(absent() != nil());
  const ordered = order === "nnuunuunnuunnuun";
  const nullable = value.nullable === null && value.optional === undefined;
  value.nullable = "present";
  value.optional = "present";
  const present = value.nullable === "present" && value.optional === "present";
  value.nullable = null;
  value.optional = undefined;
  return present("text") && exact && comparisons && ordered && effects === 2 && record.value === null && record.missing === undefined &&
    nullable && present && value.nullable === null && value.optional === undefined;
}
`;
