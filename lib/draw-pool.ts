export type DrawCandidate = {
  id: string;
  valuationAmount: number;
};

export function drawPoolForMode<T extends DrawCandidate>(candidates: T[], usedParticipantIds: string[], cutoff: number, mode: "RANDOM" | "LOW" | "HIGH", isPostscreening: boolean) {
  const segmentCandidates = isPostscreening && mode === "LOW"
    ? candidates.filter((candidate) => candidate.valuationAmount < cutoff)
    : isPostscreening && mode === "HIGH"
      ? candidates.filter((candidate) => candidate.valuationAmount >= cutoff)
      : candidates;
  const effectiveSegmentCandidates = segmentCandidates.length
    ? segmentCandidates
    : fallbackSegmentCandidates(candidates, mode, isPostscreening);
  const used = new Set(usedParticipantIds);
  const unusedSegmentCandidates = effectiveSegmentCandidates.filter((candidate) => !used.has(candidate.id));
  return unusedSegmentCandidates.length ? unusedSegmentCandidates : effectiveSegmentCandidates;
}

function fallbackSegmentCandidates<T extends DrawCandidate>(candidates: T[], mode: "RANDOM" | "LOW" | "HIGH", isPostscreening: boolean) {
  if (!candidates.length || !isPostscreening || mode === "RANDOM") return candidates;
  const sorted = [...candidates].sort((a, b) => a.valuationAmount - b.valuationAmount);
  const fallbackSize = Math.max(1, Math.ceil(sorted.length / 2));
  return mode === "LOW" ? sorted.slice(0, fallbackSize) : sorted.slice(-fallbackSize);
}
