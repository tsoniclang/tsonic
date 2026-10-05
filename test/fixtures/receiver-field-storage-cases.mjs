export const receiverFieldStorageCases = [
  {
    name: "direct-mutable-and-readonly-view",
    source: `
      class Value { value = 1; read = (): number => this.value; }
      function inspect(view: { readonly value: number }): number { return view.value; }
      function change(view: { value: number }, next: number): void { view.value = next; }
      export function run(): boolean {
        const value = new Value();
        const retained = value.read;
        const alias = value;
        change(alias, 7);
        return inspect(value) === 7 && retained() === 7;
      }
    `,
  },
  {
    name: "generic-deferred-non-copy-view",
    source: `
      interface View<Value> { value: Value; }
      class Box<Value> {
        value: Value;
        read = (): Value => this.value;
        constructor(value: Value) { this.value = value; }
      }
      function inspect<Value>(view: Readonly<View<Value>>): Value { return view.value; }
      function change<Value>(view: View<Value>, next: Value): void { view.value = next; }
      export function run(): boolean {
        const value = new Box("first");
        const read = value.read;
        change(value, "second");
        return inspect(value) === "second" && read() === "second";
      }
    `,
  },
  {
    name: "retained-structural-getter-reenters-parent",
    source: `
      interface Child { readonly value: number; }
      class Parent {
        child: Child = { value: 1 };
        read = (): number => this.child.value;
      }
      class Getter {
        constructor(private readonly visit: () => number) {}
        get value(): number { return this.visit(); }
      }
      export function run(): boolean {
        const parent = new Parent();
        let visits = 0;
        parent.child = new Getter(() => { visits++; parent.child = { value: 7 }; return 3; });
        return parent.read() === 3 && parent.read() === 7 && visits === 1;
      }
    `,
  },
];

export const receiverFieldStorageFreezeSource = `
  class Value { value = "first"; read = (): string => this.value; }
  function change(view: { value: string }): void { view.value = "second"; }
  export function run(): boolean {
    const value = new Value();
    const view: { value: string } = value;
    Object.freeze(view);
    try { change(view); return false; } catch {}
    return value.read() === "first" && value.value === "first";
  }
`;
