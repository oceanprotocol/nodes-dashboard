/**
 * Calculate total benchmark score according from gpu, cpu and bandwidth scores
 * @param gpuScore
 * @param cpuScore
 * @param bandwidthScore
 * @returns
 */
export function calculateTotalBenchmarkScore(
  gpuScore: number | null | undefined,
  cpuScore: number | null | undefined,
  bandwidthScore: number | null | undefined
): number {
  return 0.7 * (gpuScore ?? 0) + 0.2 * (cpuScore ?? 0) + 0.1 * (bandwidthScore ?? 0);
}
