# Tsonic manual

Tsonic compiles TypeScript into native source projects. The manual starts with
a complete program, then explains the few choices that affect what gets built.

## Start here

1. [Build your first program](get-started.md).
2. Learn [how projects and configuration work](projects.md).
3. Choose between an [application and a library](applications-and-libraries.md).
4. Organize [packages and workspaces](packages-and-workspaces.md).
5. [Build, test, and deploy](build-test-deploy.md) with the native toolchain.

Then read the parts that apply to your code:

- [Compiler model](compiler-model.md)
- [Source semantics](source-semantics.md)
- [Surfaces and capabilities](surfaces-and-capabilities.md)
- [C# target](targets/csharp/README.md)
- [Rust target](targets/rust/README.md)
- [Troubleshooting](troubleshooting.md)

The [reference](../reference/README.md) contains exact option, marker, API, and
limitation contracts.

Most TypeScript needs no Tsonic-specific syntax:

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

Use a marker only when ordinary TypeScript cannot state an important native
distinction, such as an exact integer width, a writable location, a native
pointer, or a Rust lifetime.
