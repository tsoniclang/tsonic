# Rust source modules

## `@tsonic/rust/types.js`

### Primitive aliases

| Alias | Neutral meaning | Rust carrier |
| --- | --- | --- |
| `bool` | `bool` | `bool` |
| `i8`, `u8` | `int8`, `uint8` | `i8`, `u8` |
| `i16`, `u16` | `int16`, `uint16` | `i16`, `u16` |
| `i32`, `u32` | `int32`, `uint32` | `i32`, `u32` |
| `i64`, `u64` | `int64`, `uint64` | `i64`, `u64` |
| `i128`, `u128` | `int128`, `uint128` | `i128`, `u128` |
| `isize`, `usize` | `nativeInt`, `nativeUint` | `isize`, `usize` |
| `f32`, `f64` | `float32`, `float64` | `f32`, `f64` |

### Native type contracts

| Export | Meaning |
| --- | --- |
| `Life` | Kind used for authored Rust lifetime parameters |
| `Static` | Rust `'static` lifetime |
| `Placeholder` | Rust `'_` placeholder lifetime |
| `Ref<T, L>` | Shared native reference `&'l T` |
| `Mut<T, L>` | Mutable native reference `&'l mut T` |
| `Outlives<L>` | Lifetime outlives bound |
| `ValidFor<L>` | Type outlives bound `T: 'l` |
| `Dyn<T, L>` | Native trait object with an optional authored lifetime |
| `Capture<T>` | Exact opaque-type capture set |
| `Impl<T, C>` | Native opaque `impl Trait` contract with captures |
| `MaybeSized` | Rust `?Sized` generic bound |
| `scalar` | Exact Rust scalar-value contract, including Rust `char` |
| `constPtr<T>` | Native immutable raw pointer `*const T` |
| `mutPtr<T>` | Native mutable raw pointer `*mut T` |

## `@tsonic/rust/lang.js`

| Export | Meaning |
| --- | --- |
| `ref<T, L>(value)` | Form one exact shared native reference |
| `mut<T, L>(value)` | Form one exact mutable native reference |
| `load(reference)` | Read through an exact native reference |
| `store(reference, value)` | Write through an exact mutable native reference |

Portable ownership markers such as `sharedBorrow`, `mutableBorrow`, and
`move`, safe typed locations, native-pointer operations, `unsafeContext`, and
the safety builder remain owned by `@tsonic/core/*`. The Rust modules above
exist only for semantic controls that are intrinsically Rust-specific.

All listed modules are compiler-owned virtual declarations, not npm packages.
