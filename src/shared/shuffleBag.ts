/**
 * Shuffle-bag picker: draw items at random, but never let one run ahead of its
 * share until the whole cycle has been drawn. With a weight, an item gets that
 * many draws per cycle (the Daily tab uses importance: Low 1, Medium 2, High 3).
 * Pure and free of storage/UI concerns.
 */

export interface ShuffleBag {
  /** Ids drawn in the current cycle. When it covers everything, the cycle resets. */
  drawn: string[]
}

export const emptyBag = (): ShuffleBag => ({ drawn: [] })

/**
 * How far the current cycle has got, as draws made out of draws per cycle.
 * Draws of deleted items don't count, nor do draws past an item's share (its
 * weight may have dropped since). `drawn === total` is exactly when the next
 * draw starts a new cycle.
 */
export function cycleProgress<T extends { id: string }>(
  items: T[],
  bag: ShuffleBag,
  weight: (item: T) => number = () => 1
): { drawn: number; total: number } {
  let drawn = 0
  let total = 0
  for (const item of items) {
    const share = Math.max(1, weight(item))
    total += share
    drawn += Math.min(share, bag.drawn.filter((id) => id === item.id).length)
  }
  return { drawn, total }
}

export interface DrawResult<T> {
  pick: T | null
  bag: ShuffleBag
}

/**
 * @param items   the full pool; may have grown or shrunk since the last draw
 * @param bag     state from the previous draw
 * @param weight  how many times an item comes up per cycle (at least 1)
 * @param random  injectable for deterministic tests
 */
export function drawFromBag<T extends { id: string }>(
  items: T[],
  bag: ShuffleBag,
  weight: (item: T) => number = () => 1,
  random: () => number = Math.random
): DrawResult<T> {
  if (items.length === 0) return { pick: null, bag: emptyBag() }

  const ids = new Set(items.map((item) => item.id))
  // Drop ids for items that no longer exist, so deletions can't stall the cycle.
  let drawn = bag.drawn.filter((id) => ids.has(id))
  const last = drawn[drawn.length - 1]

  // Reads `drawn` live, so it is right again after the refill below.
  const remaining = (item: T): number =>
    Math.max(1, weight(item)) - drawn.filter((id) => id === item.id).length
  let available = items.filter((item) => remaining(item) > 0)

  if (available.length === 0) {
    // Cycle complete: refill.
    drawn = []
    available = items
  }

  // Never the same item twice in a row when anything else is left — within a
  // cycle (a heavy item's repeats get spread out) and across the boundary.
  const fresh = available.filter((item) => item.id !== last)
  const pool = fresh.length > 0 ? fresh : available

  // One ticket per draw still owed, like tokens in a real bag: an item owed
  // three draws is three times as likely, so its repeats don't bunch up at the
  // end of the cycle. With no weights this is a plain uniform pick.
  const tickets = pool.flatMap((item) => Array<T>(remaining(item)).fill(item))
  const pick = tickets[Math.floor(random() * tickets.length) % tickets.length]
  return { pick, bag: { drawn: [...drawn, pick.id] } }
}
