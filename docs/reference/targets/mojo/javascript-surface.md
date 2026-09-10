# Mojo JavaScript surface

Select `surfaces: ["js"]` to use the target's JavaScript source declarations
and the `@tsonic/mojo-js` runtime. Native Mojo is the default profile.

```ts
export function joined(values: string[]): string {
  return values.join(", ");
}
```

The selected array operation supplies the required runtime contract. This is
not JavaScript evaluation inside a VM.

Native strings remain the normal carrier. Explicit `JsString` values have a
separate UTF-16 contract; a surface selection is not a blanket conversion of
native strings into UTF-16 objects. Array joining/default sorting preserve
their selected source coercions and ordering. Literal and dynamic regular
expressions use the JavaScript runtime's RegExp implementation.

The [support inventory](support-inventory.md) identifies executable proof
families. It is not a claim that every ECMAScript API or locale behavior exists.
