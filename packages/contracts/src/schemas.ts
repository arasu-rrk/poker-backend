import { z } from "zod";

export const correlationIdSchema = z.string().trim().min(1).max(128);
export const isoTimestampSchema = z.iso.datetime();
export const uuidSchema = z.uuid();
export const roomCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .regex(/^[A-Z0-9-]+$/);

export const userSchema = z.object({
  id: uuidSchema,
  displayName: z.string().trim().min(1).max(100),
  email: z.email().nullable(),
  avatarUrl: z.url().nullable(),
  authenticationProvider: z.string().trim().min(1).max(50),
  isGuest: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  deletedAt: isoTimestampSchema.nullable()
});

export const authenticationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("authenticated"),
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    user: userSchema
  }),
  z.object({
    type: z.literal("guest"),
    guestId: uuidSchema,
    displayName: z.string().trim().min(1).max(100)
  })
]);

export const guestAuthenticationRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(100)
});

export const refreshAuthenticationRequestSchema = z.object({
  refreshToken: z.string().trim().min(32).optional()
});

export const logoutRequestSchema = z.object({
  revokeAllSessions: z.boolean().optional().default(false)
});

export const connectionTicketResponseSchema = z.object({
  ticket: z.string().min(32),
  expiresAt: isoTimestampSchema,
  roomId: uuidSchema
});

export const roomSettingsSchema = z
  .object({
    deck: z.enum(["fibonacci", "tshirt", "powers", "custom"]),
    customDeck: z.array(z.string()).optional(),
    allowSpecialValues: z.boolean(),
    revealPolicy: z.enum(["moderator", "any_participant"]).default("moderator")
  })
  .strict();

export const roomSchema = z.object({
  id: uuidSchema,
  roomCode: roomCodeSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).nullable(),
  ownerId: uuidSchema,
  settings: roomSettingsSchema,
  isActive: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  deletedAt: isoTimestampSchema.nullable()
});

export const roomMemberRoleSchema = z.enum(["owner", "moderator", "participant", "observer"]);
export const roomCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  settings: roomSettingsSchema.optional()
});
export const roomUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    settings: roomSettingsSchema.optional()
  })
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined || value.settings !== undefined,
    { message: "At least one room field must be provided" }
  );
export const roomJoinRequestSchema = z
  .object({
    roomCode: roomCodeSchema.optional(),
    invitationToken: z.string().trim().min(32).optional()
  })
  .refine((value) => Boolean(value.roomCode || value.invitationToken), {
    message: "roomCode or invitationToken is required"
  });
export const invitationRequestSchema = z.object({
  invitedEmail: z.email().optional(),
  role: z.enum(["moderator", "participant", "observer"]).default("participant"),
  expiresInSeconds: z.number().int().positive().max(604800).optional()
});
export const participantDisplayNameRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  avatarUrl: z.url().nullable().optional()
});
export const participantRoleRequestSchema = z.object({
  role: z.enum(["moderator", "participant", "observer"])
});

export const roomMemberSchema = z.object({
  id: uuidSchema,
  roomId: uuidSchema,
  userId: uuidSchema,
  role: roomMemberRoleSchema,
  joinedAt: isoTimestampSchema,
  lastSeenAt: isoTimestampSchema.nullable(),
  isActive: z.boolean()
});

export const participantSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    displayName: z.string().trim().min(1).max(100),
    avatarUrl: z.url().nullable(),
    role: roomMemberRoleSchema,
    isModerator: z.boolean(),
    isConnected: z.boolean()
  })
  .strict();

export const privateParticipantSchema = z
  .object({
    userId: uuidSchema,
    displayName: z.string().trim().min(1).max(100),
    email: z.email().nullable(),
    refreshTokenVersion: z.number().int().nonnegative().optional()
  })
  .strict();

export const pokerSessionStatusSchema = z.enum(["draft", "active", "completed", "cancelled"]);

export const pokerSessionSchema = z.object({
  id: uuidSchema,
  roomId: uuidSchema,
  name: z.string().trim().min(1).max(100),
  status: pokerSessionStatusSchema,
  startedAt: isoTimestampSchema.nullable(),
  completedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
});

