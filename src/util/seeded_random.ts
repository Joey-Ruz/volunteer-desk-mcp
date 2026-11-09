// A tiny deterministic random number generator (mulberry32).
// The same seed always produces the same sequence, so every reset builds identical data.

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A number from 0 (inclusive) to 1 (exclusive). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let mixed = this.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  /** A whole number from `min` to `max`, both inclusive. */
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<Item>(items: readonly Item[]): Item {
    const index = Math.floor(this.next() * items.length);
    return items[index] as Item;
  }

  /** A shuffled copy; the input is left untouched. */
  shuffle<Item>(items: readonly Item[]): Item[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const swapWith = Math.floor(this.next() * (index + 1));
      const held = copy[index] as Item;
      copy[index] = copy[swapWith] as Item;
      copy[swapWith] = held;
    }
    return copy;
  }
}
