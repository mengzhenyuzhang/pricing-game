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
  const used = new Set(usedParticipantIds);
  const unusedSegmentCandidates = segmentCandidates.filter((candidate) => !used.has(candidate.id));
  return unusedSegmentCandidates.length ? unusedSegmentCandidates : segmentCandidates;
}
