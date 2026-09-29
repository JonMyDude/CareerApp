import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cycleProgress, drawFromBag, emptyBag } from './shuffleBag.ts'

const weight = (item: { weight: number }): number => item.weight

test('cycleProgress counts draws against each share', () => {
  const items = [
    { id: 'a', weight: 3 },
    { id: 'b', weight: 1 }
  ]
  assert.deepEqual(cycleProgress(items, emptyBag(), weight), { drawn: 0, total: 4 })
  // A deleted item's draw and a draw past b's share don't count.
  assert.deepEqual(cycleProgress(items, { drawn: ['a', 'gone', 'b', 'b'] }, weight), { drawn: 2, total: 4 })
})

test('cycleProgress is full exactly when drawFromBag starts a new cycle', () => {
  const items = [
    { id: 'a', weight: 3 },
    { id: 'b', weight: 2 },
    { id: 'c', weight: 1 }
  ]
  let bag = emptyBag()
  for (let draw = 1; draw <= 6; draw++) {
    bag = drawFromBag(items, bag, weight).bag
    assert.deepEqual(cycleProgress(items, bag, weight), { drawn: draw, total: 6 })
  }
  bag = drawFromBag(items, bag, weight).bag
  assert.equal(cycleProgress(items, bag, weight).drawn, 1)
})
