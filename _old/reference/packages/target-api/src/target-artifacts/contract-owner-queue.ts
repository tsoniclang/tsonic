export class DeterministicOwnerQueue {
  readonly #heap: string[] = [];
  readonly #members = new Set<string>();

  get size(): number {
    return this.#members.size;
  }

  push(owner: string): void {
    if (this.#members.has(owner)) {
      return;
    }
    this.#members.add(owner);
    this.#heap.push(owner);
    this.#bubbleUp(this.#heap.length - 1);
  }

  pop(): string | undefined {
    while (this.#heap.length > 0) {
      const owner = this.#removeRoot();
      if (!this.#members.delete(owner)) {
        continue;
      }
      return owner;
    }
    return undefined;
  }

  discard(owner: string): void {
    this.#members.delete(owner);
  }

  #removeRoot(): string {
    const root = this.#heap[0]!;
    const tail = this.#heap.pop();
    if (this.#heap.length > 0 && tail !== undefined) {
      this.#heap[0] = tail;
      this.#bubbleDown(0);
    }
    return root;
  }

  #bubbleUp(start: number): void {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.#heap[parent]!.localeCompare(this.#heap[index]!) <= 0) {
        return;
      }
      [this.#heap[parent], this.#heap[index]] = [
        this.#heap[index]!,
        this.#heap[parent]!,
      ];
      index = parent;
    }
  }

  #bubbleDown(start: number): void {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (
        left < this.#heap.length &&
        this.#heap[left]!.localeCompare(this.#heap[smallest]!) < 0
      ) {
        smallest = left;
      }
      if (
        right < this.#heap.length &&
        this.#heap[right]!.localeCompare(this.#heap[smallest]!) < 0
      ) {
        smallest = right;
      }
      if (smallest === index) {
        return;
      }
      [this.#heap[index], this.#heap[smallest]] = [
        this.#heap[smallest]!,
        this.#heap[index]!,
      ];
      index = smallest;
    }
  }
}
