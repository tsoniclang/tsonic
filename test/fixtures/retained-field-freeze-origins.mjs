export const retainedFieldFreezeOrigins = [
  { name: "nominal-alias", declarations:
    "function freeze(value: Value): void { const alias = value; Object.freeze(alias); }", invocation: "freeze(value);" },
  { name: "structural-chain", declarations: `
function freeze(value: { value: number }): void { Object.freeze(value); }
function relay(value: { value: number; label: string }): void { freeze(value); }
`, invocation: "relay(value);" },
  { name: "interface", declarations:
    "interface View { value: number; } function freeze(value: View): void { Object.freeze(value); }", invocation: "freeze(value);" },
  { name: "narrowed-union", declarations: `
class Other { other = 1; }
function freeze(value: Value | Other): void {
  if (value instanceof Value) Object.freeze(value);
  else Object.freeze(value);
}
`, invocation: "freeze(value);" },
];

export const retainedFieldFreezeValueSource = `
class Value {
  value = 1;
  label = "value";
  read = (): number => this.value;
  change = (): void => { this.value = 2; };
}
`;

export const retainedFieldGenericFreezeSource = `
class Base<T> {
  value: T;
  constructor(value: T) { this.value = value; }
  read = (): T => this.value;
  change = (next: T): void => { this.value = next; };
}
class Value extends Base<number> { constructor() { super(1); } }
function freeze<T>(value: { value: T }): void { Object.freeze(value); }
export function run(): boolean {
  const value = new Value();
  const read = value.read;
  const change = value.change;
  freeze(value);
  let failed = false;
  try { change(2); } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    failed = true;
  }
  return failed && read() === 1 && value.value === 1 && Object.isFrozen(value);
}
`;

export function retainedFieldFreezeOriginSource(declarations, invocation) {
  return `${retainedFieldFreezeValueSource}
${declarations}
export function run(): boolean {
  const value = new Value();
  const read = value.read;
  const change = value.change;
  ${invocation}
  let failed = false;
  try { change(); } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    failed = true;
  }
  return failed && read() === 1 && value.value === 1 && Object.isFrozen(value);
}
`;
}
