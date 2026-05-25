export type AttendanceMode = "IN_PERSON" | "ONLINE" | "UNKNOWN";
export type AttendanceModeStrategy = "PREFER_SAME_ATTENDANCE" | "STRICT_SEPARATE_ATTENDANCE" | "IGNORE_ATTENDANCE";
export type AttendanceMix = "IN_PERSON_ONLY" | "ONLINE_ONLY" | "MIXED";

export type TeamPlan = {
  teamNumber: number;
  name: string;
  plannedSize: number;
  participantIds?: string[];
  attendanceMix?: AttendanceMix;
  inPersonCount?: number;
  onlineCount?: number;
};

export type AssignmentSummary = {
  totalTeams: number;
  inPersonOnlyTeams: number;
  onlineOnlyTeams: number;
  mixedTeams: number;
  inPersonStudents: number;
  onlineStudents: number;
  studentsInMixedTeams: number;
  warnings: string[];
};

export type TeamGenerationResult = {
  ok: boolean;
  warning?: string;
  blockingWarning?: string;
  teams: TeamPlan[];
  assignmentSummary?: AssignmentSummary;
};

export type AssignmentParticipant = {
  id: string;
  displayName?: string | null;
  attendanceMode?: string | null;
};

type Rng = () => number;

export function canCreateValidTeams(count: number, minTeamSize: number, maxTeamSize: number) {
  if (count === 0) return true;
  if (count < 0 || minTeamSize < 1 || maxTeamSize < minTeamSize) return false;
  return Math.ceil(count / maxTeamSize) <= Math.floor(count / minTeamSize);
}

