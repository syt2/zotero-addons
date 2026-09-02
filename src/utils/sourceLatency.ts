export function sortByLatency<T extends { latency: number }>(
  candidates: T[],
): T[] {
  return [...candidates].sort((a, b) => a.latency - b.latency);
}
