import type { PaymentChallenge } from './types.js';

/** Base error for all PactSpec client errors. */
export class PactSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PactSpecError';
  }
}

/** The requested agent or spec ID was not found in the registry. */
export class AgentNotFoundError extends PactSpecError {
  public readonly specId: string;

  constructor(specId: string) {
    super(`Agent not found: ${specId}`);
    this.name = 'AgentNotFoundError';
    this.specId = specId;
  }
}

/** The skill ID does not exist on the resolved agent spec. */
export class SkillNotFoundError extends PactSpecError {
  public readonly specId: string;
  public readonly skillId: string;

  constructor(specId: string, skillId: string) {
    super(`Skill "${skillId}" not found on agent "${specId}"`);
    this.name = 'SkillNotFoundError';
    this.specId = specId;
    this.skillId = skillId;
  }
}

/** The agent returned 402 but auto-pay is disabled. */
export class PaymentRequiredError extends PactSpecError {
  public readonly challenge: PaymentChallenge;

  constructor(challenge: PaymentChallenge) {
    super(`Payment required: ${challenge.amount} ${challenge.currency}`);
    this.name = 'PaymentRequiredError';
    this.challenge = challenge;
  }
}

/** The payment amount exceeds the configured budget limit. */
export class PaymentRefusedError extends PactSpecError {
  public readonly challenge: PaymentChallenge;
  public readonly maxPaymentAmount: number;

  constructor(challenge: PaymentChallenge, maxPaymentAmount: number) {
    super(
      `Payment of ${challenge.amount} ${challenge.currency} exceeds budget limit of ${maxPaymentAmount} ${challenge.currency}`,
    );
    this.name = 'PaymentRefusedError';
    this.challenge = challenge;
    this.maxPaymentAmount = maxPaymentAmount;
  }
}

/** The payment transaction failed (wallet error, network error, etc.). */
export class PaymentFailedError extends PactSpecError {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PaymentFailedError';
    this.cause = cause;
  }
}

/** The agent invocation failed with a non-402 error status. */
export class InvocationError extends PactSpecError {
  public readonly status: number;
  public readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'InvocationError';
    this.status = status;
    this.body = body;
  }
}
