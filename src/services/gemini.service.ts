
import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = (typeof process !== 'undefined' && process.env) 
      ? (process.env['API_KEY'] || process.env['GEMINI_API_KEY']) 
      : '';
    this.ai = new GoogleGenAI({ 
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || error?.toString() || '';
      const isTransient = msg.includes('503') || 
                          msg.includes('500') || 
                          msg.toLowerCase().includes('overloaded') || 
                          msg.toLowerCase().includes('demand') ||
                          msg.toLowerCase().includes('unavailable') ||
                          msg.toLowerCase().includes('temporary');
                          
      if (retries > 0 && isTransient) {
        console.warn(`Gemini API returned transient error. Retrying in ${delay}ms... (Attempts left: ${retries})`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryWithBackoff(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  private handleError(error: any): never {
    console.error('Gemini API Error:', error);
    const msg = error?.message || error?.toString() || '';

    let userMessage = "An unexpected error occurred.";

    if (msg.includes('403') || msg.toLowerCase().includes('api key')) {
      userMessage = "Access Denied: Invalid or missing API Key. Please check your metadata.json or env setup.";
    } else if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('exhausted')) {
      userMessage = "Rate Limit Exceeded: Too many requests. Please wait a moment and try again.";
    } else if (msg.includes('503') || msg.includes('500') || msg.toLowerCase().includes('overloaded')) {
      userMessage = "Service Unavailable: Google AI service is temporarily overloaded. Try again later.";
    } else if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked')) {
      userMessage = "Safety Block: The image or prompt triggered content safety filters.";
    } else if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
      userMessage = "Network Error: Unable to reach Google servers. Check your connection.";
    } else if (msg.toLowerCase().includes('invalid_argument') || msg.includes('400')) {
      userMessage = "Invalid Request: The image format may not be supported or is corrupted.";
    } else if (msg.length > 0 && msg.length < 200) {
      userMessage = `Error: ${msg}`;
    }

    throw new Error(userMessage);
  }

  async analyzeImageAndGetPrompt(
    base64Image: string, 
    mimeType: string, 
    genderPreference: 'female' | 'male' = 'female',
    analysisFocus: 'general' | 'pose' | 'outfit' = 'general'
  ): Promise<any> {
    try {
      const cleanBase64 = base64Image.includes('base64,') 
        ? base64Image.split('base64,')[1] 
        : base64Image;

      const model = 'gemini-2.5-flash';
      
      const genderContext = genderPreference === 'male' 
        ? "The user is interested in MALE fashion and poses." 
        : "The user is interested in FEMALE fashion and poses (prioritize these).";

      let focusInstruction = "";
      if (analysisFocus === 'pose') {
        focusInstruction = `
          PRIORITY: POSE IDENTIFICATION & RECREATION.
          1. Identify the pose precisely. If it corresponds to a named pose (e.g. 'Contrapposto', 'Pigeon Pose'), use that name.
          2. **CRITICAL:** If the pose DOES NOT have a standard name, you MUST create a descriptive title (e.g. 'Seated Forward Lean with Crossed Arms').
          3. You MUST provide a "How-To" guide that explains EXACTLY how to position the body to match the image. Focus on joint angles, weight distribution, head tilt, and hand placement.
        `;
      } else if (analysisFocus === 'outfit') {
        focusInstruction = "PRIORITY: FASHION & STYLE. Focus deeply on fabric textures, brand identification (if any), and styling details.";
      }

      const promptText = `
        You are an expert fashion stylist, photographer, and pose coach specializing in high-end, confident, and alluring aesthetics.
        ${genderContext}
        ${focusInstruction}
        
        Analyze the uploaded image and generate a structured JSON response.

        Your goals:
        1. Create a high-fidelity image generation prompt (the "recreation_prompt").
        2. Break down the prompt into structural components.
        3. Identify the aspect ratio.
        4. Create negative prompt keywords.
        5. Analyze outfit and current pose.
        6. **Generate 3 Alternative Pose Suggestions**: Suggest 3 specific, distinct, "hot, sexy, and high-fashion" poses that would look amazing with this specific outfit. 
           - Focus on confidence, body lines, and allure. 
           - Ensure they are physically descriptive.
           - If the uploaded image is just an outfit (no person), suggest poses that would sell the outfit best.

        Return JSON with this EXACT schema:
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
          "negative_prompt_items": ["bad anatomy", "text", "watermark", "specific artifact to avoid 1", "specific artifact to avoid 2"],
          "aspect_ratio": "The aspect ratio string (e.g., '--ar 16:9').",
          "outfit_data": {
            "style_analysis": "Description of the overall fashion aesthetic.",
            "items": [
              {
                "name": "Specific Item Name",
                "details": "Material, fit, color nuances.",
                "search_term": "Optimized shopping search query string"
              }
            ]
          },
          "pose": {
            "name": "Name of the CURRENT pose. If unknown, use a descriptive title.",
            "details": "Detailed technical description of limbs, head tilt, weight distribution.",
            "instructions": [
              "Exact instruction 1 (e.g. 'Shift weight to left hip')",
              "Exact instruction 2 (e.g. 'Extend right arm at 45 degree angle')",
              "..."
            ]
          },
          "suggested_poses": [
            {
              "title": "Creative Name for the Pose (e.g. 'The S-Curve Smolder')",
              "vibe": "Adjectives describing the mood (e.g., 'Confident', 'Sultry', 'Playful')",
              "instructions": "Clear, step-by-step guide on how to perform this pose.",
              "why_it_works": "Brief explanation of why this fits the outfit."
            }
          ],
          "technical": {
            "camera_settings": "Estimated Focal length, Aperture, ISO vibe.",
            "lighting_setup": "Direction, quality, sources.",
            "environment_desc": "Context, background elements, time of day."
          }
        }
      `;

      const response = await this.retryWithBackoff(() => this.ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            },
            {
              text: promptText
            }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      }));

      const text = response.text || "{}";
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON", e);
        return { recreation_prompt: text }; // Fallback
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async getPosesByCategory(category: string, variationSeed: number = 0): Promise<any> {
    try {
      const prompt = `
        List 12 distinct, trendy, and high-fashion poses specifically for women wearing western dress styles (e.g., Gowns, Bodycon, Suits, Mini/Midi) in the specific category: "${category}".
        
        Focus on how the pose interacts with the fabric and silhouette of western clothing.
        Variation Seed: ${variationSeed} (Please provide a different set of poses than usual if this is non-zero).

        Return a JSON object with this schema:
        {
          "poses": [
            {
              "name": "Creative Name of Pose",
              "difficulty": "Easy/Medium/Hard",
              "vibe": "Adjectives describing the mood (e.g. 'Regal', 'Flirty')",
              "best_for": "Specific dress type (e.g. 'High Slit Gown', 'Oversized Blazer')"
            }
          ]
        }
      `;

      const response = await this.retryWithBackoff(() => this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      }));

      return JSON.parse(response.text || '{"poses": []}');
    } catch (error) {
      this.handleError(error);
    }
  }

  async getPoseDetails(poseName: string): Promise<any> {
    try {
      const prompt = `
        Provide a detailed breakdown for the pose: "${poseName}" in the context of Western Fashion Photography.
        
        Return a JSON object with this schema:
        {
          "instructions": [
            "Step 1...", "Step 2..."
          ],
          "description": "A vivid description of what the pose communicates.",
          "tips": "Pro tips for the model to make it look natural."
        }
      `;

      const response = await this.retryWithBackoff(() => this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      }));

      return JSON.parse(response.text || '{}');
    } catch (error) {
       this.handleError(error);
    }
  }

  private generateFallbackPoseSVG(poseDescription: string, gender: string): string {
    const lower = poseDescription.toLowerCase();
    let poseElements = '';
    let title = 'Pose Reference';
    
    if (lower.includes('seat') || lower.includes('sit') || lower.includes('chair') || lower.includes('bench')) {
      title = 'Seated Pose Blueprint';
      poseElements = `
        <!-- Chair/Seat base -->
        <path d="M70,180 L130,180 M80,180 L80,240 M120,180 L120,240" stroke="#475569" stroke-width="2" stroke-dasharray="4,4" />
        <!-- Head -->
        <circle cx="100" cy="50" r="14" fill="none" stroke="#60a5fa" stroke-width="3" />
        <!-- Neck -->
        <line x1="100" y1="64" x2="100" y2="76" stroke="#60a5fa" stroke-width="3" />
        <!-- Shoulders -->
        <line x1="75" y1="76" x2="125" y2="76" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Spine / Torso -->
        <path d="M100,76 Q95,110 90,130" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Hips -->
        <line x1="75" y1="130" x2="115" y2="130" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Left Arm -->
        <path d="M75,76 L60,105 L70,130" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Right Arm -->
        <path d="M125,76 L135,100 L115,115" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Left Leg (Seated angle) -->
        <path d="M75,130 L60,165 L110,165 L115,225" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Right Leg (Seated angle) -->
        <path d="M115,130 L105,165 L145,170 L140,225" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Joints -->
        <circle cx="100" cy="50" r="3" fill="#60a5fa" />
        <circle cx="75" cy="76" r="4" fill="#38bdf8" />
        <circle cx="125" cy="76" r="4" fill="#38bdf8" />
        <circle cx="75" cy="130" r="4" fill="#38bdf8" />
        <circle cx="115" cy="130" r="4" fill="#38bdf8" />
        <circle cx="60" cy="165" r="3.5" fill="#34d399" />
        <circle cx="105" cy="165" r="3.5" fill="#34d399" />
      `;
    } else if (lower.includes('lying') || lower.includes('floor') || lower.includes('reclining') || lower.includes('ground')) {
      title = 'Reclining Pose Blueprint';
      poseElements = `
        <!-- Floor line -->
        <line x1="20" y1="210" x2="180" y2="210" stroke="#475569" stroke-width="1.5" stroke-dasharray="3,3" />
        <!-- Head -->
        <circle cx="50" cy="140" r="14" fill="none" stroke="#60a5fa" stroke-width="3" />
        <!-- Neck -->
        <path d="M60,148 L72,154" fill="none" stroke="#60a5fa" stroke-width="3" />
        <!-- Shoulders -->
        <line x1="72" y1="135" x2="78" y2="175" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Spine / Torso -->
        <path d="M75,155 Q105,165 125,170" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Hips -->
        <line x1="120" y1="155" x2="130" y2="185" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Left Arm -->
        <path d="M72,135 L50,150 L40,180" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Right Arm -->
        <path d="M78,175 L95,190 L115,185" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Left Leg -->
        <path d="M120,155 L155,160 L180,185" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Right Leg -->
        <path d="M130,185 L160,195 L175,208" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Joints -->
        <circle cx="72" cy="135" r="4" fill="#38bdf8" />
        <circle cx="78" cy="175" r="4" fill="#38bdf8" />
        <circle cx="120" cy="155" r="4" fill="#38bdf8" />
        <circle cx="130" cy="185" r="4" fill="#38bdf8" />
      `;
    } else {
      title = 'Standing Pose Blueprint';
      poseElements = `
        <!-- Floor line -->
        <line x1="30" y1="230" x2="170" y2="230" stroke="#475569" stroke-width="1.5" stroke-dasharray="3,3" />
        <!-- Head -->
        <circle cx="100" cy="45" r="14" fill="none" stroke="#60a5fa" stroke-width="3" />
        <!-- Neck -->
        <line x1="100" y1="59" x2="100" y2="70" stroke="#60a5fa" stroke-width="3" />
        <!-- Shoulders (Dynamic Tilt) -->
        <line x1="75" y1="72" x2="125" y2="78" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Spine / Torso (Elegant S-Curve) -->
        <path d="M100,75 Q92,110 102,140" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Hips (Counter-tilt for Contrapposto) -->
        <line x1="80" y1="142" x2="120" y2="138" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
        <!-- Left Arm -->
        <path d="M75,72 L55,105 L70,140" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Right Arm (Hand on Hip) -->
        <path d="M125,78 L140,110 L120,138" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Left Leg (Weight Bearing) -->
        <path d="M84,141 L86,185 L90,230" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Right Leg (relaxed, slightly bent) -->
        <path d="M116,139 L125,185 L110,230" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Joints / Reference Points -->
        <circle cx="75" cy="72" r="4" fill="#38bdf8" />
        <circle cx="125" cy="78" r="4" fill="#38bdf8" />
        <circle cx="80" cy="142" r="4" fill="#38bdf8" />
        <circle cx="120" cy="138" r="4" fill="#38bdf8" />
        <circle cx="86" cy="185" r="3.5" fill="#34d399" />
        <circle cx="125" cy="185" r="3.5" fill="#34d399" />
      `;
    }

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" width="100%" height="100%">
        <rect width="100%" height="100%" fill="#0f172a" rx="12" />
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" rx="12" />
        
        <text x="15" y="25" fill="#94a3b8" font-family="monospace" font-size="8" letter-spacing="1">POSE SCHEMATIC // POSE RECONSTRUCT</text>
        <text x="15" y="35" fill="#38bdf8" font-family="sans-serif" font-weight="bold" font-size="10">${title}</text>
        
        <g transform="translate(0, 10)">
          ${poseElements}
        </g>

        <rect x="15" y="215" width="170" height="22" rx="4" fill="rgba(15, 23, 42, 0.8)" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1" />
        <text x="22" y="228" fill="#cbd5e1" font-family="sans-serif" font-size="7" font-weight="500">Focus: Body Lines, Symmetry, Confidence</text>
        
        <path d="M 8 8 L 16 8 M 8 8 L 8 16" fill="none" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" />
        <path d="M 192 8 L 184 8 M 192 8 L 192 16" fill="none" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" />
        <path d="M 8 242 L 16 242 M 8 242 L 8 234" fill="none" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" />
        <path d="M 192 242 L 184 242 M 192 242 L 192 234" fill="none" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1" />
      </svg>
    `.trim();

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
  }

  async generatePoseReferenceImage(poseDescription: string, gender: 'female' | 'male' = 'female'): Promise<string> {
    try {
      const safeDesc = poseDescription.replace(/(sexy|hot|sultry|alluring|seductive|nude|naked|provocative)/gi, 'confident');

      const prompt = `
        A simple, clean technical line drawing of a wooden artist mannequin performing this pose: ${safeDesc}. 
        White background, black lines. 
        Focus on joint mechanics and limb placement. 
        Educational anatomy reference sketch. 
        No shading, high contrast blueprint style.
      `;

      const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '3:4',
        }
      });

      const b64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (b64) {
        return `data:image/jpeg;base64,${b64}`;
      }
      
      throw new Error("Safety Block: The pose description triggered content filters.");
      
    } catch (error: any) {
      console.warn("Imagen generation failed or not available under free tier, using stylized SVG mannequin fallback. Error details:", error);
      return this.generateFallbackPoseSVG(poseDescription, gender);
    }
  }

  parseSafeBold(safeBold: string): Record<string, string[]> {
    const lines = safeBold.split('\n').map(l => l.trim());
    const categories: Record<string, string[]> = {
      'identity': [],
      'realism': [],
      'camera': [],
      'lighting': [],
      'composition': [],
      'style': [],
      'color': [],
      'quality': [],
      'negatives': [],
      'other': []
    };

    let currentCategory = 'other';

    for (const line of lines) {
      if (!line) continue;
      if (line === '/SAFE_BOLD') continue;

      // Check if line is a header
      if (line.startsWith('#') || line.startsWith('//') || line.startsWith('=')) {
        const headerText = line.replace(/[#=/]/g, '').trim().toLowerCase();
        if (headerText) {
          if (headerText.includes('subject') || headerText.includes('identity')) {
            currentCategory = 'identity';
          } else if (headerText.includes('realism')) {
            currentCategory = 'realism';
          } else if (headerText.includes('camera')) {
            currentCategory = 'camera';
          } else if (headerText.includes('lighting')) {
            currentCategory = 'lighting';
          } else if (headerText.includes('composition')) {
            currentCategory = 'composition';
          } else if (headerText.includes('style')) {
            currentCategory = 'style';
          } else if (headerText.includes('color')) {
            currentCategory = 'color';
          } else if (headerText.includes('quality')) {
            currentCategory = 'quality';
          } else if (headerText.includes('negative') || headerText.includes('negatives')) {
            currentCategory = 'negatives';
          } else if (headerText.includes('optimization')) {
            currentCategory = 'other';
          }
        }
        continue;
      }

      // Determine category by keywords if no clear active section
      const lowerLine = line.toLowerCase();
      if (lowerLine.startsWith('no ') || currentCategory === 'negatives') {
        categories['negatives'].push(line);
      } else if (lowerLine.includes('camera') || lowerLine.includes('lens') || lowerLine.includes('portrait') || lowerLine.includes('shot') || lowerLine.includes('f/') || lowerLine.includes('depth of field') || lowerLine.includes('focus') || lowerLine.includes('dslr') || lowerLine.includes('raw')) {
        categories['camera'].push(line);
      } else if (lowerLine.includes('light') || lowerLine.includes('exposure') || lowerLine.includes('ambient') || lowerLine.includes('shadow') || lowerLine.includes('golden hour') || lowerLine.includes('studio')) {
        categories['lighting'].push(line);
      } else if (lowerLine.includes('identity') || lowerLine.includes('face') || lowerLine.includes('age') || lowerLine.includes('hand') || lowerLine.includes('finger') || lowerLine.includes('anatom') || lowerLine.includes('feet')) {
        categories['identity'].push(line);
      } else if (lowerLine.includes('composition') || lowerLine.includes('framing') || lowerLine.includes('thirds') || lowerLine.includes('pose') || lowerLine.includes('centered') || lowerLine.includes('crop')) {
        categories['composition'].push(line);
      } else if (lowerLine.includes('style') || lowerLine.includes('aesthetic') || lowerLine.includes('fashion') || lowerLine.includes('luxury') || lowerLine.includes('minimalist') || lowerLine.includes('modern') || lowerLine.includes('magazine')) {
        categories['style'].push(line);
      } else if (lowerLine.includes('realistic') || lowerLine.includes('photo') || lowerLine.includes('texture') || lowerLine.includes('pores') || lowerLine.includes('reflection')) {
        categories['realism'].push(line);
      } else if (lowerLine.includes('color') || lowerLine.includes('contrast') || lowerLine.includes('tone') || lowerLine.includes('grading') || lowerLine.includes('correction')) {
        categories['color'].push(line);
      } else if (lowerLine.includes('quality') || lowerLine.includes('sharp') || lowerLine.includes('noise') || lowerLine.includes('artifact') || lowerLine.includes('detail')) {
        categories['quality'].push(line);
      } else {
        categories[currentCategory].push(line);
      }
    }

    return categories;
  }

  async compileGpt2Prompt(
    modelName: string,
    coreConcept: string,
    styleElements: string,
    modelParams: string,
    outputFormat: string,
    additionalDetails: string,
    safeBoldContent: string
  ): Promise<string> {
    try {
      // 1. Detect if model name is "gpt 2"
      const isGpt2 = modelName.toLowerCase() === 'gpt 2';

      // 2. Parse the /SAFE_BOLD block into categories
      const parsedCategories = this.parseSafeBold(safeBoldContent);

      // 3. Format categorized metadata for presentation
      const structuredBlock = Object.entries(parsedCategories)
        .filter(([_, items]) => items.length > 0)
        .map(([cat, items]) => `### Category: ${cat.toUpperCase()}\n${items.map(i => `- ${i}`).join('\n')}`)
        .join('\n\n');

      // 4. Construct instruction prompt for Gemini Compiler to resolve duplicates & conflicts and output singular optimized prompt
      const compilerPrompt = `
        # GPT 2 MASTER PROMPT ENGINE - DE-DUPLICATION, CONFLICT RESOLUTION & MERGING PIPELINE

        You are an advanced Image Prompt Compiler.
        Your task is to merge the user's core inputs and the parsed /SAFE_BOLD metadata categories into a singular, highly polished, production-ready final prompt for the image model.

        ---

        ## 1. USER INPUTS

        IMAGE_MODEL_NAME: ${modelName}
        CORE_IMAGE_CONCEPT: ${coreConcept}
        STYLE_ELEMENTS: ${styleElements}
        SPECIFIC_MODEL_PARAMETERS: ${modelParams}
        DESIRED_OUTPUT_FORMAT: ${outputFormat}
        ADDITIONAL_DETAILS: ${additionalDetails}

        ---

        ## 2. PARSED /SAFE_BOLD CATEGORIES METADATA
        ${structuredBlock}

        ---

        ## 3. PROMPT COMPILER PIPELINE INSTRUCTIONS

        Step 1: Read and analyze every input and metadata instruction.
        Step 2: Normalize wording. Use descriptive, rich, evocative photography and fashion terminology.
        Step 3: Remove duplicate descriptions. (e.g. if "Photorealistic" or "f/2.8" is in both Core Concept and SAFE_BOLD, keep only one instance).
        Step 4: Resolve conflicting instructions. (e.g. if one instruction implies "Studio lighting" and another says "Natural lighting", resolve it by blending them: "Soft natural studio-quality lighting").
        Step 5: Organize and synthesize information into a single flowing natural-language paragraph.
        Step 6: Ensure all essential constraints are strictly preserved (such as Identity lock details, natural hands/fingers, lens selection, and aspect ratios).
        Step 7: Format and compile into the final prompt.

        ---

        # CRITICAL OUTPUT FORMAT

        Your output must strictly follow this exact format:

        MODEL
        ${modelName}

        FINAL PROMPT
        [A single, polished, and unified cohesive natural-language prompt paragraph that incorporates all the merged, de-duplicated and resolved attributes from both user inputs and /SAFE_BOLD categories, followed immediately by any specific model parameter tags like '--ar 16:9' or quality tags.]

        NEGATIVE PROMPT
        [A clean, unified comma-separated string containing all the compiled and de-duplicated negative items from the "negatives" category above.]
      `;

      const response = await this.retryWithBackoff(() => this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: compilerPrompt
      }));

      let resultText = response.text || '';

      // If IMAGE_MODEL_NAME is gpt 2, we prepend the /SAFE_BOLD block metadata at the very top of the output text
      if (isGpt2) {
        resultText = `/SAFE_BOLD\n\n${safeBoldContent.trim()}\n\n=========================================\n\n${resultText.trim()}`;
      }

      return resultText;
    } catch (error) {
      this.handleError(error);
    }
  }
}
