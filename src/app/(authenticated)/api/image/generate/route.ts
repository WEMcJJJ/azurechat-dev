import { NextRequest, NextResponse } from 'next/server';
import { imageGenerationService } from '@/features/image/services/image-generation.service';
import { getCurrentUser } from '@/features/auth-page/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, model, size, quality, style, n, responseFormat } = body;

    if (!prompt || !model) {
      return NextResponse.json(
        { error: 'Prompt and model are required' },
        { status: 400 }
      );
    }

    // Validate model is supported
    const supportedModels = ['dall-e-3', 'gpt-image-1'];
    if (!supportedModels.includes(model)) {
      return NextResponse.json(
        { error: `Unsupported model: ${model}. Supported models: ${supportedModels.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await imageGenerationService.generateImage({
      prompt,
      model,
      size,
      quality,
      style,
      n,
      responseFormat,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
