/**
 * Generic Chains E2E Test
 *
 * Tests complex generic type chains including:
 * - Chained method calls preserving type parameters
 * - Multiple levels of generic nesting
 * - Generic constraints and bounds
 * - Return type propagation through generic methods
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int, long } from "@tsonic/core/types.js";

// ============ Type Definitions ============

interface Container<T> {
  value: T;
}

interface Pair<K, V> {
  first: K;
  second: V;
}

interface Triple<A, B, C> {
  a: A;
  b: B;
  c: C;
}

// Deeply nested container
interface DeepContainer<T> {
  level1: Container<Container<T>>;
}

// ============ Generic Functions ============

function identity<T>(x: T): T {
  return x;
}

function first<K, V>(pair: Pair<K, V>): K {
  return pair.first;
}

function second<K, V>(pair: Pair<K, V>): V {
  return pair.second;
}

function wrap<T>(value: T): Container<T> {
  return { value };
}

function unwrap<T>(container: Container<T>): T {
  return container.value;
}

function makePair<K, V>(key: K, value: V): Pair<K, V> {
  return { first: key, second: value };
}

function makeTriple<A, B, C>(a: A, b: B, c: C): Triple<A, B, C> {
  return { a, b, c };
}

// Function returning nested container
function deepWrap<T>(value: T): DeepContainer<T> {
  return {
    level1: {
      value: { value },
    },
  };
}

// Function chaining generics
function mapContainer<T, U>(
  container: Container<T>,
  fn: (x: T) => U
): Container<U> {
  return { value: fn(container.value) };
}

// ============ Generic Class ============

class Box<T> {
  constructor(private content: T) {}

  get(): T {
    return this.content;
  }

  map<U>(fn: (x: T) => U): Box<U> {
    return new Box<U>(fn(this.content));
  }

  flatMap<U>(fn: (x: T) => Box<U>): Box<U> {
    return fn(this.content);
  }
}

// ============ Test Functions ============

function testBasicGenericChain(): void {
  Console.WriteLine("--- Test 1: Basic Generic Chain ---");

  // Chain: wrap → unwrap → identity
  const original: int = 42;
  const wrapped = wrap(original);
  const unwrapped = unwrap(wrapped);
  const final = identity(unwrapped);

  Console.WriteLine(`original: ${original}`);
  Console.WriteLine(`wrapped.value: ${wrapped.value}`);
  Console.WriteLine(`unwrapped: ${unwrapped}`);
  Console.WriteLine(`final: ${final}`);
  Console.WriteLine("");
}

function testPairChain(): void {
  Console.WriteLine("--- Test 2: Pair Chain ---");

  // Create Pair<int, string>
  const pair = makePair(100, "hello");
  const key = first(pair);
  const value = second(pair);

  Console.WriteLine(`pair.first: ${pair.first}`);
  Console.WriteLine(`pair.second: ${pair.second}`);
  Console.WriteLine(`key: ${key}`);
  Console.WriteLine(`value: ${value}`);
  Console.WriteLine("");
}

function testTripleChain(): void {
  Console.WriteLine("--- Test 3: Triple Chain ---");

  // Create Triple<int, long, string>
  const triple = makeTriple(10, 9999999999 as long, "test");

  Console.WriteLine(`triple.a (int): ${triple.a}`);
  Console.WriteLine(`triple.b (long): ${triple.b}`);
  Console.WriteLine(`triple.c (string): ${triple.c}`);
  Console.WriteLine("");
}

function testNestedContainers(): void {
  Console.WriteLine("--- Test 4: Nested Containers ---");

  // Create Container<Container<int>>
  const nested = wrap(wrap(50));
  const inner = unwrap(nested);
  const value = unwrap(inner);

  Console.WriteLine(`nested.value.value: ${nested.value.value}`);
  Console.WriteLine(`inner.value: ${inner.value}`);
  Console.WriteLine(`value: ${value}`);
  Console.WriteLine("");
}

function testDeepContainer(): void {
  Console.WriteLine("--- Test 5: Deep Container ---");

  // Create DeepContainer<int>
  const deep = deepWrap(77);
  const level1 = deep.level1;
  const level2 = level1.value;
  const value = level2.value;

  Console.WriteLine(`deep.level1.value.value: ${deep.level1.value.value}`);
  Console.WriteLine(`level2.value: ${level2.value}`);
  Console.WriteLine(`value: ${value}`);
  Console.WriteLine("");
}

function testMapContainer(): void {
  Console.WriteLine("--- Test 6: Map Container ---");

  // Map Container<int> to Container<long>
  const intContainer = wrap(25);
  const longContainer = mapContainer<int, long>(
    intContainer,
    (x) => (x as long) * 1000000
  );

  Console.WriteLine(`intContainer.value: ${intContainer.value}`);
  Console.WriteLine(`longContainer.value: ${longContainer.value}`);
  Console.WriteLine("");
}

function testBoxClass(): void {
  Console.WriteLine("--- Test 7: Box Class ---");

  // Create Box<int>
  const intBox = new Box(30);
  const intValue = intBox.get();

  Console.WriteLine(`intBox.get(): ${intValue}`);

  // Map Box<int> to Box<string>
  const stringBox = intBox.map((x) => `Value: ${x}`);
  const stringValue = stringBox.get();

  Console.WriteLine(`stringBox.get(): ${stringValue}`);
  Console.WriteLine("");
}

function testFlatMapBox(): void {
  Console.WriteLine("--- Test 8: FlatMap Box ---");

  // Create Box<int> and flatMap to Box<long>
  const intBox = new Box(5);
  const longBox = intBox.flatMap((x) => new Box((x as long) * 2000000000));

  Console.WriteLine(`intBox.get(): ${intBox.get()}`);
  Console.WriteLine(`longBox.get(): ${longBox.get()}`);
  Console.WriteLine("");
}

function testArrayOfGenerics(): void {
  Console.WriteLine("--- Test 9: Array of Generics ---");

  // Create array of Container<int>
  const containers = [wrap(1), wrap(2), wrap(3)];

  // Extract values manually (no .map on .NET arrays)
  const values = [
    containers[0].value,
    containers[1].value,
    containers[2].value,
  ];

  Console.WriteLine(`containers[0].value: ${containers[0].value}`);
  Console.WriteLine(`containers[1].value: ${containers[1].value}`);
  Console.WriteLine(`containers[2].value: ${containers[2].value}`);
  Console.WriteLine(`values: [${values[0]}, ${values[1]}, ${values[2]}]`);
  Console.WriteLine("");
}

function testChainedMethodCalls(): void {
  Console.WriteLine("--- Test 10: Chained Method Calls ---");

  // Chain: Box<int> → map → map → get
  const result = new Box(100)
    .map((x) => (x as long) * 10)
    .map((x) => `Result: ${x}`)
    .get();

  Console.WriteLine(`chained result: ${result}`);
  Console.WriteLine("");
}

export function main(): void {
  Console.WriteLine("=== Generic Chains E2E Tests ===");
  Console.WriteLine("");

  testBasicGenericChain();
  testPairChain();
  testTripleChain();
  testNestedContainers();
  testDeepContainer();
  testMapContainer();
  testBoxClass();
  testFlatMapBox();
  testArrayOfGenerics();
  testChainedMethodCalls();

  Console.WriteLine("=== All Generic Chain Tests Completed ===");
}
