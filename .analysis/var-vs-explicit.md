---
  Detailed Analysis of feat/explicit-type-emission vs main

  Summary

  | Category                             | Count       |
  |--------------------------------------|-------------|
  | Source files modified                | 5           |
  | Unit test files modified             | 2           |
  | New golden test inputs               | 18          |
  | New golden test expected outputs     | 18          |
  | Updated golden test expected outputs | 6           |
  | New E2E test                         | 1 (5 files) |
  | Other                                | 2           |
  | Total lines                          | +655 / -63  |

  ---
  1. SOURCE CODE CHANGES

  1.1 collections.ts - Array Literal Emission

  Change: new[] → new T[]

  // BEFORE (main)
  new[] { 1, 2, 3 }

  // AFTER (feature)
  new int[] { 1, 2, 3 }

  Also: Pass expectedElementType to each element so literals get proper suffixes.

  Why needed: For long[] arrays, C# can't infer from new[] { 1, 2, 3 }. Need new long[] { 1L, 2L, 3L }.

  ---
  1.2 literals.ts - Numeric Suffix Support

  New function: getNumericSuffix(typeName)

  case "long": return "L";
  case "uint": return "U";
  case "ulong": return "UL";
  case "float": return "f";
  case "decimal": return "m";
  default: return "";  // int, byte, short, double - no suffix

  Change: When emitting a number literal with an expectedType, append the appropriate suffix.

  Examples:
  - long[] elements: 1 → 1L
  - float[] elements: 1.5 → 1.5f
  - decimal[] elements: 1.5 → 1.5m

  ---
  1.3 variables.ts - Variable Type Emission

  New function: canEmitTypeExplicitly(type) - Recursively checks if a type can be emitted (rejects any, objectType, tuples/arrays/unions
  containing them).

  Change in static context: Added canEmitTypeExplicitly(decl.type) guard to skip anonymous object types.

  Change in non-static context:
  // BEFORE (main)
  varDecl += "var ";

  // AFTER (feature)
  if (decl.initializer?.kind === "literal") {
    // Emit explicit type based on numericIntent
    // string → "string", number → int/double, boolean → "bool"
  } else {
    varDecl += "var ";
  }

  Result:
  - const x = 10; → int x = 10; (was var x = 10;)
  - const x = 10.5; → double x = 10.5; (was var x = 10.5;)
  - const x = func(); → var x = func(); (unchanged)

  ---
  1.4 numeric-proof-pass.ts - Comparison Operator Bug Fix

  New constant: NUMERIC_RESULT_OPERATORS - Set of operators that return numeric types (arithmetic + bitwise).

  Bug fixed: Comparison operators (<, >, <=, >=, ==, !=, ===, !==) were incorrectly getting numeric inferredType annotations.

  Fix: Skip numeric type annotation for comparison operators - they return boolean, not int.

  ---
  2. UNIT TEST CHANGES

  2.1 array.test.ts

  Updated expectations from new[] to new T[]:
  - new[] { 1, 2, 3 } → new double[] { 1, 2, 3 }
  - new[] { 1, default, 3 } → new double[] { 1, default, 3 }
  - new[] { "hello", "world" } → new string[] { "hello", "world" }

  2.2 index.test.ts

  - new[] { 1, 2, 3 } → new int[] { 1, 2, 3 }

  ---
  3. NEW GOLDEN TESTS (18)

  All in testcases/common/arrays/explicit-types/:

  | File                         | Input                                       | Expected Output                                  |
  |------------------------------|---------------------------------------------|--------------------------------------------------|
  | IntArrayLiteral.ts           | int[] = [1,2,3]                             | new int[] { 1, 2, 3 }                            |
  | LongArrayLiteral.ts          | long[] = [1,2,3]                            | new long[] { 1L, 2L, 3L }                        |
  | FloatArrayLiteral.ts         | float[] = [1,2,3]                           | new float[] { 1f, 2f, 3f }                       |
  | DecimalArrayLiteral.ts       | decimal[] = [1,2,3]                         | new decimal[] { 1m, 2m, 3m }                     |
  | UintArrayLiteral.ts          | uint[] = [1,2,3]                            | new uint[] { 1U, 2U, 3U }                        |
  | UlongArrayLiteral.ts         | ulong[] = [1,2,3]                           | new ulong[] { 1UL, 2UL, 3UL }                    |
  | ByteArrayLiteral.ts          | byte[] = [1,2,3]                            | new byte[] { 1, 2, 3 }                           |
  | ShortArrayLiteral.ts         | short[] = [1,2,3]                           | new short[] { 1, 2, 3 }                          |
  | SbyteArrayLiteral.ts         | sbyte[] = [1,2,3]                           | new sbyte[] { 1, 2, 3 }                          |
  | UshortArrayLiteral.ts        | ushort[] = [1,2,3]                          | new ushort[] { 1, 2, 3 }                         |
  | DoubleArrayLiteral.ts        | number[] = [1,2,3]                          | new double[] { 1, 2, 3 }                         |
  | StringArrayExplicit.ts       | string[] = ["a","b","c"]                    | new string[] { "a", "b", "c" }                   |
  | NestedLongArray.ts           | long[][] = [[1,2],[3,4]]                    | new long[][] { new long[] { 1L, 2L }, ... }      |
  | NestedFloatArray.ts          | float[][] = [[1.5,2.5],...]                 | new float[][] { new float[] { 1.5f, ... }, ... } |
  | ThreeDimensionalLongArray.ts | long[][][]                                  | 3D with L suffixes                               |
  | MixedFloatLiterals.ts        | float[] = [1, 2.5, 3]                       | new float[] { 1f, 2.5f, 3f }                     |
  | EmptyArrayTypes.ts           | Empty long[], float[], decimal[]            | Array.Empty<T>()                                 |
  | VariableInference.ts         | const x=10; const y=10.5; const arr=[1,2,3] | int x; double y; var arr                         |

  ---
  4. UPDATED GOLDEN TESTS (6)

  | File                | Change                                                        |
  |---------------------|---------------------------------------------------------------|
  | ArrayLiteral.cs     | new[] → new int[]                                             |
  | MultiDimensional.cs | new[] { new[] {...} } → new double[][] { new double[] {...} } |
  | NestedScopes.cs     | var a = 10 → int a = 10 (×3 variables)                        |
  | Shadowing.cs        | var x = 10 → int x = 10 (×4 variables)                        |
  | Closures.cs         | var count = 0 → int count = 0                                 |
  | TypeAssertions.cs   | Added L suffix for long, f suffix for float                   |
  | VariableDecls.cs    | var → explicit types for literals, added suffixes             |

  ---
  5. NEW E2E TEST

  test/fixtures/array-type-emission/ - Tests all numeric array types compile and run:
  - int[], long[], byte[], short[], sbyte[], ushort[]
  - float[], double[], decimal[]
  - uint[], ulong[]
  - 2D arrays: long[][], float[][]

  ---
  6. KEY OBSERVATIONS

  What WAS Needed:

  1. ✅ new[] → new T[] for arrays (required for long[], float[], etc.)
  2. ✅ Literal suffixes (L, f, m, U, UL) for non-default numeric types
  3. ✅ Comparison operator bug fix

  What Was OPTIONAL (but done):

  4. ⚠️ var x = 10 → int x = 10 for literal initializers

  The var → explicit type change for literals is unnecessary - C# correctly infers int from var x = 10. However, it doesn't break anything and
  is more explicit.