export { PactSpecClient } from './client.js';
export type { ClientOptions } from './client.js';

export type {
  InvokeResult,
  PaymentChallenge,
  Agent,
  AgentEndpoint,
  AgentPricing,
  AgentProvider,
  AgentSkill,
  SearchOptions,
  SearchResult,
} from './types.js';

export type { WalletAdapter, PaymentRequest } from './wallet.js';
export { MockWallet } from './wallet.js';

export {
  PactSpecError,
  AgentNotFoundError,
  SkillNotFoundError,
  PaymentRequiredError,
  PaymentRefusedError,
  PaymentFailedError,
  InvocationError,
} from './errors.js';
