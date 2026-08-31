# Get started

This guide builds one C# program and one Rust program. Each starts from an
empty directory.

## Requirements

- Node.js 22.18 or newer
- npm
- .NET 10 SDK for C#
- `cargo`, `rustc`, and `rustdoc` for Rust

Tsonic generates source code. `dotnet` or Cargo performs the native build.

## Build a C# application

Create this directory:

```text
hello-csharp/
├── package.json
├── tsonic.json
└── src/
    └── App.ts
```

Create `package.json`:

```json
{
  "name": "hello-csharp",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsonic build --project tsonic.json",
    "run": "dotnet run --project out/csharp/HelloCsharp.csproj"
  },
  "devDependencies": {
    "@tsonic/cli": "0.0.1",
    "@tsonic/target-csharp": "0.0.1"
  }
}
```

Create `src/App.ts`:

```ts
import { Console } from "@tsonic/dotnet/System.js";

function message(name: string): string {
  return `Hello, ${name}!`;
}

Console.WriteLine(message("C#"));
```

Create `tsonic.json`:

```json
{
  "entryPoint": "App.ts",
  "rootDir": "src",
  "outDir": "out",
  "targets": [{
    "id": "csharp",
    "options": {
      "assemblyName": "HelloCsharp",
      "namespace": "Hello.Generated",
      "outputType": "Exe"
    }
  }]
}
```

Install, compile, and run:

```sh
npm install
npm run build
npm run run
```

Output:

```text
Hello, C#!
```

The generated C# entrypoint runs the TypeScript entry module. Top-level code is
therefore the C# application entry. An exported function named `main` has no
special meaning unless your source calls it.

## Build a Rust application

Create the same three-file layout in `hello-rust/`.

Create `package.json`:

```json
{
  "name": "hello-rust",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsonic build --project tsonic.json",
    "run": "cargo run --manifest-path out/rust/Cargo.toml"
  },
  "devDependencies": {
    "@tsonic/cli": "0.0.1",
    "@tsonic/target-rust": "0.0.1"
  }
}
```

Create `src/App.ts`:

```ts
export function main(): void {
  const answer = 40 + 2;
  if (answer !== 42) {
    throw new Error("unexpected answer");
  }
}
```

Create `tsonic.json`:

```json
{
  "entryPoint": "App.ts",
  "rootDir": "src",
  "outDir": "out",
  "targets": [{
    "id": "rust",
    "options": {
      "crateName": "hello_rust",
      "edition": "2024",
      "outputType": "bin"
    }
  }]
}
```

Install, compile, and run:

```sh
npm install
npm run build
npm run run
```

A generated Rust binary requires the entry module to export `main(): void`.
Tsonic creates native Rust `main` and calls that exported function after module
initialization.

## Use JavaScript APIs

Add `"surfaces": ["js"]` to a target when the source uses JavaScript globals
and built-ins:

```json
{
  "id": "rust",
  "surfaces": ["js"],
  "options": {
    "crateName": "hello_rust",
    "outputType": "bin"
  }
}
```

```ts
export function main(): void {
  console.log([1, 2, 3].map((value) => value * 2).join(","));
}
```

## Use Node APIs

Node is an installed capability, not a source surface:

```sh
# Choose the package for the selected target.
npm install --save-dev @tsonic/csharp-nodejs
npm install --save-dev @tsonic/rust-nodejs
```

```ts
import { readFileSync } from "node:fs";

const text = readFileSync("message.txt", "utf8");
```

Installing a Node capability does not enable JavaScript globals. Select the JS
surface separately only when the program uses it.

## Next

- [Projects and configuration](projects.md)
- [Applications and libraries](applications-and-libraries.md)
- [C# target manual](targets/csharp/README.md)
- [Rust target manual](targets/rust/README.md)
