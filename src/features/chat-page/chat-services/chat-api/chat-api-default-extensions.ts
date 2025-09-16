"use server";
import "server-only";

import { ServerActionResponse } from "@/features/common/server-action-response";
import { OpenAIDALLEInstance } from "@/features/common/services/openai";
import { uniqueId } from "@/features/common/util";
import { GetImageUrl, UploadImageToStore } from "../chat-image-service";
import { ChatThreadModel } from "../models";
import { imageGenerationService } from "@/features/image/services/image-generation.service";
import { getAvailableImageModels } from "@/features/common/config/image-config";

export const GetDefaultExtensions = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  signal: AbortSignal;
}): Promise<ServerActionResponse<Array<any>>> => {
  const defaultExtensions: Array<any> = [];

  // Add image creation Extension
  defaultExtensions.push({
    type: "function",
    function: {
      function: async (args: any) =>
        await executeCreateImage(
          args,
          props.chatThread,
          props.userMessage,
          props.signal
        ),
      parse: (input: string) => JSON.parse(input),
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          model: { 
            type: "string", 
            enum: getAvailableImageModels().map(m => m.id),
            description: "The image generation model to use. If not specified, uses the chat thread's default image model."
          },
        },
        required: ["prompt"]
      },
      description:
        "You must only use this tool if the user asks you to create an image. You must only use this tool once per message. Images must be displayed inline. Available models: " + getAvailableImageModels().map(m => `${m.id} (${m.name})`).join(", "),
      name: "create_img",
    },
  });

  // Add any other default Extension here

  return {
    status: "OK",
    response: defaultExtensions,
  };
};

