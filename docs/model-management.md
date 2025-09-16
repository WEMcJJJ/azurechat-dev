# Model Management System

This document describes the new model management system for Azure Chat that replaces environment variable-based Azure OpenAI configuration with a dynamic, database-driven approach.

## Overview

The model management system provides:

- **Dynamic Configuration**: Store Azure OpenAI connections in Cosmos DB instead of environment variables
- **Multiple Models**: Support for multiple AI models with different configurations
- **Admin Management**: Web-based admin interface for CRUD operations
- **Security**: AES-256-GCM encryption for API keys using Azure Key Vault
- **User Experience**: Model selection dropdown in chat interface
- **Backward Compatibility**: Fallback to environment variables during transition

## Architecture

### Core Components

1. **Types** (`src/types/models.ts`)
   - `ModelConfig`: Complete model configuration with encrypted API key
   - `PublicModel`: Public-facing model data for dropdowns
   - `AdminModelView`: Admin view excluding encrypted secrets
   - `ModelConfigInput`: Input validation for admin operations

2. **Encryption Service** (`src/server/services/cryptoService.ts`)
   - AES-256-GCM encryption/decryption
   - Azure Key Vault integration with environment fallback
   - Secure API key storage

3. **Model Repository** (`src/server/repositories/modelRepository.ts`)
   - CRUD operations for model configurations
   - 60-second caching for performance
   - Admin authorization checks

4. **Client Factory** (`src/server/services/aoaiClientFactory.ts`)
   - Creates OpenAI client instances using model configurations
   - Supports fallback to environment variables
   - Model-aware client creation

5. **API Routes**
   - `GET /api/models`: Public model list for authenticated users
   - `POST/PUT/DELETE /api/admin/models/*`: Admin CRUD operations

6. **Admin UI** (`src/features/admin-models/`)
   - React-based management interface
   - Model CRUD operations with validation
   - Responsive design with proper error handling

## Database Schema

Models are stored in the `models` container in Cosmos DB:

```typescript
{
  "id": "model-unique-id",
  "type": "MODEL_CONFIG",
  "friendlyName": "GPT-4 Turbo",
  "provider": "azure-openai",
  "instanceName": "my-openai-instance",
  "deploymentName": "gpt-4-turbo",
  "apiVersion": "2024-10-21",
  "apiKeyEnc": {
    "data": "encrypted-data",
    "iv": "initialization-vector",
    "tag": "authentication-tag"
  },
  "enabled": true,
  "isDefault": true,
  "sortOrder": 100,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "createdBy": "user-hash",
  "updatedBy": "user-hash"
}
```

## Environment Variables

### Required for Encryption

```bash
# Azure Key Vault (recommended)
AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
MODEL_ENCRYPTION_KEY_NAME=model-encryption-key

# OR fallback encryption key (less secure)
MODEL_ENCRYPTION_KEY=your-256-bit-hex-key
```

### Legacy Variables (for fallback)

```bash
# These remain for backward compatibility
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_INSTANCE_NAME=your-instance
AZURE_OPENAI_API_DEPLOYMENT_NAME=your-deployment
AZURE_OPENAI_API_VERSION=2024-10-21
```

## Migration Guide

### 1. Set Up Encryption

First, configure encryption using Azure Key Vault (recommended):

```bash
# Create a key in Azure Key Vault
az keyvault key create --vault-name your-keyvault --name model-encryption-key --kty RSA

# Set environment variables
export AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
export MODEL_ENCRYPTION_KEY_NAME=model-encryption-key
```

Or use a fallback encryption key:

```bash
# Generate a 256-bit key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set environment variable
export MODEL_ENCRYPTION_KEY=your-generated-key
```

### 2. Run Migration Script

The migration script reads your existing environment variables and creates model configurations in Cosmos DB:

```bash
# Run migration
npx tsx scripts/migrate-env-to-cosmos.ts
```

The script will:
- Read existing environment variables
- Create encrypted model configurations in Cosmos DB
- Set appropriate default models
- Provide verification steps

### 3. Update Code Usage

Replace direct OpenAI client creation:

