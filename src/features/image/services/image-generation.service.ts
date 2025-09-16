import { ImageGenerationConfig, validateImageModelConfig, ImageModel, getAvailableImageModels } from '@/features/common/config/image-config';
import { ServerActionResponse } from '@/features/common/server-action-response';

export interface ImageGenerationRequest {
  prompt: string;
  model: 'dall-e-3' | 'gpt-image-1';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  n?: number;
  responseFormat?: 'url' | 'b64_json';
}

export interface ImageGenerationResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  created: number;
}

class ImageGenerationService {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    console.log('🚀 Image Generation Service - Request received:');
    console.log('  - Selected Model:', request.model);
    console.log('  - Prompt:', request.prompt.substring(0, 100) + (request.prompt.length > 100 ? '...' : ''));
    
    const configResult = validateImageModelConfig(request.model);
    if (configResult.status !== "OK") {
      throw new Error(configResult.errors[0].message);
    }

    const config = configResult.response;

    switch (request.model) {
      case 'dall-e-3':
        console.log('📍 Routing to DALL-E 3 handler');
        return this.generateWithDallE3(request, config);
      case 'gpt-image-1':
        console.log('📍 Routing to GPT-image-1 handler');
        return this.generateWithGptImage1(request, config);
      default:
        throw new Error(`Unsupported image generation model: ${request.model}`);
    }
  }

  private async generateWithDallE3(
    request: ImageGenerationRequest,
    config: ImageGenerationConfig
  ): Promise<ImageGenerationResponse> {
    const url = `https://${config.instanceName}.openai.azure.com/openai/deployments/${config.deploymentName}/images/generations?api-version=${config.apiVersion}`;
    
    console.log('🎨 DALL-E 3 Image Generation Request:');
    console.log('  - Model:', request.model);
    console.log('  - Endpoint URL:', url);
    console.log('  - Instance:', config.instanceName);
    console.log('  - Deployment:', config.deploymentName);
    console.log('  - API Version:', config.apiVersion);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        size: request.size || '1024x1024',
        quality: request.quality || 'standard',
        style: request.style || 'vivid',
        n: request.n || 1,
        response_format: request.responseFormat || 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`DALL-E 3 API error: ${errorData.error?.message || response.statusText}`);
    }

    return response.json();
  }

  private async generateWithGptImage1(
    request: ImageGenerationRequest,
    config: ImageGenerationConfig
  ): Promise<ImageGenerationResponse> {
    if (!config.instanceName || !config.deploymentName) {
      throw new Error('GPT-image-1 instance name and deployment name are not configured');
    }

    // Construct the URL using the same endpoint as DALL-E: /images/generations
    const apiUrl = `https://${config.instanceName}.openai.azure.com/openai/deployments/${config.deploymentName}/images/generations?api-version=${config.apiVersion}`;
    
    console.log('🎨 GPT-image-1 Image Generation Request:');
    console.log('  - Model:', request.model);
    console.log('  - Endpoint URL:', apiUrl);
    console.log('  - Instance:', config.instanceName);
    console.log('  - Deployment:', config.deploymentName);
    console.log('  - API Version:', config.apiVersion);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: 'gpt-image-1',
        size: request.size || '1024x1024',
        n: request.n || 1,
        quality: request.quality || 'high',
        // Note: GPT-image-1 always returns base64, no response_format needed
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`GPT-image-1 API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    
    // GPT-image-1 returns the same format as DALL-E 3 but always with b64_json
    // No transformation needed - just return the result directly
    return result;
  }

  getAvailableModels(): ImageModel[] {
    return getAvailableImageModels();
  }
}

export const imageGenerationService = new ImageGenerationService();
