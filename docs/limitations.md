# Limitations

These are the deliberate current non-goals or still-rejected cases on `main`.

## Open-World Dynamic Import

Rejected:

```ts
const mod = await import(specifier);
const pkg = await import("zod");
```

Reason: no closed-world module graph.

## `import.meta` Beyond the Supported Subset

Supported:

- `import.meta`
- `import.meta.url`
- `import.meta.filename`
- `import.meta.dirname`

Rejected:

```ts
const env = import.meta.env;
```

## Generic Function Values With No Runtime Shape

Rejected:

```ts
const id = <T>(x: T): T => x;
const copy = id;
```

Reason: the value remains polymorphic with no monomorphic callable runtime shape.

## Object-Literal `super`

Rejected:

```ts
const obj = {
  __proto__: base,
  greet() {
    return super.greet();
  },
};
```

Reason: requires full JS home-object/prototype semantics that Tsonic does not currently model.

## Unsupported Object-Literal `arguments` Cases

Some narrow `arguments.length` / `arguments[index]` patterns are supported in object-literal methods. Broader JS function-object behavior is still rejected.

## Explicit `any`

Tsonic remains strict-AOT. Explicit `any` is out of scope.

## General npm Ecosystem Execution

Tsonic V1 supports:

- CLR bindings packages
- Tsonic-authored source packages with manifests

It does **not** claim full execution compatibility for arbitrary npm JS/TS packages.
