import { Injectable, signal } from '@angular/core';

export interface CustomModel {
  id: string;
  name: string;
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'custom';
  baseEndpoint?: string;
  imageSupport: boolean;
  status: 'active' | 'disabled';
  apiVersion?: string;
  timeout?: number;
  maxImageSize?: number; // in MB
  maxTokens?: number;
  temperature?: number;
  additionalHeaders?: string; // JSON string
}

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private readonly MODELS_KEY = 'style_replicator_custom_models';

  // Available models signal
  customModels = signal<CustomModel[]>([]);

  // Default models that are built-in
  defaultModels = [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (Built-in)',
      provider: 'google' as const,
      imageSupport: true,
      status: 'active' as const
    }
  ];

  constructor() {
    this.loadModels();
  }

  private loadModels() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.MODELS_KEY);
      if (stored) {
        try {
          this.customModels.set(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored models', e);
          this.customModels.set([]);
        }
      }
    }
  }

  private saveModels(models: CustomModel[]) {
    this.customModels.set(models);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.MODELS_KEY, JSON.stringify(models));
    }
  }

  getAllModels() {
    const activeCustoms = this.customModels().filter(m => m.status === 'active');
    return [
      ...this.defaultModels,
      ...this.customModels() // return all so management can list disabled ones too
    ];
  }

  getActiveModels() {
    return [
      ...this.defaultModels,
      ...this.customModels().filter(m => m.status === 'active')
    ];
  }

  addModel(model: Omit<CustomModel, 'id'>): { success: boolean; message: string; model?: CustomModel } {
    // Validate required fields
    if (!model.name || !model.name.trim()) {
      return { success: false, message: 'Model Name is required.' };
    }
    if (!model.apiKey || !model.apiKey.trim()) {
      return { success: false, message: 'API Key is required.' };
    }

    // Check duplicate name
    const nameLower = model.name.toLowerCase().trim();
    const isDuplicate = this.customModels().some(m => m.name.toLowerCase().trim() === nameLower) ||
                        this.defaultModels.some(m => m.name.toLowerCase().trim() === nameLower);
    
    if (isDuplicate) {
      return { success: false, message: 'A model with this name already exists.' };
    }

    // Parse headers if provided to ensure valid JSON
    if (model.additionalHeaders && model.additionalHeaders.trim()) {
      try {
        JSON.parse(model.additionalHeaders);
      } catch (e) {
        return { success: false, message: 'Additional Headers must be valid JSON.' };
      }
    }

    const newModel: CustomModel = {
      ...model,
      id: crypto.randomUUID()
    };

    const updated = [...this.customModels(), newModel];
    this.saveModels(updated);

    return { success: true, message: 'Model registered successfully.', model: newModel };
  }

  updateModel(id: string, updates: Partial<CustomModel>): { success: boolean; message: string } {
    const models = this.customModels();
    const index = models.findIndex(m => m.id === id);
    if (index === -1) {
      return { success: false, message: 'Model not found.' };
    }

    if (updates.name && updates.name.trim()) {
      const nameLower = updates.name.toLowerCase().trim();
      const isDuplicate = models.some((m, idx) => idx !== index && m.name.toLowerCase().trim() === nameLower);
      if (isDuplicate) {
        return { success: false, message: 'A model with this name already exists.' };
      }
    }

    if (updates.additionalHeaders && updates.additionalHeaders.trim()) {
      try {
        JSON.parse(updates.additionalHeaders);
      } catch (e) {
        return { success: false, message: 'Additional Headers must be valid JSON.' };
      }
    }

    const updatedModel = { ...models[index], ...updates };
    const updated = [...models];
    updated[index] = updatedModel;
    this.saveModels(updated);

    return { success: true, message: 'Model updated successfully.' };
  }

  deleteModel(id: string): { success: boolean; message: string } {
    const models = this.customModels();
    const filtered = models.filter(m => m.id !== id);
    if (filtered.length === models.length) {
      return { success: false, message: 'Model not found.' };
    }
    this.saveModels(filtered);
    return { success: true, message: 'Model deleted successfully.' };
  }

  async runCustomModelAnalysis(
    model: CustomModel,
    base64Image: string,
    mimeType: string,
    prompt: string
  ): Promise<any> {
    const endpoint = model.baseEndpoint || this.getStandardEndpoint(model.provider);
    if (!endpoint) {
      throw new Error(`Endpoint is required for custom provider: ${model.provider}`);
    }

    const cleanBase64 = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Provider specific authentication
    if (model.provider === 'openai' || model.provider === 'groq' || model.provider === 'openrouter' || model.provider === 'custom') {
      headers['Authorization'] = `Bearer ${model.apiKey}`;
    } else if (model.provider === 'anthropic') {
      headers['x-api-key'] = model.apiKey;
      headers['anthropic-version'] = model.apiVersion || '2023-06-01';
      headers['anthropic-dangerously-allow-the-browser'] = 'true';
    }

    // Additional custom headers
    if (model.additionalHeaders) {
      try {
        const parsedHeaders = JSON.parse(model.additionalHeaders);
        Object.assign(headers, parsedHeaders);
      } catch (e) {
        console.error('Failed to parse additional headers', e);
      }
    }

    let body: any = {};
    const systemInstruction = `
      You are an expert fashion stylist, photographer, and pose coach. 
      Analyze the uploaded image and generate a structured JSON response.
      You MUST return valid JSON matching this exact schema:
      {
        "recreation_prompt": "The full, optimized paragraph prompt. Include --ar aspect ratio tag at the end.",
        "structured_prompt": {
          "subject": "Description of the main subject, action, and expression.",
          "outfit": "Detailed breakdown of clothing, colors, fabrics, and accessories.",
          "environment": "Setting, background context, and atmosphere.",
          "lighting": "Lighting type (e.g., natural, studio, cinematic), direction, and mood.",
          "camera": "Camera gear, lens choice (e.g., 35mm, 85mm), aperture, and angle.",
          "style": "Artistic style, film stock, color grading, and aesthetic vibe."
        },
        "negative_prompt": "A comma-separated string of negative terms.",
        "negative_prompt_items": ["bad anatomy", "text", "watermark"],
        "aspect_ratio": "The aspect ratio string (e.g., '--ar 16:9').",
        "outfit_data": {
          "style_analysis": "Description of the overall fashion aesthetic.",
          "items": [
            {
              "name": "Specific Item Name",
              "details": "Material, fit, color nuances.",
              "search_term": "Optimized shopping search query"
            }
          ]
        },
        "pose": {
          "name": "Name of the CURRENT pose.",
          "details": "Detailed technical description of limbs, head tilt, weight distribution.",
          "instructions": [
            "Exact instruction 1",
            "Exact instruction 2"
          ]
        }
      }
    `;

    if (model.provider === 'openai' || model.provider === 'groq' || model.provider === 'openrouter' || model.provider === 'custom') {
      body = {
        model: model.name,
        messages: [
          {
            role: 'system',
            content: systemInstruction
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${cleanBase64}`
                }
              }
            ]
          }
        ],
        temperature: model.temperature !== undefined ? model.temperature : 0.2,
        max_tokens: model.maxTokens || 4000
      };

      if (model.provider === 'openai') {
        body.response_format = { type: 'json_object' };
      }
    } else if (model.provider === 'anthropic') {
      body = {
        model: model.name,
        max_tokens: model.maxTokens || 4000,
        temperature: model.temperature !== undefined ? model.temperature : 0.2,
        system: systemInstruction,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: cleanBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (model.timeout || 60) * 1000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
      }

      const resData = await response.json();
      return this.normalizeApiResponse(resData, model.provider);

    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Request timed out. Please check model timeout configuration.');
      }
      throw e;
    }
  }

  private getStandardEndpoint(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      case 'anthropic':
        return 'https://api.anthropic.com/v1/messages';
      case 'groq':
        return 'https://api.groq.com/openai/v1/chat/completions';
      case 'openrouter':
        return 'https://openrouter.ai/api/v1/chat/completions';
      default:
        return '';
    }
  }

  private normalizeApiResponse(data: any, provider: string): any {
    try {
      let rawText = '';
      if (provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'custom') {
        rawText = data?.choices?.[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        rawText = data?.content?.[0]?.text || '';
      }

      // Extract JSON block if response is wrapped in markdown ```json ... ```
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : rawText;

      const parsed = JSON.parse(jsonString.trim());
      
      // Basic normalization check
      if (!parsed.recreation_prompt) {
        parsed.recreation_prompt = parsed.summary || 'A professional recreation of the input style.';
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse and normalize custom model response:', e, data);
      throw new Error('The model response could not be parsed into the expected JSON structure. Ensure the model supports system instructions and returns valid JSON.');
    }
  }
}
