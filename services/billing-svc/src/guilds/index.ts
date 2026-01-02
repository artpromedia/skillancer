/**
 * Guild Billing Module Index
 * Sprint M8: Guild & Agency Accounts
 */

// Services
export { revenueSplitService, RevenueSplitService } from './revenue-split.js';
export { guildTreasuryService, GuildTreasuryService } from './guild-treasury.js';
export { splitCalculatorService, SplitCalculatorService } from './split-calculator.js';

// Types
export type {
  CreateRevenueSplitInput,
  UpdateRevenueSplitInput,
  RevenueSplitInfo,
} from './revenue-split.js';

export type {
  WithdrawFromTreasuryInput,
  DepositToTreasuryInput,
  TreasuryInfo,
  TransactionInfo,
} from './guild-treasury.js';

export type {
  SplitMember,
  SplitConfiguration,
  CalculatedSplit,
  SplitSummary,
} from './split-calculator.js';

// Schemas
export { CreateRevenueSplitSchema, UpdateRevenueSplitSchema } from './revenue-split.js';

export { WithdrawFromTreasurySchema, DepositToTreasurySchema } from './guild-treasury.js';
