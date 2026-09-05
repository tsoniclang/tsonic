# Project creator

`create-tsonic` creates, installs, and validates one complete project:

```sh
npm create tsonic@latest <directory> -- --target <target-id>
```

For example:

```sh
npm create tsonic@latest server -- --target csharp
npm create tsonic@latest tool -- --target rust
```

## Options

| Option | Meaning |
| --- | --- |
| `--target <id>` | Required target id, such as `csharp` or `rust` |
| `--surface <id>` | Explicit source surface; repeat for more than one |
| `--help` | Print command help |

The destination must not exist. Its final path segment must be a lowercase
unscoped npm package name beginning with a letter.

## Transaction

The creator:

1. creates a private sibling staging directory;
2. writes a minimal npm package selecting the same release-wave version of the
   CLI and `@tsonic/target-<id>`;
3. runs `npm install`;
4. loads the installed target's immutable starter descriptor;
5. validates its target selection, scripts, files, paths, and toolchain checks;
6. verifies the native toolchain;
7. writes `tsonic.json`, `.gitignore`, and target-owned source;
8. atomically renames the staging directory to the requested destination.

An error removes the private staging directory and leaves the requested
destination absent. Existing paths are never overwritten.

## Ownership

The creator knows only the target id and the generic starter contract. The
selected target package owns starter source, target options, native commands,
and SDK requirements. The creator does not contain C#, Rust, .NET, or Cargo
branches.

`create-tsonic` does not install native SDKs. Missing requirements produce the
failed command, exact remediation, and an official installation URL.
