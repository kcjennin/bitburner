/**
 * Minimal Deque backed by a doubly‑linked list.
 * (c) 2025 — public‑domain / CC0
 */
export class Deque<T> implements Iterable<T> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private _size = 0;

  /** Number of elements currently in the deque. */
  get size(): number {
    return this._size;
  }

  /** `true` if the deque is empty. */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /** Add `value` to the front. */
  pushFront(value: T): void {
    const n = new Node(value, null, this.head);
    if (this.head) this.head.prev = n;
    else this.tail = n;
    this.head = n;
    ++this._size;
  }

  /** Add `value` to the back. */
  pushBack(value: T): void {
    const n = new Node(value, this.tail, null);
    if (this.tail) this.tail.next = n;
    else this.head = n;
    this.tail = n;
    ++this._size;
  }

  /** Remove and return the front element, or `undefined` if empty. */
  popFront(): T | undefined {
    if (!this.head) return undefined;
    const { value, next } = this.head;
    this.head = next;
    if (next) next.prev = null;
    else this.tail = null;
    --this._size;
    return value;
  }

  /** Remove and return the back element, or `undefined` if empty. */
  popBack(): T | undefined {
    if (!this.tail) return undefined;
    const { value, prev } = this.tail;
    this.tail = prev;
    if (prev) prev.next = null;
    else this.head = null;
    --this._size;
    return value;
  }

  /** Peek at the front element without removing it. */
  peekFront(): T | undefined {
    return this.head?.value;
  }

  /** Peek at the back element without removing it. */
  peekBack(): T | undefined {
    return this.tail?.value;
  }

  /** Forward iterator (makes for–of work). */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let n = this.head; n; n = n.next) yield n.value;
  }
}

/* Internal node type — not exported. */
class Node<T> {
  constructor(readonly value: T, public prev: Node<T> | null, public next: Node<T> | null) { }
}
