import { z } from "zod";

export const valuationSchema = z.object({
  studentAlias: z.string().trim().max(120).optional().or(z.literal("")),
  amount: z.coerce.number().int().min(1).max(100000)
});

export const checkInSchema = z.object({
  classSessionCode: z.string().trim().min(2).max(20),
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  valuationAmount: z.coerce.number().int().positive().max(100000),
  attendanceMode: z.enum(["IN_PERSON", "ONLINE"])
});

export const teamDecisionSchema = z.object({
  price: z.coerce.number().int().positive().optional().or(z.literal("")),
  lowPrice: z.coerce.number().int().positive().optional().or(z.literal("")),
  highPrice: z.coerce.number().int().positive().optional().or(z.literal("")),
  bookingLimit: z.coerce.number().int().min(0).optional().or(z.literal(""))
});

export const loginSchema = z.object({
  password: z.string().min(1)
});

export const runSchema = z.object({
  classSessionId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["STATIC", "DYNAMIC", "POSTSCREENING"]),
  capacity: z.coerce.number().int().min(1).max(10000),
  drawCount: z.coerce.number().int().min(1).max(10000).optional().or(z.literal("")),
  drawPercent: z.coerce.number().min(0.01).max(1),
  dynamicPeriods: z.coerce.number().int().min(10).max(30).default(10),
  segmentCutoff: z.coerce.number().int().min(1).max(100000).optional().or(z.literal("")),
  segmentCutoffPercent: z.coerce.number().min(0.01).max(0.99).optional().or(z.literal(""))
});

export const manualValuationSchema = valuationSchema.extend({
  classSessionId: z.string().min(1).optional(),
  segment: z.enum(["LOW", "HIGH", "UNKNOWN"]).default("UNKNOWN")
});

export const classSessionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20).optional().or(z.literal("")),
  expectedStudentCount: z.coerce.number().int().min(1).max(10000).optional().or(z.literal("")),
  minTeamSize: z.coerce.number().int().min(1).max(100).default(4),
  maxTeamSize: z.coerce.number().int().min(1).max(100).default(5),
  attendanceModeStrategy: z.enum(["PREFER_SAME_ATTENDANCE", "STRICT_SEPARATE_ATTENDANCE", "IGNORE_ATTENDANCE"]).default("PREFER_SAME_ATTENDANCE"),
  targetDrawPercent: z.coerce.number().min(0.01).max(1).default(0.7)
});

export const publishAssignmentSchema = z.object({
  classSessionId: z.string().min(1),
  minTeamSize: z.coerce.number().int().min(1).max(100).default(4),
  maxTeamSize: z.coerce.number().int().min(1).max(100).default(5),
  attendanceModeStrategy: z.enum(["PREFER_SAME_ATTENDANCE", "STRICT_SEPARATE_ATTENDANCE", "IGNORE_ATTENDANCE"]).default("PREFER_SAME_ATTENDANCE"),
  randomSeed: z.string().trim().optional().or(z.literal("")),
  allowOverride: z.coerce.boolean().optional().default(false)
});

export const teamManualSchema = z.object({
  classSessionId: z.string().min(1),
  teamNumber: z.coerce.number().int().min(1).max(1000),
  name: z.string().trim().min(1).max(80),
  plannedSize: z.coerce.number().int().min(1).max(100).optional().or(z.literal("")),
  captainEmail: z.string().trim().email().optional().or(z.literal(""))
});
