/**
 * Generic Type Substitution Tests
 *
 * Tests that type parameters are correctly substituted with concrete types
 * in various contexts including function calls, property access, and method calls.
 */

import { int, long, byte } from "@tsonic/core/types.js";

// Simple generic container
interface Container<T> {
  value: T;
}

// Generic with multiple parameters
interface Pair<K, V> {
  key: K;
  value: V;
}

// Generic function returning T
function identity<T>(x: T): T {
  return x;
}

// Generic function with multiple type parameters
function makePair<K, V>(key: K, value: V): Pair<K, V> {
  return { key, value };
}

// Generic function returning Container<T>
function wrap<T>(value: T): Container<T> {
  return { value };
}

// Test: Basic substitution with int
function testIntSubstitution(): void {
  const container: Container<int> = { value: 42 as int };
  const extracted: int = container.value;
}

// Test: Basic substitution with long
function testLongSubstitution(): void {
  const container: Container<long> = { value: 9999999999 as long };
  const extracted: long = container.value;
}

// Test: Pair with mixed types
function testPairSubstitution(): void {
  const pair: Pair<string, int> = { key: "answer", value: 42 as int };
  const key: string = pair.key;
  const value: int = pair.value;
}

// Test: Generic function call with explicit type
function testExplicitTypeArg(): void {
  const result: int = identity<int>(10 as int);
}

// Test: Generic function returning generic type
function testWrappedInt(): void {
  const wrapped: Container<int> = wrap<int>(100 as int);
  const unwrapped: int = wrapped.value;
}

// Test: Nested generic types
function testNestedGenerics(): void {
  const outer: Container<Container<int>> = {
    value: { value: 5 as int },
  };
  const inner: Container<int> = outer.value;
  const final: int = inner.value;
}

// Test: Array of generic types
function testGenericArray(): void {
  const containers: Container<int>[] = [
    { value: 1 as int },
    { value: 2 as int },
    { value: 3 as int },
  ];
  const first: Container<int> = containers[0];
  const value: int = first.value;
}

// Generic class
class Box<T> {
  constructor(public content: T) {}

  getContent(): T {
    return this.content;
  }

  setContent(newContent: T): void {
    this.content = newContent;
  }
}

// Test: Generic class instantiation
function testGenericClass(): void {
  const intBox: Box<int> = new Box<int>(50 as int);
  const content: int = intBox.getContent();
  intBox.setContent(100 as int);
}

// Test: Generic class with long
function testGenericClassLong(): void {
  const longBox: Box<long> = new Box<long>(1000000000 as long);
  const content: long = longBox.getContent();
}

export {
  testIntSubstitution,
  testLongSubstitution,
  testPairSubstitution,
  testExplicitTypeArg,
  testWrappedInt,
  testNestedGenerics,
  testGenericArray,
  testGenericClass,
  testGenericClassLong,
};
