"use server";
import "server-only";

import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { EncryptedSecret } from "@/types/models";

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

/**
 * Retrieves the encryption key from Azure Key Vault or environment variables
 * @returns Base64-encoded 32-byte encryption key
 */
export async function getEncryptionKey(): Promise<Buffer> {
  try {
    // Try Key Vault first if configured
    const keyVaultUri = process.env.KEYVAULT_URI;
    if (keyVaultUri) {
      console.info('Attempting to retrieve encryption key from Key Vault');
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(keyVaultUri, credential);
      
      try {
        const secret = await client.getSecret('CONFIG_ENCRYPTION_KEY');
        if (secret.value) {
          const keyBuffer = Buffer.from(secret.value, 'base64');
          if (keyBuffer.length !== KEY_LENGTH) {
            throw new Error(`Invalid key length from Key Vault: expected ${KEY_LENGTH} bytes, got ${keyBuffer.length}`);
          }
          return keyBuffer;
        }
      } catch (kvError) {
        console.warn('Failed to retrieve key from Key Vault, falling back to environment variable:', kvError);
      }
    }

    // Fallback to environment variable
    const envKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (!envKey) {
      throw new Error(
        'No encryption key available. Set CONFIG_ENCRYPTION_KEY environment variable (base64-encoded 32 bytes) or configure KEYVAULT_URI with CONFIG_ENCRYPTION_KEY secret.'
      );
    }

    const keyBuffer = Buffer.from(envKey, 'base64');
    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(`Invalid CONFIG_ENCRYPTION_KEY: expected ${KEY_LENGTH} bytes when base64-decoded, got ${keyBuffer.length}`);
    }

    return keyBuffer;
  } catch (error) {
    console.error('Failed to retrieve encryption key:', error);
    throw error;
  }
}

/**
 * Encrypts a plaintext secret using AES-256-GCM
 * @param plaintext The secret to encrypt
 * @returns Encrypted data with IV and authentication tag
 */
export async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  try {
    const key = await getEncryptionKey();
    const iv = randomBytes(12); // 96-bit IV for GCM
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();
    
    return {
      data: encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    };
  } catch (error) {
    console.error('Failed to encrypt secret:', error);
    
    // For development/testing purposes, if encryption isn't configured,
    // return a clearly marked insecure fallback
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.warn('⚠️  WARNING: Using insecure fallback for API key storage. Configure CONFIG_ENCRYPTION_KEY for production!');
      return {
        data: Buffer.from(plaintext, 'utf8').toString('base64'),
        iv: 'INSECURE_FALLBACK',
        tag: 'INSECURE_FALLBACK'
      };
    }
    
    throw new Error('Failed to encrypt secret - encryption key not configured');
  }
}

/**
 * Decrypts an encrypted secret using AES-256-GCM
 * @param encrypted The encrypted secret data
 * @returns Decrypted plaintext secret
 */
export async function decryptSecret(encrypted: EncryptedSecret): Promise<string> {
  try {
    // Handle insecure fallback for development/testing
    if (encrypted.iv === 'INSECURE_FALLBACK' && encrypted.tag === 'INSECURE_FALLBACK') {
      console.warn('⚠️  WARNING: Decrypting using insecure fallback. Configure CONFIG_ENCRYPTION_KEY for production!');
      return Buffer.from(encrypted.data, 'base64').toString('utf8');
    }
    
    const key = await getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, 'base64');
    const tag = Buffer.from(encrypted.tag, 'base64');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt secret:', error);
    throw new Error('Failed to decrypt secret - possibly wrong key or corrupted data');
  }
}

/**
 * Generates a new base64-encoded encryption key for setup purposes
 * @returns Base64-encoded 32-byte key
 */
export async function generateEncryptionKey(): Promise<string> {
  return randomBytes(KEY_LENGTH).toString('base64');
}