export const storyStatusSchema = z.enum(["pending", "voting", "estimated", "skipped", "deleted"]);

export const storySchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable(),
  acceptanceCriteria: z.string().max(5000).nullable(),
  ticketUrl: z.url().nullable(),
  displayOrder: z.number().int().nonnegative(),
  status: storyStatusSchema,
  finalEstimate: z.string().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  deletedAt: isoTimestampSchema.nullable()
});

export const votingRoundStatusSchema = z.enum(["open", "revealed", "completed", "cancelled"]);

export const voteTypeSchema = z.enum(["numeric", "special"]);
export const specialVoteSchema = z.enum(["?", "☕"]);

export const voteSchema = z
  .object({
    id: uuidSchema,
    votingRoundId: uuidSchema,
    userId: uuidSchema,
    voteType: voteTypeSchema,
    numericValue: z.number().nullable(),
    specialValue: specialVoteSchema.nullable(),
    submittedAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema
  })
  .superRefine((vote, context) => {
    if (vote.voteType === "numeric" && (vote.numericValue === null || vote.specialValue !== null)) {
      context.addIssue({
        code: "custom",
        message: "Numeric votes require numeric_value and no special_value"
      });
    }
    if (vote.voteType === "special" && (vote.specialValue === null || vote.numericValue !== null)) {
      context.addIssue({
        code: "custom",
        message: "Special votes require special_value and no numeric_value"
      });
    }
  });

export const votingRoundSchema = z.object({
  id: uuidSchema,
  storyId: uuidSchema,
  sessionId: uuidSchema,
  roundNumber: z.number().int().positive(),
  status: votingRoundStatusSchema,
  revealedAt: isoTimestampSchema.nullable(),
  completedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
});

export const publicParticipantVoteSchema = z
  .object({
    participantId: uuidSchema,
    displayName: z.string().trim().min(1).max(100),
    hasVoted: z.boolean()
  })
  .strict();

export const hiddenVotingStateSchema = z
  .object({
    roundId: uuidSchema,
    status: z.literal("hidden"),
    participants: z.array(publicParticipantVoteSchema),
    voteCount: z.number().int().nonnegative(),
    participantCount: z.number().int().nonnegative()
  })
  .strict();

export const revealedVoteSchema = z
  .object({
    participantId: uuidSchema,
    displayName: z.string().trim().min(1).max(100),
    voteType: voteTypeSchema,
    numericValue: z.number().nullable(),
    specialValue: specialVoteSchema.nullable()
  })
  .strict();

export const revealedVotingStateSchema = z
  .object({
    roundId: uuidSchema,
    status: z.literal("revealed"),
    votes: z.array(revealedVoteSchema),
    voteCount: z.number().int().nonnegative()
  })
  .strict();

export const publicRoomSnapshotSchema = z
  .object({
    room: roomSchema,
    session: pokerSessionSchema.nullable(),
    story: storySchema.nullable(),
    round: votingRoundSchema.nullable(),
    participants: z.array(participantSchema),
    voting: z.discriminatedUnion("status", [hiddenVotingStateSchema, revealedVotingStateSchema])
  })
  .strict();

export const votingResultsSchema = z
  .object({
    roundId: uuidSchema,
    revealed: z.boolean(),
    average: z.number().nullable(),
    minimum: z.number().nullable(),
    maximum: z.number().nullable(),
    distribution: z.record(z.string(), z.number().int().nonnegative()),
    votes: z.array(revealedVoteSchema)
  })
  .strict();

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR"
]);

export const validationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
  code: z.string()
});

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  correlationId: correlationIdSchema.nullable(),
  details: z.array(validationIssueSchema).optional(),
  field: z.string().optional()
});

export const successResponseSchema = z.object({
  data: z.unknown()
});

export const errorResponseSchema = z.object({
  error: apiErrorSchema
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative()
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("asc")
});

export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: paginationSchema
  });
}
