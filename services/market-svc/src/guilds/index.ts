// @ts-nocheck
/**
 * Guild Module Index
 * Sprint M8: Guild & Agency Accounts
 */

// Services
export { guildService, GuildService } from './guild-service';
export { guildMembershipService, GuildMembershipService } from './guild-membership';
export { guildReputationService, GuildReputationService } from './guild-reputation';
export { guildProjectsService, GuildProjectsService } from './guild-projects';

// Types
export type {
  CreateGuildInput,
  UpdateGuildInput,
  GuildInfo,
  GuildListOptions,
} from './guild-service';

export type { InviteMemberInput, UpdateMemberRoleInput, GuildMemberInfo } from './guild-membership';

export type {
  MemberReputationScore,
  GuildReputationScore,
  ReputationTrend,
} from './guild-reputation';

export type {
  CreateGuildProjectInput,
  UpdateProjectAssignmentInput,
  GuildProjectInfo,
  ProjectAssignment,
} from './guild-projects';

// Schemas
export { CreateGuildSchema, UpdateGuildSchema } from './guild-service';

export { InviteMemberSchema, UpdateMemberRoleSchema } from './guild-membership';

export { CreateGuildProjectSchema, UpdateProjectAssignmentSchema } from './guild-projects';
