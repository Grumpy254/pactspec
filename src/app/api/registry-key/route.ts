import { NextResponse } from 'next/server';
import { getPublicKeyBase64 } from '@/lib/attestation';

/**
 * GET /api/registry-key
 *
 * Returns the registry's Ed25519 public key so anyone can verify
 * that validation results were actually signed by this registry.
 */
export async function GET() {
  const publicKey = getPublicKeyBase64();

  return NextResponse.json(
    {
      algorithm: 'Ed25519',
      publicKey,
      usage: 'Verify validation and benchmark result signatures. The registry signs every result with its Ed25519 private key. Use this public key to verify signatures returned in validation responses and stored on agent records.',
    },
    {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    }
  );
}
