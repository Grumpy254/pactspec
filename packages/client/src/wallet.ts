export interface PaymentRequest {
  amount: string;
  currency: string;
  network: string;
  payTo: string;
  paymentId: string;
}

/**
 * Adapter interface for blockchain wallets.
 *
 * Implement this interface to connect your preferred wallet (Coinbase,
 * MetaMask, Phantom, etc.) to the PactSpec client for automatic x402
 * payment handling.
 */
export interface WalletAdapter {
  /** Execute a payment and return the on-chain transaction hash. */
  pay(options: PaymentRequest): Promise<string>;
  /** Return the wallet's public address. */
  getAddress(): Promise<string>;
}

/**
 * A mock wallet that returns fake transaction hashes. Useful for local
 * development and testing against agents that use a mock payment verifier.
 */
export class MockWallet implements WalletAdapter {
  private readonly address: string;

  constructor(address?: string) {
    this.address = address ?? '0xMOCK0000000000000000000000000000000WALLET';
  }

  async pay(_options: PaymentRequest): Promise<string> {
    const hex = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
    return `0x${hex}`;
  }

  async getAddress(): Promise<string> {
    return this.address;
  }
}
