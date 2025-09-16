import { NextRequest, NextResponse } from 'next/server';
import { imageGenerationService } from '@/features/image/services/image-generation.service';

export async function GET(request: NextRequest) {
  try {
    const models = imageGenerationService.getAvailableModels();
    return NextResponse.json(models);
  } catch (error) {
    console.error('Error fetching image models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available image models' },
      { status: 500 }
    );
  }
}
