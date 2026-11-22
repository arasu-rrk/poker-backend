import { z } from "zod";
import {
  participantSchema,
  pokerSessionSchema,
  publicRoomSnapshotSchema,
  revealedVotingStateSchema,
  roomSettingsSchema,
  specialVoteSchema,
  storySchema,
  votingResultsSchema,
  voteTypeSchema
} from "./schemas";

export const websocketProtocolVersionSchema = z.literal("1");

const websocketEnvelopeBaseSchema = z.object({
  version: websocketProtocolVersionSchema,
  messageId: z.uuid(),
  timestamp: z.iso.datetime()
});

export const joinRoomPayloadSchema = z.object({
  roomCode: z.string().trim().min(4).max(12),
  displayName: z.string().trim().min(1).max(100).optional()
});
export const leaveRoomPayloadSchema = z.object({ roomId: z.uuid() });
export const updateParticipantPayloadSchema = z.object({
  participantId: z.uuid(),
  displayName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["facilitator", "participant"]).optional()
});
export const selectVotePayloadSchema = z
  .object({
    roundId: z.uuid(),
    voteType: voteTypeSchema,
    numericValue: z.number().optional(),
    specialValue: specialVoteSchema.optional()
  })
  .superRefine((payload, context) => {
    if (
      payload.voteType === "numeric" &&
      (payload.numericValue === undefined || payload.specialValue !== undefined)
    ) {
      context.addIssue({ code: "custom", message: "Numeric vote value is required" });
    }
    if (
      payload.voteType === "special" &&
      (payload.specialValue === undefined || payload.numericValue !== undefined)
    ) {
      context.addIssue({ code: "custom", message: "Special vote value is required" });
    }
  });
export const retractVotePayloadSchema = z.object({ roundId: z.uuid() });
export const revealVotesPayloadSchema = z.object({ roundId: z.uuid() });
export const hideVotesPayloadSchema = z.object({ roundId: z.uuid() });
export const resetVotingPayloadSchema = z.object({ roundId: z.uuid() });
export const changeStoryPayloadSchema = z.object({ storyId: z.uuid() });
export const updateRoomSettingsPayloadSchema = z.object({
  settings: roomSettingsSchema
});
export const startNewRoundPayloadSchema = z.object({ storyId: z.uuid() });
export const pongPayloadSchema = z.object({ echoMessageId: z.uuid() });

export const websocketCommandSchema = z.discriminatedUnion("type", [
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("JOIN_ROOM"),
    payload: joinRoomPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("LEAVE_ROOM"),
    payload: leaveRoomPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("UPDATE_PARTICIPANT"),
    payload: updateParticipantPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("SELECT_VOTE"),
    payload: selectVotePayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("RETRACT_VOTE"),
    payload: retractVotePayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("REVEAL_VOTES"),
    payload: revealVotesPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("HIDE_VOTES"),
    payload: hideVotesPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("RESET_VOTING"),
    payload: resetVotingPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("CHANGE_STORY"),
    payload: changeStoryPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("UPDATE_ROOM_SETTINGS"),
    payload: updateRoomSettingsPayloadSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("START_NEW_ROUND"),
    payload: startNewRoundPayloadSchema
  })
]);

export const websocketEventSchema = z.discriminatedUnion("type", [
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("ROOM_STATE"),
    payload: publicRoomSnapshotSchema
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("PARTICIPANT_JOINED"),
    payload: z.object({ participant: participantSchema })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("PARTICIPANT_LEFT"),
    payload: z.object({ participantId: z.uuid() })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("PARTICIPANT_UPDATED"),
    payload: z.object({ participant: participantSchema })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("STORY_CHANGED"),
    payload: z.object({ story: storySchema })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("VOTE_SUBMITTED"),
    payload: z.object({ roundId: z.uuid(), participantId: z.uuid(), hasVoted: z.literal(true) })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("VOTE_RETRACTED"),
    payload: z.object({ roundId: z.uuid(), participantId: z.uuid(), hasVoted: z.literal(false) })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("VOTES_REVEALED"),
    payload: z.object({
      roundId: z.uuid(),
      result: votingResultsSchema,
      revealedState: revealedVotingStateSchema
    })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("VOTES_HIDDEN"),
    payload: z.object({ roundId: z.uuid() })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("VOTING_RESET"),
    payload: z.object({ roundId: z.uuid() })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("SESSION_UPDATED"),
    payload: z.object({ session: pokerSessionSchema })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("ROOM_SETTINGS_UPDATED"),
    payload: z.object({ settings: roomSettingsSchema })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("MODERATOR_CHANGED"),
    payload: z.object({ participantId: z.uuid() })
  }),
  websocketEnvelopeBaseSchema.extend({
    type: z.literal("ERROR"),
    payload: z.object({ code: z.string(), message: z.string(), field: z.string().optional() })
  }),
  websocketEnvelopeBaseSchema.extend({ type: z.literal("PONG"), payload: pongPayloadSchema })
]);

export const websocketMessageSchema = z.union([websocketCommandSchema, websocketEventSchema]);

export type WebSocketMessage<TType extends string, TPayload> = {
  version: "1";
  type: TType;
  messageId: string;
  timestamp: string;
  payload: TPayload;
};
