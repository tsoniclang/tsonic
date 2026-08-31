# C# source modules

## `@tsonic/csharp/types.js`

| Alias | Neutral meaning | C# carrier |
| --- | --- | --- |
| `bool` | `bool` | `bool` |
| `char` | `char` | `char` |
| `byte`, `sbyte` | `uint8`, `int8` | `byte`, `sbyte` |
| `short`, `ushort` | `int16`, `uint16` | `short`, `ushort` |
| `int`, `uint` | `int32`, `uint32` | `int`, `uint` |
| `long`, `ulong` | `int64`, `uint64` | `long`, `ulong` |
| `nint`, `nuint` | `nativeInt`, `nativeUint` | `nint`, `nuint` |
| `float`, `double` | `float32`, `float64` | `float`, `double` |
| `decimal` | `decimal` | `decimal` |

## `@tsonic/csharp/lang.js`

| Export | Meaning |
| --- | --- |
| `out(value)` | Write-only reference argument |
| `ref(value)` | Read/write reference argument |
| `inref(value)` | Readonly reference argument |
| `struct(shape)` | C#-flavoured alias for neutral struct semantics |
| `field<T>()` | C#-flavoured alias for neutral field semantics |
| `attribute<T>()` | C#-flavoured alias for neutral attribute builder |
| `defaultof<T>()` | C#-flavoured target default |
| `ptr<T>` | Native C# pointer type |
| `fnptr<TArgs, TReturn>` | Native C# function-pointer type |
| `unsafe()` / `unsafe(expression)` | C#-flavoured explicit unsafe context |
| `safety<T>()` | C#-flavoured declaration safety builder |
| `Array2<T>` … `Array8<T>` | Exact CLR rectangular-array contracts |

These modules are compiler-owned virtual declarations, not npm packages.
