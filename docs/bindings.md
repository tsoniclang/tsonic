# Bindings

Tsonic uses explicit packages for both authored source-package interop and CLR
interop.

## The four binding families

### 1. Authored first-party source packages

- `@tsonic/js`
- `@tsonic/nodejs`
- `@tsonic/express`

These:

- carry `tsonic.package.json`
- expose TypeScript source directly
- are compiled transitively into the same program

### 2. Generated CLR binding packages

- `@tsonic/dotnet`
- `@tsonic/aspnetcore`
- `@tsonic/microsoft-extensions`
- `@tsonic/efcore*`

These:

- come from `tsbindgen`
- project CLR namespaces and members into declaration packages
- are imported explicitly for CLR interop

### 3. Local DLL references

Added with:

```bash
tsonic add package ./libs/MyLib.dll
```

These can either:

- use an explicit types package
- or have a bindings package generated automatically through `tsbindgen`

### 4. Workspace framework/NuGet references

Added with:

```bash
tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
tsonic add nuget Microsoft.EntityFrameworkCore 10.0.0
```

These are workspace-scoped CLR dependencies.

## Runtime metadata from source packages

Some first-party source packages also contribute runtime metadata.

For example, `@tsonic/nodejs` can add:

- framework references
- runtime package requirements

through its manifest. The workspace then resolves those through the normal
restore/build flow.

## The key distinction

Authored source packages and generated CLR binding packages both look like npm
packages to a user, but they are not owned or validated the same way.

That is why the current docs keep them separate.

## Read next

- [Surfaces and Packages](surfaces-and-packages.md)
- [CLR Bindings and Interop](dotnet-bindings.md)
