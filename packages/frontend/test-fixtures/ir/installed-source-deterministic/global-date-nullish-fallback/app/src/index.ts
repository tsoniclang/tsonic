class Holder {
  public date: Date | undefined;

  public constructor(date?: Date) {
    this.date = date;
  }
}

class Box {
  public readonly value: Date;

  public constructor(value: Date) {
    this.value = value;
  }
}

export function wrap(holder: Holder): Box {
  const fallback = new Date(0);
  const selected = holder.date ?? fallback;
  return new Box(selected);
}
