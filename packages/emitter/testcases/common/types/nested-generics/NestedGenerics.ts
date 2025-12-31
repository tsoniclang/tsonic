/**
 * Nested Generic Type Tests
 *
 * Tests complex nested generic scenarios including:
 * - Container<Container<T>>
 * - Map<K, List<V>>
 * - Generic methods on generic classes
 * - Generic inheritance chains
 */

import { int, long } from "@tsonic/core/types.js";

// Level 1: Simple container
interface Box<T> {
  item: T;
}

// Level 2: Container of containers
interface NestedBox<T> {
  outer: Box<Box<T>>;
}

// Triple nesting
interface DeepBox<T> {
  deep: Box<Box<Box<T>>>;
}

// Generic with array element
interface ListContainer<T> {
  items: T[];
  count: int;
}

// Nested array generics
interface MatrixContainer<T> {
  rows: T[][];
  rowCount: int;
  colCount: int;
}

// Test: Double nesting with int
function testDoubleNesting(): void {
  const nested: Box<Box<int>> = {
    item: { item: 42 as int },
  };
  const inner: Box<int> = nested.item;
  const value: int = inner.item;
}

// Test: Triple nesting with int
function testTripleNesting(): void {
  const deep: Box<Box<Box<int>>> = {
    item: { item: { item: 100 as int } },
  };
  const mid: Box<Box<int>> = deep.item;
  const inner: Box<int> = mid.item;
  const value: int = inner.item;
}

// Test: NestedBox structure
function testNestedBoxStructure(): void {
  const container: NestedBox<long> = {
    outer: {
      item: { item: 9999999999 as long },
    },
  };
  const outerBox: Box<Box<long>> = container.outer;
  const innerBox: Box<long> = outerBox.item;
  const value: long = innerBox.item;
}

// Test: DeepBox structure
function testDeepBoxStructure(): void {
  const container: DeepBox<int> = {
    deep: {
      item: {
        item: { item: 7 as int },
      },
    },
  };
  const value: int = container.deep.item.item.item;
}

// Test: Array inside generic
function testArrayInGeneric(): void {
  const listContainer: ListContainer<int> = {
    items: [1 as int, 2 as int, 3 as int],
    count: 3 as int,
  };
  const items: int[] = listContainer.items;
  const first: int = items[0];
}

// Test: Nested array in generic
function testNestedArrayInGeneric(): void {
  const matrix: MatrixContainer<int> = {
    rows: [
      [1 as int, 2 as int],
      [3 as int, 4 as int],
    ],
    rowCount: 2 as int,
    colCount: 2 as int,
  };
  const firstRow: int[] = matrix.rows[0];
  const cell: int = firstRow[0];
}

// Generic class with generic method
class Wrapper<T> {
  constructor(private wrapped: T) {}

  get(): T {
    return this.wrapped;
  }

  // Generic method with different type parameter
  map<U>(fn: (value: T) => U): Wrapper<U> {
    return new Wrapper<U>(fn(this.wrapped));
  }
}

// Test: Generic class with generic method
function testGenericMethod(): void {
  const intWrapper: Wrapper<int> = new Wrapper<int>(10 as int);
  const value: int = intWrapper.get();

  // Map int to string
  const stringWrapper: Wrapper<string> = intWrapper.map<string>((n: int) =>
    n.toString()
  );
}

// Generic extending generic
interface Identifiable<T> {
  id: T;
}

interface NamedEntity<T> extends Identifiable<T> {
  name: string;
}

// Test: Generic inheritance
function testGenericInheritance(): void {
  const entity: NamedEntity<int> = {
    id: 123 as int,
    name: "Test Entity",
  };
  const id: int = entity.id;
  const name: string = entity.name;
}

// Multiple type parameters with nesting
interface Result<T, E> {
  value: T | undefined;
  error: E | undefined;
  isSuccess: boolean;
}

interface NestedResult<T, E> {
  result: Result<T, E>;
  metadata: Box<string>;
}

// Test: Multiple type parameters
function testMultipleTypeParams(): void {
  const result: Result<int, string> = {
    value: 42 as int,
    error: undefined,
    isSuccess: true,
  };

  const nested: NestedResult<int, string> = {
    result: result,
    metadata: { item: "success" },
  };
}

export {
  testDoubleNesting,
  testTripleNesting,
  testNestedBoxStructure,
  testDeepBoxStructure,
  testArrayInGeneric,
  testNestedArrayInGeneric,
  testGenericMethod,
  testGenericInheritance,
  testMultipleTypeParams,
};