```typescript
// Old approach
import { OpenAIInstance } from "@/features/common/services/openai";
const openai = OpenAIInstance();

// New approach
import { getOpenAIInstance } from "@/features/common/services/openai";
const openai = await getOpenAIInstance(thread.modelId);
```

### 4. Admin Configuration

1. Navigate to `/admin/models` in your application
2. Verify migrated models appear correctly
3. Add additional models as needed
4. Set appropriate default models
5. Test model selection in chat interface

### 5. Remove Environment Variables (Optional)

After verifying the new system works:

1. Test thoroughly with model-based configuration
2. Remove legacy environment variables from deployment
3. Update CI/CD pipelines to use Cosmos DB configuration

## API Usage

### Public API (Authenticated Users)

```typescript
// Get available models for dropdown
const response = await fetch('/api/models');
const models: PublicModel[] = await response.json();
```

### Admin API (Admin Users Only)

```typescript
// List all models (admin view)
const response = await fetch('/api/admin/models');
const models: AdminModelView[] = await response.json();

// Create/update model
const response = await fetch('/api/admin/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'my-model',
    friendlyName: 'My Custom Model',
    instanceName: 'my-instance',
    deploymentName: 'my-deployment',
    apiVersion: '2024-10-21',
    apiKeyPlaintext: 'my-api-key',
    enabled: true,
    isDefault: false,
    sortOrder: 200
  })
});

// Delete model
await fetch('/api/admin/models/my-model', { method: 'DELETE' });
```

## Security Considerations

### API Key Protection

- API keys are encrypted at rest using AES-256-GCM
- Encryption keys stored in Azure Key Vault (recommended)
- Never expose plaintext API keys in responses
- Admin APIs require proper authorization

### Access Control

- Public model API requires authentication
- Admin APIs require admin role
- Model selection restricted to enabled models
- Audit trail via `createdBy`/`updatedBy` fields

### Best Practices

1. **Use Azure Key Vault** for encryption key management
2. **Rotate encryption keys** periodically
3. **Monitor admin access** to model management
4. **Validate model configurations** before enabling
5. **Test thoroughly** before removing environment variables

## Troubleshooting

### Common Issues

1. **Encryption Key Not Found**
   ```
   Error: Encryption key not found in Key Vault
   ```
   - Verify `AZURE_KEY_VAULT_URL` and `MODEL_ENCRYPTION_KEY_NAME`
   - Ensure application has access to Key Vault
   - Check if key exists in specified Key Vault

2. **Model Not Found**
   ```
   Error: No enabled models found
   ```
   - Run migration script to create initial models
   - Check models are enabled in admin panel
   - Verify Cosmos DB connectivity

3. **Admin Access Denied**
   ```
   Error: Admin access required
   ```
   - Verify user has admin role
   - Check authentication middleware
   - Review role-based access control settings

### Debugging

Enable debug logging:

```bash
export DEBUG=azurechat:models
```

Check model cache status:

```typescript
import { listEnabledModels } from "@/server/repositories/modelRepository";
const result = await listEnabledModels();
console.log('Cached models:', result);
```

## Performance Considerations

- Model configurations cached for 60 seconds
- Cache invalidated on model updates
- Minimal impact on chat response times
- Encryption/decryption overhead is negligible

## Future Enhancements

- **Model Types**: Support for different AI providers (OpenAI, Anthropic, etc.)
- **Usage Analytics**: Track model usage and costs
- **Rate Limiting**: Per-model rate limits and quotas
- **Model Validation**: Test model configurations before saving
- **Bulk Operations**: Import/export model configurations
- **Model Versioning**: Track configuration changes over time

## Contributing

When adding new features to the model management system:

1. Update type definitions in `src/types/models.ts`
2. Add repository functions in `src/server/repositories/modelRepository.ts`
3. Create corresponding API endpoints
4. Update admin UI components
5. Add comprehensive tests
6. Update this documentation

## Support

For issues with the model management system:

1. Check this documentation for common solutions
2. Review application logs for specific error messages
3. Verify environment configuration
4. Test with migration script if models are missing
5. Create an issue with detailed error information
