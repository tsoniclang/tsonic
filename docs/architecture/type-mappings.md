# Type Mappings

## Core Numeric Mapping

- `number` -> `double`
- `int` -> `System.Int32`
- `long` -> `System.Int64`
- `float` -> `System.Single`
- `decimal` -> `System.Decimal`
- `bool` -> `bool`
- `char` -> `char`

## Collections

- TS arrays -> native C# arrays or surface/runtime helpers depending on context
- tuples -> `ValueTuple`
- dictionaries/sets -> explicit CLR or JS/runtime-backed shapes depending on the authoring surface and target type

## Surface Effect

Surface changes the ambient API, not the meaning of explicit CLR imports.

Example:

```ts
// @tsonic/js surface
const xs = [1, 2, 3];
xs.map((x) => x + 1);
```

still lowers through deterministic runtime/binding machinery, not by pretending CLR APIs were authored directly.

## Object Literals

Finite structural object literals can lower to:

- synthesized nominal helper types
- dictionaries / object bags

depending on contextual target and representability.

## Promise Types

Promise-like TS shapes map to task-like CLR shapes after normalization. Promise chain callbacks normalize to the inner result type before backend generic selection.
