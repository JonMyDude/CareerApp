/**
 * Runs tasks one at a time, in the order they were queued, so two
 * read-modify-writes on one file can't interleave and lose one. A task that
 * fails rejects its own promise without stalling the tasks behind it.
 */
export function createQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task)
    tail = next.catch(() => {})
    return next
  }
}