// Extension for image creation using multiple models
async function executeCreateImage(
  args: { prompt: string; model?: string },
  chatThread: ChatThreadModel,
  userMessage: string,
  signal: AbortSignal
) {
  // Product decision: always use the exact user-entered message as the prompt sent to the image API.
  // The model may attempt to rewrite or expand the prompt in tool calls; that behavior is now disabled here.
  const prompt = (userMessage || args.prompt || "").trim();
  console.log("createImage called with prompt (user-supplied):", prompt);

  if (!prompt) {
    const validationError = new Error("No prompt provided");
    (validationError as any).isToolError = true;
    (validationError as any).functionName = 'create_img';
    throw validationError;
  }

  // Check the prompt length for different models
  if (prompt.length >= 4000) {
    const lengthError = new Error("Prompt is too long, it must be less than 4000 characters");
    (lengthError as any).isToolError = true;
    (lengthError as any).functionName = 'create_img';
    throw lengthError;
  }

  // Determine which model to use
  // Priority: chatThread.imageModelId > args.model > first available model
  // This ensures user's UI selection always takes precedence over AI's choice
  console.log(`🔍 Model Selection Debug:`);
  console.log(`  - args.model: ${args.model}`);
  console.log(`  - chatThread.imageModelId: ${chatThread.imageModelId}`);
  console.log(`  - Full chatThread:`, {
    id: chatThread.id,
    imageModelId: chatThread.imageModelId,
    modelId: chatThread.modelId,
    name: chatThread.name
  });
  
  let selectedModel = chatThread.imageModelId || args.model;
  const availableModels = getAvailableImageModels();
  
  console.log(`  - selectedModel (after priority): ${selectedModel}`);
  console.log(`  - availableModels: ${availableModels.map(m => m.id).join(', ')}`);
  
  if (!selectedModel && availableModels.length > 0) {
    selectedModel = availableModels[0].id;
    console.log(`  - using fallback model: ${selectedModel}`);
  }

  if (!selectedModel) {
    const noModelError = new Error("No image generation models are available");
    (noModelError as any).isToolError = true;
    (noModelError as any).functionName = 'create_img';
    throw noModelError;
  }

  // Validate the selected model is available
  const isValidModel = availableModels.some(m => m.id === selectedModel);
  if (!isValidModel) {
    const invalidModelError = new Error(`Invalid image model: ${selectedModel}. Available models: ${availableModels.map(m => m.id).join(', ')}`);
    (invalidModelError as any).isToolError = true;
    (invalidModelError as any).functionName = 'create_img';
    throw invalidModelError;
  }

  console.log(`✅ Using image generation model: ${selectedModel}`);

  let response;

  try {
    response = await imageGenerationService.generateImage({
      prompt,
      model: selectedModel as 'dall-e-3' | 'gpt-image-1',
      responseFormat: 'b64_json'
    });
  } catch (error: any) {
    console.error("🔴 Image generation error:\n", error);
    
    // Log the full error object to see all available properties
    console.error("🔴 Full error details:", JSON.stringify(error, null, 2));
    console.error("🔴 Error properties:", Object.keys(error));
    console.error("🔴 Error.error properties:", error?.error ? Object.keys(error.error) : 'No error.error property');
    
    // Specifically check for Azure OpenAI content filter structure
    if (error?.error?.inner_error) {
      console.error("🔴 Inner error found:", Object.keys(error.error.inner_error));
      if (error.error.inner_error.content_filter_results) {
        console.error("🔴 Content filter results found:", Object.keys(error.error.inner_error.content_filter_results));
        console.error("🔴 Content filter details:", JSON.stringify(error.error.inner_error.content_filter_results, null, 2));
      }
    }
    
    // Check for additional nested properties that might contain filter details
    if (error.headers) {
      console.error("🔴 Response headers:", Object.keys(error.headers));
    }
    
    // Log any additional properties that might contain filter details
    console.error("🔴 Full error object inspection:");
    for (const [key, value] of Object.entries(error)) {
      if (typeof value === 'object' && value !== null) {
        console.error(`  ${key}:`, Object.keys(value));
      }
    }
    
    // Handle content filter errors specifically
    if (error?.code === 'contentFilter' || error?.code === 'content_policy_violation' || error?.status === 400 || error?.error?.inner_error?.content_filter_results) {
      // --- Structured payload preparation ---
      interface BlockCategory { category: string; severity: string; filtered: boolean; }
      const blockedCategoriesStructured: BlockCategory[] = [];
      const blockId = uniqueId();
      const promptHash = (()=>{
        let h = 0; const str = prompt;
        for (let i=0; i<str.length; i++){ h = (h*31 + str.charCodeAt(i)) >>> 0; }
        return h.toString(16).padStart(8,'0');
      })();
      let detailedMessage = `🚫 **Image blocked by Azure Content Safety**`;
      
      // Add request ID if available for support purposes
      if (error.headers?.['apim-request-id'] || error.headers?.['x-ms-request-id']) {
        const requestId = error.headers['apim-request-id'] || error.headers['x-ms-request-id'];
        detailedMessage += `\n📋 Request ID: ${requestId}`;
      }
      
      // Add the basic error message
      if (error?.error?.message) {
        detailedMessage += `\n⚠️ ${error.error.message}`;
      }
      
      // Check for detailed content filter results (official Azure structure)
      let contentFilterResults = null;
      if (error?.error?.inner_error?.content_filter_results) {
        contentFilterResults = error.error.inner_error.content_filter_results;
      } else if (error?.error?.content_filter_results) {
        contentFilterResults = error.error.content_filter_results;
      }
      
      let filterCategorySummary: string[] = [];
      if (contentFilterResults) {
        detailedMessage += `\n\n📊 **Content Filter Analysis:**`;
        const categories = ['hate', 'sexual', 'violence', 'self_harm'];
        for (const category of categories) {
          const result = contentFilterResults[category];
          if (result) {
            const isFiltered = !!result.filtered;
            const severity = (result.severity || 'unknown').toLowerCase();
            blockedCategoriesStructured.push({ category, severity, filtered: isFiltered });
            if (isFiltered) {
              filterCategorySummary.push(`${category}:${severity}`);
              detailedMessage += `\n• ❌ **${category.toUpperCase()}**: Blocked (severity: ${severity})`;
            } else {
              detailedMessage += `\n• ✅ **${category.toUpperCase()}**: Allowed (severity: ${severity})`;
            }
          }
        }
        if (filterCategorySummary.length) {
          detailedMessage += `\n\n🚨 **Blocked Categories:** ${filterCategorySummary.join(', ')}`;
        }
      } else {
        detailedMessage += `\n\n🔍 **Content Filter Details:** Not available in response - using lexical analysis.`;
      }
      
      // Enhanced prompt analysis (regex-based, category-scoped with counts & dynamic suggestions)
  const originalPrompt = prompt;
      const promptLower = originalPrompt.toLowerCase();

      type CategoryKey = 'violence' | 'sexual' | 'hate' | 'self_harm';

      interface CategoryConfig {
        key: CategoryKey;
        label: string;
        patterns: { regex: RegExp; canonical: string; weight?: number }[];
        suggestion: string;
        safeReplacements?: string[];
        escalateIfTogether?: CategoryKey[]; // categories that worsen severity if co-occurring
        contextExclusions?: RegExp[]; // patterns that, if present near token, down-rank/ignore
      }

      const wordBoundary = (w: string) => new RegExp(`(?<![a-z0-9_])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9_])`, 'i');

      const categoriesConfig: CategoryConfig[] = [
        {
          key: 'violence',
          label: 'Violence',
            // Includes gore & weapon references
          patterns: [
            'battle','battles','fight','fighting','blood','bloody','gore','gory','weapon','weapons','gun','guns','rifle','pistol','knife','sword','war','warfare','dead body','corpse','death','kill','killing','attack','attacking','destroy','destruction','combat','wound','wounded','injury','injuries','beaten','shoot','shooting','explosion','explosive','grenade','burn','burning'
          ].map(t => ({ regex: wordBoundary(t), canonical: t })),
          suggestion: 'Reduce or remove explicit violence / weapon / gore terms; describe neutral actions or high-level context.',
          safeReplacements: ['training','practice','peaceful scene','historic setting','strategic board game'],
          escalateIfTogether: ['hate']
        },
        {
          key: 'sexual',
          label: 'Sexual',
          patterns: [
            'nude','nudity','naked','sexual','sexually','erotic','adult','explicit','provocative','seductive','intimate','sensual','lingerie','fetish','bedroom','kiss','kissing','cleavage','underwear','topless','bottomless'
          ].map(t => ({ regex: wordBoundary(t), canonical: t })),
          // Context exclusions: phrases indicating conceptual/non-sexual usage
          contextExclusions: [
            /post-apocalyptic/i,
            /scene/i,
            /environment/i,
            /atmosphere/i,
            /stylized/i,
            /comic book/i,
            /emphasizing mood/i,
          ],
          suggestion: 'Remove sexual descriptors; focus on neutral appearance, pose, or context.',
          safeReplacements: ['professional attire','neutral clothing','artistic style','portrait style']
        },
        {
          key: 'hate',
          label: 'Hate / Harassment',
          patterns: [
            'hate','hating','nazi','terrorist','terrorism','supremacist','racist','racism','discrimination','slur','bigot','ethnic cleansing','genocide','kill them','wipe out'
          ].map(t => ({ regex: wordBoundary(t), canonical: t })),
          suggestion: 'Remove hateful / extremist / dehumanizing language; use neutral, inclusive wording.',
          safeReplacements: ['group','people','community','team','audience']
        },
        {
          key: 'self_harm',
          label: 'Self-harm',
          patterns: [
            'suicide','suicidal','self-harm','self harm','cutting','overdose','depression','self-injury','self injury','self-mutilation','self mutilation','harm myself','end my life','kill myself'
          ].map(t => ({ regex: wordBoundary(t), canonical: t })),
          suggestion: 'Remove self-harm references; reframe toward supportive, positive, or recovery-oriented themes.',
          safeReplacements: ['support','help','well-being','encouragement','resilience']
        }
      ];

      interface MatchInfo { token: string; index: number; }
      const categoryMatches: Record<CategoryKey, MatchInfo[]> = {
        violence: [], sexual: [], hate: [], self_harm: []
      };

      // Collect matches with indices for potential future context improvements
      categoriesConfig.forEach(cat => {
        cat.patterns.forEach(p => {
          let match: RegExpExecArray | null;
          const regex = new RegExp(p.regex.source, 'gi');
          while ((match = regex.exec(originalPrompt)) !== null) {
            // Apply context exclusion for sexual category: look at surrounding window
            if (cat.key === 'sexual' && cat.contextExclusions?.length) {
              const windowStart = Math.max(0, match.index - 60);
              const windowEnd = Math.min(originalPrompt.length, match.index + p.canonical.length + 60);
              const contextWindow = originalPrompt.slice(windowStart, windowEnd);
              const excluded = cat.contextExclusions.some(rx => rx.test(contextWindow));
              if (excluded && p.canonical === 'explicit') {
                // skip counting 'explicit' when used in non-sexual atmospheric context
                continue;
              }
            }
            categoryMatches[cat.key].push({ token: p.canonical, index: match.index });
          }
        });
      });

      const anyMatches = Object.values(categoryMatches).some(arr => arr.length > 0);
  if (anyMatches) {
        detailedMessage += `\n\n🔍 **Detected category indicators (token counts):**`;
        (Object.keys(categoryMatches) as CategoryKey[]).forEach(key => {
          const list = categoryMatches[key];
          if (list.length) {
            // Summarize unique tokens with counts
            const counts = list.reduce<Record<string, number>>((acc, m) => { acc[m.token] = (acc[m.token] || 0) + 1; return acc; }, {});
            const summary = Object.entries(counts)
              .sort((a,b) => b[1]-a[1])
              .slice(0, 8)
              .map(([tok, c]) => `${tok}${c>1?`×${c}`:''}`)
              .join(', ');
            detailedMessage += `\n• ${key}: ${list.length} match(es) → ${summary}`;
          }
        });

        // Suggestion block
        detailedMessage += `\n\n💡 **Suggestions:**`;
        categoriesConfig.forEach(cat => {
          if (categoryMatches[cat.key].length) {
            const uniqueTokens = Array.from(new Set(categoryMatches[cat.key].map(m => m.token))).slice(0,6);
            detailedMessage += `\n• **${cat.label}**: ${cat.suggestion}`;
            if (uniqueTokens.length) {
              detailedMessage += ` (triggered by: ${uniqueTokens.join(', ')})`;
            }
            if (cat.safeReplacements && cat.safeReplacements.length) {
              detailedMessage += `\n  → Try: ${cat.safeReplacements.slice(0,4).join(', ')}`;
            }
          }
        });

        // Cross-category escalation note (basic example: violence + hate)
  if (categoryMatches['violence'].length && categoryMatches['hate'].length) {
          detailedMessage += `\n\n⚠️ Combined violent + hateful terms can elevate severity—remove one or both categories entirely.`;
        }
      } else {
        detailedMessage += `\n\n🔍 **No direct high-risk tokens matched**`;
        detailedMessage += `\n💡 The block may be due to contextual phrasing, implied harm, or internal prompt expansion. Try neutral, descriptive language.`;
      }
      
      // Secondary heuristic: high ratio of intense words (signal subtle violent tone)
      if (!categoryMatches.violence.length) {
        const intensityWords = ['severe','extreme','brutal','aggressive','bloody','horrific'];
        const intensityHits = intensityWords.filter(w => promptLower.includes(w));
        if (intensityHits.length) {
          detailedMessage += `\n\nℹ️ Detected intensity terms: ${intensityHits.join(', ')} — softening them may help.`;
        }
      }
      
      // Extract detailed filter information if available (for future API versions)
      if (error?.error?.content_filter_results) {
        detailedMessage += `\n\n📊 **Content Filter Details:**`;
        const filterResults = error.error.content_filter_results;
        
        for (const [category, result] of Object.entries(filterResults)) {
          if (result && typeof result === 'object') {
            const resultObj = result as any;
            detailedMessage += `\n• ${category}: ${resultObj.filtered ? '❌ BLOCKED' : '✅ ALLOWED'}`;
            if (resultObj.severity) {
              detailedMessage += ` (severity: ${resultObj.severity})`;
            }
          }
        }
      }
      
  // We'll append Original prompt later after adding a suggested sanitized version (if any)
  detailedMessage += `\n\n🔄 **Try:** Rephrasing with different words or removing potentially sensitive terms.`;

      // --- Build structured payload ---
      const tokenSummary: Record<string, { count: number; samples: string[] }> = {};
      (Object.keys(categoryMatches) as CategoryKey[]).forEach(key => {
        if (categoryMatches[key].length) {
          const counts = categoryMatches[key].reduce<Record<string, number>>((acc, m) => { acc[m.token] = (acc[m.token]||0)+1; return acc; }, {});
          tokenSummary[key] = {
            count: categoryMatches[key].length,
            samples: Object.keys(counts).slice(0,5)
          };
        }
      });
      const suggestions: string[] = [];
      categoriesConfig.forEach(cat => {
        if (categoryMatches[cat.key].length) {
          suggestions.push(`${cat.label}: ${cat.suggestion}`);
        }
      });
  detailedMessage += `\n\n📝 **Original prompt:** "${prompt}"`;

      const payload = {
        kind: 'image_block',
        source: 'api_content_filter',
        requestId: error.headers?.['apim-request-id'] || error.headers?.['x-ms-request-id'],
  originalPromptExcerpt: prompt.slice(0,240),
        blockId,
        promptHash,
        blockedCategories: filterCategorySummary,
        tokenSummary,
        suggestions,
  retryAllowed: false,
        guidanceVersion: 'v2',
        schemaVersion: 1,
        timestamp: Date.now(),
      };
  // (sanitized prompt feature removed)
      
      // Create a custom error with a special marker that the stream handler can detect
      const contentFilterError = new Error(detailedMessage);
      (contentFilterError as any).isContentFilterError = true;
      (contentFilterError as any).functionName = 'create_img';
      (contentFilterError as any).payload = payload;
      throw contentFilterError;;;
    }
    
  // For other (non content-filter) errors, throw but DO NOT mark as content filter
  const apiError = new Error("There was an error creating the image: " + error + " Return this message to the user and halt execution.");
  (apiError as any).isToolError = true;
  (apiError as any).functionName = 'create_img';
  throw apiError;
  }

  // Check the response is valid
  if (
    !response.data ||
    !Array.isArray(response.data) ||
    !response.data[0] ||
    response.data[0].b64_json === undefined
  ) {
  // Treat a structurally successful call without image data as a model refusal / safety block
  const refusalMessage = `🚫 **Image request not fulfilled (model_refusal)**\nThe model did not return image data for this request. This often indicates an internal safety or policy refusal even if no explicit content filter error was raised.\n\n📝 **Original prompt:** "${prompt}"\n\n🔄 **Try:** Adjust wording to remove explicit conflict, weapons, injury, or gore; focus on neutral descriptors.`;
  const modelRefusalError = new Error(refusalMessage);
  (modelRefusalError as any).isContentFilterError = true;
  (modelRefusalError as any).functionName = 'create_img';
  (modelRefusalError as any).payload = {
    kind: 'image_block',
    source: 'model_refusal',
  originalPromptExcerpt: prompt.slice(0,240),
    blockedCategories: [],
    tokenSummary: {},
    suggestions: ['General: Remove explicit conflict / harm terms; use neutral descriptive language.'],
  retryAllowed: false,
    blockId: uniqueId(),
  promptHash: (()=>{ let h=0; for (let i=0;i<prompt.length;i++){ h=(h*31+prompt.charCodeAt(i))>>>0;} return h.toString(16).padStart(8,'0'); })(),
    guidanceVersion: 'v2',
    schemaVersion: 1,
    timestamp: Date.now(),
  };
  throw modelRefusalError;
  }

  // upload image to blob storage
  const imageName = `${uniqueId()}.png`;

  try {
    await UploadImageToStore(
      chatThread.id,
      imageName,
      Buffer.from(response.data[0].b64_json, "base64")
    );

    const updated_response = {
      revised_prompt: response.data[0].revised_prompt,
      url: await GetImageUrl(chatThread.id, imageName),
    };

    return updated_response;
  } catch (error) {
    console.error("🔴 error:\n", error);
  const storageError = new Error("There was an error storing the image: " + error + " Please try again or contact support if the issue persists.");
  (storageError as any).isToolError = true;
  (storageError as any).functionName = 'create_img';
    throw storageError;
  }
}
