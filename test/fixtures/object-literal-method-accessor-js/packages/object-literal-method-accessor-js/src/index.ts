export function main(): void {
  const counter = {
    x: 1,
    get value() {
      return this.x;
    },
    inc() {
      this.x += 1;
      return this.x;
    },
  };

  console.log(counter.value.toString() + ":" + counter.inc().toString());
}
