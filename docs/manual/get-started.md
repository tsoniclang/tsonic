# Get started

Create, compile, and run a C# or Rust application from an empty directory.

## Requirements

Install [Node.js 22.18 or newer](https://nodejs.org/en/download). The official
installer includes npm.

```sh
node --version
npm --version
```

For C#, install the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0),
not only the runtime.

```sh
dotnet --version
dotnet --list-sdks
```

For Rust, use the [official rustup installer](https://www.rust-lang.org/tools/install),
then install `rustfmt` in the active toolchain.

```sh
rustup toolchain install stable
rustup default stable
rustup component add rustfmt
```

The project creator checks the selected native toolchain before publishing the
new project directory. If a requirement is missing, it reports the failed
command and the official installation route. It never installs or changes a
native SDK.

## Create a C# application

```sh
npm create tsonic@latest hello-csharp -- --target csharp
cd hello-csharp
npm start
```

The first command installs the project-local CLI and C# target and creates:

```text
hello-csharp/
├── .gitignore
├── package.json
├── package-lock.json
├── tsonic.json
└── src/
    └── App.ts
```

The starter source uses the native C# profile:

```ts
import { Console } from "@tsonic/dotnet/System.js";

Console.WriteLine("Hello from hello-csharp!");
```

`npm start` runs Tsonic and then `dotnet run`. Generated C# and its `.csproj`
are under `out/csharp/`.

## Create a Rust application

```sh
npm create tsonic@latest hello-rust -- --target rust
cd hello-rust
npm start
```

The starter exports the Rust binary entry:

```ts
export function main(): void {
  const answer = 40 + 2;
  if (answer !== 42) {
    throw new Error("unexpected answer");
  }
}
```

`npm start` runs Tsonic and then Cargo. Generated Rust and `Cargo.toml` are
under `out/rust/`.

## Project commands

Every created project contains the same three scripts:

```sh
npm run build
npm run check
npm start
```

- `build` generates the target-native source project.
- `check` generates it and runs the target's native build check.
- `start` generates it and runs the native application.

Commit `package.json`, `package-lock.json`, `tsonic.json`, and authored source.
The generated `.gitignore` excludes `node_modules/`, `out/`, and `.tsonic/`.

## Select the JavaScript surface

Select a source surface while creating the project:

```sh
npm create tsonic@latest hello-js -- --target rust --surface js
```

The resulting `tsonic.json` contains `"surfaces": ["js"]`. JavaScript globals
and built-ins are then available:

```ts
export function main(): void {
  console.log([1, 2, 3].map((value) => value * 2).join(","));
}
```

The JS surface is explicit. Selecting a target does not enable it implicitly.

## Add Node APIs

Node is an installed target capability. Add the package matching the project:

```sh
# C#
npm install --save-dev @tsonic/csharp-nodejs@^0.1.0

# Rust
npm install --save-dev @tsonic/rust-nodejs@^0.1.0
```

Use standard Node module specifiers:

```ts
import { readFileSync } from "node:fs";

const text = readFileSync("message.txt", "utf8");
```

An imported `node:*` module activates only that installed capability module.
Installing Node support does not enable the JavaScript surface.

## Existing and advanced projects

The creator is the default path for a new application. For multiple targets,
workspaces, libraries, or user-owned `.csproj` and `Cargo.toml` files, continue
with [projects and configuration](projects.md) and
[applications and libraries](applications-and-libraries.md).