export function createBalancedTeamSizes(count: number, minTeamSize: number, maxTeamSize: number) {
  if (count === 0) return [];
  const minTeams = Math.ceil(count / maxTeamSize);
  const maxTeams = Math.floor(count / minTeamSize);
  if (minTeams > maxTeams) return null;
  const teamCount = minTeams;
  const baseSize = Math.floor(count / teamCount);
  const remainder = count % teamCount;
  return Array.from({ length: teamCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

export function planTeams(input: {
  numberOfStudents: number;
  minTeamSize?: number;
  maxTeamSize?: number;
  teamNamePrefix?: string;
  allowOverride?: boolean;
}): TeamGenerationResult {
  const numberOfStudents = Math.floor(input.numberOfStudents);
  const minTeamSize = input.minTeamSize ?? 4;
  const maxTeamSize = input.maxTeamSize ?? 5;
  const prefix = input.teamNamePrefix?.trim() || "Team";

  if (numberOfStudents < 1 || minTeamSize < 1 || maxTeamSize < minTeamSize) {
    return { ok: false, warning: "Team generation settings are invalid.", teams: [] };
  }

  const sizes = createBalancedTeamSizes(numberOfStudents, minTeamSize, maxTeamSize);
  if (!sizes) {
    if (!input.allowOverride) {
      return {
        ok: false,
        warning: `${numberOfStudents} students cannot be split into teams of ${minTeamSize}-${maxTeamSize} without an override.`,
        teams: []
      };
    }
    const fallbackTeamCount = Math.max(1, Math.round(numberOfStudents / ((minTeamSize + maxTeamSize) / 2)));
    const fallbackSizes = balancedSizes(numberOfStudents, fallbackTeamCount);
    return {
      ok: true,
      warning: `Override used: generated ${fallbackTeamCount} team(s), outside the requested ${minTeamSize}-${maxTeamSize} range.`,
      teams: fallbackSizes.map((plannedSize, index) => ({ teamNumber: index + 1, name: `${prefix} ${index + 1}`, plannedSize }))
    };
  }

  return {
    ok: true,
    teams: sizes.map((plannedSize, index) => ({ teamNumber: index + 1, name: `${prefix} ${index + 1}`, plannedSize }))
  };
}

export function generateTeamAssignments(
  participants: AssignmentParticipant[],
  minTeamSize = 4,
  maxTeamSize = 5,
  options: {
    randomSeed?: string;
    allowOverride?: boolean;
    teamNamePrefix?: string;
    attendanceModeStrategy?: AttendanceModeStrategy | "IGNORE" | "SEPARATE_ONLINE_AND_IN_PERSON" | "BALANCE_ONLINE_ACROSS_TEAMS";
  } = {}
): TeamGenerationResult {
  const strategy = normalizeStrategy(options.attendanceModeStrategy);
  return generateAttendanceAwareTeamAssignments({
    participants,
    minTeamSize,
    maxTeamSize,
    strategy,
    randomSeed: options.randomSeed,
    allowOverride: options.allowOverride,
    teamNamePrefix: options.teamNamePrefix
  });
}

export function generateAttendanceAwareTeamAssignments(input: {
  participants: AssignmentParticipant[];
  minTeamSize?: number;
  maxTeamSize?: number;
  strategy?: AttendanceModeStrategy;
  randomSeed?: string;
  allowOverride?: boolean;
  teamNamePrefix?: string;
}): TeamGenerationResult {
  const participants = input.participants;
  const minTeamSize = input.minTeamSize ?? 4;
  const maxTeamSize = input.maxTeamSize ?? 5;
  const strategy = input.strategy ?? "PREFER_SAME_ATTENDANCE";
  const prefix = input.teamNamePrefix?.trim() || "Team";
  const rng = seededRandom(input.randomSeed ?? `${Date.now()}:${participants.length}:${strategy}`);

  if (participants.length === 0) {
    return { ok: false, blockingWarning: "No checked-in students are available for team assignment.", warning: "No checked-in students are available for team assignment.", teams: [] };
  }

  if (strategy === "IGNORE_ATTENDANCE") {
    return assignIgnoreAttendance(participants, minTeamSize, maxTeamSize, rng, prefix, input.allowOverride);
  }

  const strict = assignStrictSeparate(participants, minTeamSize, maxTeamSize, rng, prefix);
  if (strict.ok || strategy === "STRICT_SEPARATE_ATTENDANCE") return strict;

  return assignPreferSameAttendance(participants, minTeamSize, maxTeamSize, rng, prefix, input.allowOverride);
}

function assignStrictSeparate(participants: AssignmentParticipant[], minTeamSize: number, maxTeamSize: number, rng: Rng, prefix: string): TeamGenerationResult {
  const groups = splitAttendance(participants);
  const inPersonValid = canCreateValidTeams(groups.inPerson.length, minTeamSize, maxTeamSize);
  const onlineValid = canCreateValidTeams(groups.online.length, minTeamSize, maxTeamSize);
  if (!inPersonValid || !onlineValid) {
    const warning = "Strict separate grouping is not feasible with the current counts and team-size settings. Change team size settings, use Prefer Same Attendance, or manually assign teams.";
    return { ok: false, blockingWarning: warning, warning, teams: [], assignmentSummary: emptySummary(groups.inPerson.length, groups.online.length, [warning]) };
  }
  const teams = [
    ...buildHomogeneousTeams(groups.inPerson, "IN_PERSON_ONLY", createBalancedTeamSizes(groups.inPerson.length, minTeamSize, maxTeamSize) ?? [], rng),
    ...buildHomogeneousTeams(groups.online, "ONLINE_ONLY", createBalancedTeamSizes(groups.online.length, minTeamSize, maxTeamSize) ?? [], rng)
  ];
  return finalizeTeams(teams, prefix, []);
}

function assignPreferSameAttendance(participants: AssignmentParticipant[], minTeamSize: number, maxTeamSize: number, rng: Rng, prefix: string, allowOverride?: boolean): TeamGenerationResult {
  const groups = splitAttendance(participants);
  type Candidate = {
    reservedInPerson: number;
    reservedOnline: number;
    homogeneousInSizes: number[];
    homogeneousOnlineSizes: number[];
    mixedSizes: number[];
    score: number[];
  };
  const candidates: Candidate[] = [];

  for (let reservedInPerson = 0; reservedInPerson <= groups.inPerson.length; reservedInPerson += 1) {
    for (let reservedOnline = 0; reservedOnline <= groups.online.length; reservedOnline += 1) {
      if (reservedInPerson === 0 || reservedOnline === 0) continue;
      const remainingInPerson = groups.inPerson.length - reservedInPerson;
      const remainingOnline = groups.online.length - reservedOnline;
      const homogeneousInSizes = createBalancedTeamSizes(remainingInPerson, minTeamSize, maxTeamSize);
      const homogeneousOnlineSizes = createBalancedTeamSizes(remainingOnline, minTeamSize, maxTeamSize);
      const mixedSizes = createBalancedTeamSizes(reservedInPerson + reservedOnline, minTeamSize, maxTeamSize);
      if (!homogeneousInSizes || !homogeneousOnlineSizes || !mixedSizes) continue;
      const compositions = mixedCompositions(reservedInPerson, reservedOnline, mixedSizes, maxTeamSize);
      const isolatedMinorityTeams = compositions.filter((team) => Math.min(team.inPerson, team.online) === 1).length;
      const minorityScattered = isolatedMinorityTeams > 1 ? isolatedMinorityTeams : 0;
      candidates.push({
        reservedInPerson,
        reservedOnline,
        homogeneousInSizes,
        homogeneousOnlineSizes,
        mixedSizes,
        score: [
          mixedSizes.length,
          reservedInPerson + reservedOnline,
          minorityScattered,
          isolatedMinorityTeams,
          spreadScore([...homogeneousInSizes, ...homogeneousOnlineSizes, ...mixedSizes])
        ]
      });
    }
  }

  candidates.sort((a, b) => compareScore(a.score, b.score));
  const best = candidates[0];
  if (!best) {
    if (!allowOverride) {
      const warning = `Checked-in students cannot be split into valid teams of ${minTeamSize}-${maxTeamSize} with the selected attendance strategy.`;
      return { ok: false, blockingWarning: warning, warning, teams: [], assignmentSummary: emptySummary(groups.inPerson.length, groups.online.length, [warning]) };
    }
    return assignIgnoreAttendance(participants, minTeamSize, maxTeamSize, rng, prefix, true);
  }

  const shuffledIn = shuffleWithRng(groups.inPerson, rng);
  const shuffledOnline = shuffleWithRng(groups.online, rng);
  const mixedIn = shuffledIn.slice(0, best.reservedInPerson);
  const homogeneousIn = shuffledIn.slice(best.reservedInPerson);
  const mixedOnline = shuffledOnline.slice(0, best.reservedOnline);
  const homogeneousOnline = shuffledOnline.slice(best.reservedOnline);
  const warnings = [`Mixed teams were created because one or both attendance groups could not be divided cleanly into teams of ${minTeamSize}-${maxTeamSize}.`];
  if (groups.online.length > 0 && !canCreateValidTeams(groups.online.length, minTeamSize, maxTeamSize)) {
    warnings.push(`Online count could not form valid ${minTeamSize}-${maxTeamSize} person teams by itself, so ${best.mixedSizes.length} mixed team${best.mixedSizes.length === 1 ? "" : "s"} were created.`);
  }
  if (groups.inPerson.length > 0 && !canCreateValidTeams(groups.inPerson.length, minTeamSize, maxTeamSize)) {
    warnings.push(`In-person count could not form valid ${minTeamSize}-${maxTeamSize} person teams by itself, so ${best.mixedSizes.length} mixed team${best.mixedSizes.length === 1 ? "" : "s"} were created.`);
  }

  const teams = [
    ...buildHomogeneousTeams(homogeneousIn, "IN_PERSON_ONLY", best.homogeneousInSizes, rng),
    ...buildHomogeneousTeams(homogeneousOnline, "ONLINE_ONLY", best.homogeneousOnlineSizes, rng),
    ...buildMixedTeams(mixedIn, mixedOnline, best.mixedSizes, rng)
  ];
  return finalizeTeams(teams, prefix, warnings);
}

function assignIgnoreAttendance(participants: AssignmentParticipant[], minTeamSize: number, maxTeamSize: number, rng: Rng, prefix: string, allowOverride?: boolean): TeamGenerationResult {
  const plan = planTeams({ numberOfStudents: participants.length, minTeamSize, maxTeamSize, allowOverride });
  if (!plan.ok) return plan;
  const shuffledParticipants = shuffleWithRng(participants, rng);
  const shuffledTeams = shuffleWithRng(plan.teams, rng);
  let cursor = 0;
  const teams = shuffledTeams.map((team) => {
    const members = shuffledParticipants.slice(cursor, cursor + team.plannedSize);
    cursor += team.plannedSize;
    return teamFromMembers(members);
  });
  return finalizeTeams(teams, prefix, []);
}

function buildHomogeneousTeams(participants: AssignmentParticipant[], attendanceMix: AttendanceMix, sizes: number[], rng: Rng) {
  const shuffled = shuffleWithRng(participants, rng);
  let cursor = 0;
  return sizes.map((size) => {
    const members = shuffled.slice(cursor, cursor + size);
    cursor += size;
    return teamFromMembers(members, attendanceMix);
  });
}

function buildMixedTeams(inPerson: AssignmentParticipant[], online: AssignmentParticipant[], sizes: number[], rng: Rng) {
  const shuffledIn = shuffleWithRng(inPerson, rng);
  const shuffledOnline = shuffleWithRng(online, rng);
  const compositions = mixedCompositions(inPerson.length, online.length, sizes, Math.max(...sizes));
  let inCursor = 0;
  let onlineCursor = 0;
  return compositions.map((composition) => {
    const members = [
      ...shuffledOnline.slice(onlineCursor, onlineCursor + composition.online),
      ...shuffledIn.slice(inCursor, inCursor + composition.inPerson)
    ];
    onlineCursor += composition.online;
    inCursor += composition.inPerson;
    return teamFromMembers(shuffleWithRng(members, rng), "MIXED");
  });
}

function mixedCompositions(inPersonCount: number, onlineCount: number, sizes: number[], maxTeamSize: number) {
  const onlineIsMinority = onlineCount <= inPersonCount;
  let minorityLeft = Math.min(inPersonCount, onlineCount);
  let majorityLeft = Math.max(inPersonCount, onlineCount);
  const teams = sizes.map((size) => ({ size, inPerson: 0, online: 0 }));

  for (const team of teams) {
    if (minorityLeft <= 0) break;
    const take = Math.min(minorityLeft, team.size);
    if (onlineIsMinority) team.online = take;
    else team.inPerson = take;
    minorityLeft -= take;
  }

  for (const team of teams) {
    const current = team.inPerson + team.online;
    const need = team.size - current;
    if (onlineIsMinority) team.inPerson = need;
    else team.online = need;
    majorityLeft -= need;
  }

  for (const team of teams) {
    if (team.inPerson === 0 && inPersonCount > 0 && team.online > 1 && majorityLeft > 0) {
      team.inPerson += 1;
      team.online -= 1;
      majorityLeft -= 1;
      minorityLeft += 1;
    }
    if (team.online === 0 && onlineCount > 0 && team.inPerson > 1 && majorityLeft > 0) {
      team.online += 1;
      team.inPerson -= 1;
      majorityLeft -= 1;
      minorityLeft += 1;
    }
  }

  // If a minority-only overflow was introduced while ensuring both modes appear, fill from spare capacity.
  for (const team of teams) {
    while (team.inPerson + team.online < team.size && majorityLeft > 0) {
      if (onlineIsMinority) team.inPerson += 1;
      else team.online += 1;
      majorityLeft -= 1;
    }
  }

  return teams.map((team) => ({
    inPerson: team.inPerson,
    online: team.online,
    size: Math.min(maxTeamSize, team.inPerson + team.online)
  }));
}

function teamFromMembers(members: AssignmentParticipant[], forcedMix?: AttendanceMix): Omit<TeamPlan, "teamNumber" | "name"> {
  const inPersonCount = members.filter((participant) => normalizeAttendanceMode(participant.attendanceMode) === "IN_PERSON").length;
  const onlineCount = members.filter((participant) => normalizeAttendanceMode(participant.attendanceMode) === "ONLINE").length;
  const attendanceMix = forcedMix ?? (inPersonCount > 0 && onlineCount > 0 ? "MIXED" : onlineCount > 0 ? "ONLINE_ONLY" : "IN_PERSON_ONLY");
  return {
    plannedSize: members.length,
    participantIds: members.map((participant) => participant.id),
    attendanceMix,
    inPersonCount,
    onlineCount
  };
}

function finalizeTeams(teams: Array<Omit<TeamPlan, "teamNumber" | "name">>, prefix: string, warnings: string[]): TeamGenerationResult {
  const sorted = [...teams].sort((a, b) => mixOrder(a.attendanceMix) - mixOrder(b.attendanceMix));
  const finalTeams = sorted.map((team, index) => {
    const teamNumber = index + 1;
    const suffix = team.attendanceMix === "ONLINE_ONLY" ? "Online" : team.attendanceMix === "MIXED" ? "Mixed" : "In-person";
    return { ...team, teamNumber, name: `${prefix} ${teamNumber} - ${suffix}` };
  });
  const summary = summarize(finalTeams, warnings);
  return { ok: true, warning: warnings[0], teams: finalTeams, assignmentSummary: summary };
}

function summarize(teams: TeamPlan[], warnings: string[]): AssignmentSummary {
  return {
    totalTeams: teams.length,
    inPersonOnlyTeams: teams.filter((team) => team.attendanceMix === "IN_PERSON_ONLY").length,
    onlineOnlyTeams: teams.filter((team) => team.attendanceMix === "ONLINE_ONLY").length,
    mixedTeams: teams.filter((team) => team.attendanceMix === "MIXED").length,
    inPersonStudents: teams.reduce((sum, team) => sum + (team.inPersonCount ?? 0), 0),
    onlineStudents: teams.reduce((sum, team) => sum + (team.onlineCount ?? 0), 0),
    studentsInMixedTeams: teams.filter((team) => team.attendanceMix === "MIXED").reduce((sum, team) => sum + team.plannedSize, 0),
    warnings
  };
}

function emptySummary(inPersonStudents: number, onlineStudents: number, warnings: string[]): AssignmentSummary {
  return { totalTeams: 0, inPersonOnlyTeams: 0, onlineOnlyTeams: 0, mixedTeams: 0, inPersonStudents, onlineStudents, studentsInMixedTeams: 0, warnings };
}

function splitAttendance(participants: AssignmentParticipant[]) {
  return {
    inPerson: participants.filter((participant) => normalizeAttendanceMode(participant.attendanceMode) !== "ONLINE"),
    online: participants.filter((participant) => normalizeAttendanceMode(participant.attendanceMode) === "ONLINE")
  };
}

function normalizeAttendanceMode(mode?: string | null): AttendanceMode {
  return mode === "ONLINE" ? "ONLINE" : mode === "IN_PERSON" ? "IN_PERSON" : "UNKNOWN";
}

function normalizeStrategy(strategy?: AttendanceModeStrategy | "IGNORE" | "SEPARATE_ONLINE_AND_IN_PERSON" | "BALANCE_ONLINE_ACROSS_TEAMS") {
  if (strategy === "IGNORE") return "IGNORE_ATTENDANCE";
  if (strategy === "SEPARATE_ONLINE_AND_IN_PERSON") return "STRICT_SEPARATE_ATTENDANCE";
  if (strategy === "BALANCE_ONLINE_ACROSS_TEAMS") return "PREFER_SAME_ATTENDANCE";
  return strategy ?? "PREFER_SAME_ATTENDANCE";
}

function balancedSizes(numberOfStudents: number, teamCount: number) {
  const baseSize = Math.floor(numberOfStudents / teamCount);
  const remainder = numberOfStudents % teamCount;
  return Array.from({ length: teamCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function shuffleWithRng<T>(items: T[], rng: Rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function seededRandom(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function compareScore(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function spreadScore(sizes: number[]) {
  if (sizes.length === 0) return 0;
  return Math.max(...sizes) - Math.min(...sizes);
}

function mixOrder(mix?: AttendanceMix) {
  if (mix === "ONLINE_ONLY") return 2;
  if (mix === "MIXED") return 3;
  return 1;
}

export function defaultDrawCount(valuationCount: number, drawPercent: number, explicitDrawCount?: number | null) {
  if (valuationCount <= 0) return 0;
  const requested = explicitDrawCount && explicitDrawCount > 0 ? explicitDrawCount : Math.round(valuationCount * drawPercent);
  return Math.max(1, Math.min(valuationCount, requested));
}

export function defaultCapacity(type: string, valuationCount: number) {
  if (type === "POSTSCREENING") return Math.max(1, Math.round(valuationCount * 0.35));
  return Math.max(valuationCount, 1);
}
