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
  Console.writeLine("--- Test 1: Basic Generic Chain ---");

  // Chain: wrap → unwrap → identity
  const original: int = 42 as int;
  const wrapped: Container<int> = wrap<int>(original);
  const unwrapped: int = unwrap<int>(wrapped);
  const final: int = identity<int>(unwrapped);

  Console.writeLine(`original: ${original}`);
  Console.writeLine(`wrapped.value: ${wrapped.value}`);
  Console.writeLine(`unwrapped: ${unwrapped}`);
  Console.writeLine(`final: ${final}`);
  Console.writeLine("");
}

function testPairChain(): void {
  Console.writeLine("--- Test 2: Pair Chain ---");

  // Create Pair<int, string>
  const pair: Pair<int, string> = makePair<int, string>(100 as int, "hello");
  const key: int = first<int, string>(pair);
  const value: string = second<int, string>(pair);

  Console.writeLine(`pair.first: ${pair.first}`);
  Console.writeLine(`pair.second: ${pair.second}`);
  Console.writeLine(`key: ${key}`);
  Console.writeLine(`value: ${value}`);
  Console.writeLine("");
}

function testTripleChain(): void {
  Console.writeLine("--- Test 3: Triple Chain ---");

  // Create Triple<int, long, string>
  const triple: Triple<int, long, string> = makeTriple<int, long, string>(
    10 as int,
    9999999999 as long,
    "test"
  );

  Console.writeLine(`triple.a (int): ${triple.a}`);
  Console.writeLine(`triple.b (long): ${triple.b}`);
  Console.writeLine(`triple.c (string): ${triple.c}`);
  Console.writeLine("");
}

function testNestedContainers(): void {
  Console.writeLine("--- Test 4: Nested Containers ---");

  // Create Container<Container<int>>
  const nested: Container<Container<int>> = wrap<Container<int>>(
    wrap<int>(50 as int)
  );
  const inner: Container<int> = unwrap<Container<int>>(nested);
  const value: int = unwrap<int>(inner);

  Console.writeLine(`nested.value.value: ${nested.value.value}`);
  Console.writeLine(`inner.value: ${inner.value}`);
  Console.writeLine(`value: ${value}`);
  Console.writeLine("");
}

function testDeepContainer(): void {
  Console.writeLine("--- Test 5: Deep Container ---");

  // Create DeepContainer<int>
  const deep: DeepContainer<int> = deepWrap<int>(77 as int);
  const level1: Container<Container<int>> = deep.level1;
  const level2: Container<int> = level1.value;
  const value: int = level2.value;

  Console.writeLine(`deep.level1.value.value: ${deep.level1.value.value}`);
  Console.writeLine(`level2.value: ${level2.value}`);
  Console.writeLine(`value: ${value}`);
  Console.writeLine("");
}

function testMapContainer(): void {
  Console.writeLine("--- Test 6: Map Container ---");

  // Map Container<int> to Container<long>
  const intContainer: Container<int> = wrap<int>(25 as int);
  const longContainer: Container<long> = mapContainer<int, long>(
    intContainer,
    (x: int): long => (x as long) * (1000000 as long)
  );

  Console.writeLine(`intContainer.value: ${intContainer.value}`);
  Console.writeLine(`longContainer.value: ${longContainer.value}`);
  Console.writeLine("");
}

function testBoxClass(): void {
  Console.writeLine("--- Test 7: Box Class ---");

  // Create Box<int>
  const intBox: Box<int> = new Box<int>(30 as int);
  const intValue: int = intBox.get();

  Console.writeLine(`intBox.get(): ${intValue}`);

  // Map Box<int> to Box<string>
  const stringBox: Box<string> = intBox.map<string>(
    (x: int): string => `Value: ${x}`
  );
  const stringValue: string = stringBox.get();

  Console.writeLine(`stringBox.get(): ${stringValue}`);
  Console.writeLine("");
}

function testFlatMapBox(): void {
  Console.writeLine("--- Test 8: FlatMap Box ---");

  // Create Box<int> and flatMap to Box<long>
  const intBox: Box<int> = new Box<int>(5 as int);
  const longBox: Box<long> = intBox.flatMap<long>(
    (x: int): Box<long> => new Box<long>((x as long) * (2000000000 as long))
  );

  Console.writeLine(`intBox.get(): ${intBox.get()}`);
  Console.writeLine(`longBox.get(): ${longBox.get()}`);
  Console.writeLine("");
}

function testArrayOfGenerics(): void {
  Console.writeLine("--- Test 9: Array of Generics ---");

  // Create array of Container<int>
  const containers: Container<int>[] = [
    wrap<int>(1 as int),
    wrap<int>(2 as int),
    wrap<int>(3 as int),
  ];

  // Extract values manually (no .map on .NET arrays)
  const values: int[] = [
    containers[0].value,
    containers[1].value,
    containers[2].value,
  ];

  Console.writeLine(`containers[0].value: ${containers[0].value}`);
  Console.writeLine(`containers[1].value: ${containers[1].value}`);
  Console.writeLine(`containers[2].value: ${containers[2].value}`);
  Console.writeLine(`values: [${values[0]}, ${values[1]}, ${values[2]}]`);
  Console.writeLine("");
}

function testChainedMethodCalls(): void {
  Console.writeLine("--- Test 10: Chained Method Calls ---");

  // Chain: Box<int> → map → map → get
  const result: string = new Box<int>(100 as int)
    .map<long>((x: int): long => (x as long) * (10 as long))
    .map<string>((x: long): string => `Result: ${x}`)
    .get();

  Console.writeLine(`chained result: ${result}`);
  Console.writeLine("");
}

export function main(): void {
  Console.writeLine("=== Generic Chains E2E Tests ===");
  Console.writeLine("");

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

  Console.writeLine("=== All Generic Chain Tests Completed ===");
}
