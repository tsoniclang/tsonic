export class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}

export class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  front(): T | undefined {
    return this.items[0];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}

export class LinkedListNode<T> {
  constructor(
    public value: T,
    public next: LinkedListNode<T> | null = null
  ) {}
}

export class LinkedList<T> {
  private head: LinkedListNode<T> | null = null;
  private tail: LinkedListNode<T> | null = null;
  private length: number = 0;

  append(value: T): void {
    const node = new LinkedListNode(value);

    if (this.head === null) {
      this.head = node;
      this.tail = node;
    } else {
      if (this.tail) {
        this.tail.next = node;
      }
      this.tail = node;
    }

    this.length++;
  }

  prepend(value: T): void {
    const node = new LinkedListNode(value, this.head);
    this.head = node;

    if (this.tail === null) {
      this.tail = node;
    }

    this.length++;
  }

  size(): number {
    return this.length;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;

    while (current !== null) {
      result.push(current.value);
      current = current.next;
    }

    return result;
  }
}

export function testDataStructures(): void {
  const stack = new Stack<number>();
  stack.push(1);
  stack.push(2);
  stack.push(3);
  console.log("Stack size:", stack.size());
  console.log("Stack pop:", stack.pop());

  const queue = new Queue<string>();
  queue.enqueue("first");
  queue.enqueue("second");
  queue.enqueue("third");
  console.log("Queue size:", queue.size());
  console.log("Queue dequeue:", queue.dequeue());

  const list = new LinkedList<number>();
  list.append(10);
  list.append(20);
  list.prepend(5);
  console.log("List as array:", list.toArray());
}
