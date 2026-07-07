
import { Component, signal, ChangeDetectionStrategy, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UploaderComponent } from './components/uploader.component';
import { GeminiService } from './services/gemini.service';
import { AuthService } from './services/auth.service';
import { AuthModalComponent } from './components/auth-modal.component';

interface SuggestedPose {
  title: string;
  vibe: string;
  instructions: string;
  why_it_works: string;
  visualUrl?: string; // Added visualUrl
  isGeneratingVisual?: boolean; // Track individual generation state
}

interface AnalysisResult {
  recreation_prompt: string;
  structured_prompt?: {
    subject: string;
    outfit: string;
    environment: string;
    lighting: string;
    camera: string;
    style: string;
  };
  negative_prompt?: string;
  negative_prompt_items?: string[];
  aspect_ratio?: string;
  outfit_data?: { 
    style_analysis: string;
    items: Array<{
      name: string;
      details: string;
      search_term: string;
    }>;
  };
  pose?: {
    name: string;
    details: string;
    instructions: string[];
  };
  suggested_poses?: Array<SuggestedPose>;
  technical?: {
    camera_settings: string;
    lighting_setup: string;
    environment_desc: string;
  };
}

interface HistoryItem {
  id: string;
  timestamp: Date;
  image: string;
  mimeType: string;
  result: AnalysisResult;
  poseVisual?: string;
}

interface VisualOptions {
  style: string;
  colorGrade: string;
  lighting: string;
}

interface LibraryPose {
  name: string;
  difficulty: string;
  vibe: string;
  best_for: string;
}

interface LibraryPoseDetail {
  instructions: string[];
  description: string;
  tips: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UploaderComponent, AuthModalComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  public authService = inject(AuthService);

  // State signals
  currentImage = signal<string | null>(null);
  currentMimeType = signal<string | null>(null);
  isAnalyzing = signal(false);
  genderPreference = signal<'female' | 'male'>('female');
  analysisFocus = signal<'general' | 'pose' | 'outfit'>('general');
  isDarkMode = signal<boolean>(
    typeof window !== 'undefined' ? (localStorage.getItem('theme-preference') !== 'light') : true
  );
  
  // Data State
  analysisResult = signal<AnalysisResult | null>(null);
  // We keep the original to allow non-destructive visual edits
  originalAnalysisResult = signal<AnalysisResult | null>(null); 
  error = signal<string | null>(null);

  // Visual Options State
  visualOptions = signal<VisualOptions>({
    style: 'Original',
    colorGrade: 'Original',
    lighting: 'Original'
  });

  // Pose Visual State for MAIN pose
  poseVisual = signal<string | null>(null);
  isGeneratingVisual = signal(false);
  visualGenerationError = signal<string | null>(null);

  // Library State
  libraryCategories = [
    'Flowing Gown Drama', 
    'Bodycon Silhouette', 
    'Mini Dress Playful', 
    'Midi Dress Elegance', 
    'Power Suit & Blazer', 
    'Casual Summer Dress', 
    'Red Carpet Entrance', 
    'Boho Chic & Festival', 
    'Cocktail Hour', 
    'Bridal & White Dress', 
    'Street Style Walking', 
    'Sitting with Slit', 
    'Staircase Grandeur', 
    'Fabric Toss & Motion',
    'Over-the-Shoulder Backless'
  ];
  currentLibraryCategory = signal<string | null>(null);
  libraryPoses = signal<LibraryPose[]>([]);
  selectedLibraryPose = signal<LibraryPose | null>(null);
  selectedLibraryPoseDetails = signal<LibraryPoseDetail | null>(null);
  isLibraryLoading = signal(false);
  libraryVisual = signal<string | null>(null);
  librarySeed = signal(0); // For shuffling

  // History State
  history = signal<HistoryItem[]>([]);
  showHistory = signal(false);

  // Auth UI State
  showAuthModal = signal(false);

  // UI State
  // Added 'library' to the type
  activeTab = signal<'prompt' | 'visuals' | 'outfit' | 'pose' | 'tech' | 'library'>('prompt');
  copyStatus = signal<'idle' | 'copied'>('idle');
  copyNegativeStatus = signal<'idle' | 'copied'>('idle');
  copiedStates = signal<Record<string, boolean>>({});

  // Computed
  hasResult = computed(() => !!this.analysisResult());
  currentUser = this.authService.currentUser;

  // Constants for Visual Options
  readonly availableStyles = [
    { id: 'Original', label: 'Original', desc: 'Keep original aesthetic' },
    { id: 'Photorealistic', label: 'Photorealistic', desc: '8k, highly detailed, raw photo, ultra-realistic texture' },
    { id: 'Cinematic', label: 'Cinematic', desc: 'Movie still, anamorphic lens, color graded, dramatic composition' },
    { id: 'Anime', label: 'Anime', desc: 'High quality anime art, makoto shinkai style, vibrant colors, 2D' },
    { id: '3D Render', label: '3D Render', desc: 'Unreal Engine 5, octane render, ray tracing, 3D character' },
    { id: 'Oil Painting', label: 'Oil Painting', desc: 'Oil on canvas, textured brushstrokes, classical art style' },
    { id: 'Cyberpunk', label: 'Cyberpunk', desc: 'Neon lights, futuristic, high tech low life, sci-fi aesthetic' },
    { id: 'Vintage', label: 'Vintage Film', desc: 'Analog photography, polaroid, film grain, 1990s aesthetic' }
  ];

  readonly availableColorGrades = ['Original', 'Vibrant', 'Muted', 'Black & White', 'Pastel', 'Warm', 'Cool', 'Sepia'];
  readonly availableLighting = ['Original', 'Soft', 'Hard/Dramatic', 'Neon', 'Natural', 'Studio', 'Rembrandt', 'Golden Hour'];

  constructor() {
    // Effect to sync history when user changes
    effect(() => {
      const user = this.currentUser();
      if (user) {
        // Load user history (ensure dates are parsed correctly if coming from JSON)
        const userHistory = user.history.map(item => {
           // Backward compatibility for items saved with old 'outfit' key
           const result = item.result;
           if ((result as any).outfit && !result.outfit_data && Array.isArray((result as any).outfit.items)) {
             result.outfit_data = (result as any).outfit;
           }
           return {
             ...item,
             timestamp: new Date(item.timestamp),
             result
           };
        });
        this.history.set(userHistory);
      } else {
        this.history.set([]); // Clear history on logout
      }
    });
  }

  setGenderPreference(gender: 'female' | 'male') {
    this.genderPreference.set(gender);
  }

  setAnalysisFocus(focus: 'general' | 'pose' | 'outfit') {
    this.analysisFocus.set(focus);
  }

  async handleImageSelected(event: { base64: string, mimeType: string }) {
    this.currentImage.set(event.base64);
    this.currentMimeType.set(event.mimeType);
    this.analysisResult.set(null);
    this.originalAnalysisResult.set(null);
    this.poseVisual.set(null);
    this.error.set(null);
    this.visualGenerationError.set(null);
    this.copyStatus.set('idle');
    this.activeTab.set(this.analysisFocus() === 'pose' ? 'pose' : 'prompt'); // Switch to Pose tab if that was the focus
    this.showHistory.set(false);
    this.resetVisualOptions();
    
    await this.analyzeImage();
  }

  resetVisualOptions() {
    this.visualOptions.set({
      style: 'Original',
      colorGrade: 'Original',
      lighting: 'Original'
    });
  }

  async analyzeImage() {
    const img = this.currentImage();
    const mime = this.currentMimeType();

    if (!img || !mime) return;

    this.isAnalyzing.set(true);
    this.error.set(null);

    try {
      // Pass gender and analysis focus
      const result: AnalysisResult = await this.geminiService.analyzeImageAndGetPrompt(
        img, 
        mime, 
        this.genderPreference(), 
        this.analysisFocus()
      );
      
      // Backward compatibility mapping for 'outfit' key change if needed
      if ((result as any).outfit && !result.outfit_data && Array.isArray((result as any).outfit.items)) {
         result.outfit_data = (result as any).outfit;
      }
      
      this.analysisResult.set(result);
      this.originalAnalysisResult.set(JSON.parse(JSON.stringify(result))); // Deep copy for safety
      
      // Save preliminary result to history
      if (this.currentUser()) {
        this.addToHistory(img, mime, result);
      }

      // Automatically generate visuals for suggested poses
      if (result.suggested_poses && result.suggested_poses.length > 0) {
        this.generateSuggestedPoseVisuals(result.suggested_poses);
      }

    } catch (err: any) {
      this.error.set(err.message || "Failed to analyze image. Please try again.");
      console.error(err);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  // --- LIBRARY LOGIC START ---

  async selectLibraryCategory(category: string, resetSeed = true) {
    this.currentLibraryCategory.set(category);
    this.isLibraryLoading.set(true);
    this.selectedLibraryPose.set(null);
    if (resetSeed) {
        this.librarySeed.set(0);
        this.libraryPoses.set([]);
    }

    try {
      const data = await this.geminiService.getPosesByCategory(category, this.librarySeed());
      if (data && data.poses) {
        this.libraryPoses.set(data.poses);
      }
    } catch (e) {
      console.error(e);
      // Could set an error state specific to library
    } finally {
      this.isLibraryLoading.set(false);
    }
  }

  async shuffleCategory() {
      if (!this.currentLibraryCategory()) return;
      this.librarySeed.update(s => s + 1);
      await this.selectLibraryCategory(this.currentLibraryCategory()!, false);
  }

  async viewLibraryPose(pose: LibraryPose) {
    this.selectedLibraryPose.set(pose);
    this.selectedLibraryPoseDetails.set(null);
    this.libraryVisual.set(null);
    this.isLibraryLoading.set(true);

    try {
      // 1. Get Details
      const details = await this.geminiService.getPoseDetails(pose.name);
      this.selectedLibraryPoseDetails.set(details);

      // 2. Generate Image
      // Construct a safe description for generation
      const desc = `${pose.name} pose. ${details.description || ''}`;
      const visual = await this.geminiService.generatePoseReferenceImage(desc, this.genderPreference());
      this.libraryVisual.set(visual);

    } catch (e) {
      console.error(e);
    } finally {
      this.isLibraryLoading.set(false);
    }
  }

  backToCategories() {
    this.currentLibraryCategory.set(null);
    this.libraryPoses.set([]);
    this.selectedLibraryPose.set(null);
    this.librarySeed.set(0);
  }

  backToPoseList() {
    this.selectedLibraryPose.set(null);
    this.selectedLibraryPoseDetails.set(null);
    this.libraryVisual.set(null);
  }

  getSearchLink(platform: 'google' | 'pinterest' | 'instagram', poseName: string): string {
    const query = `women western dress ${poseName} pose`;
    
    if (platform === 'pinterest') {
        const encoded = encodeURIComponent(query + ' photography');
      return `https://www.pinterest.com/search/pins/?q=${encoded}`;
    } else if (platform === 'instagram') {
        // Instagram hashtags are better without spaces
        const tag = poseName.replace(/\s+/g, '').toLowerCase() + 'pose';
        return `https://www.instagram.com/explore/tags/${tag}/`;
    }
    const encoded = encodeURIComponent(query);
    return `https://www.google.com/search?tbm=isch&q=${encoded}`;
  }

  // --- LIBRARY LOGIC END ---

  // Applies visual overrides to the prompt
  updateVisuals(type: 'style' | 'colorGrade' | 'lighting', value: string) {
    this.visualOptions.update(opts => ({ ...opts, [type]: value }));
    this.applyVisualChanges();
  }

  applyVisualChanges() {
    const original = this.originalAnalysisResult();
    if (!original || !original.structured_prompt) return;

    const opts = this.visualOptions();
    const sp = original.structured_prompt;
    
    // Determine new style string
    let newStyle = sp.style;
    const styleDef = this.availableStyles.find(s => s.id === opts.style);
    
    if (opts.style !== 'Original' && styleDef) {
       newStyle = styleDef.desc;
    }

    // Append modifiers
    const modifiers: string[] = [];
    if (opts.colorGrade !== 'Original') modifiers.push(`${opts.colorGrade} color grading`);
    if (opts.lighting !== 'Original') modifiers.push(`${opts.lighting} lighting`);
    
    const combinedStyle = modifiers.length > 0 ? `${newStyle}, ${modifiers.join(', ')}` : newStyle;

    // Reconstruct the full prompt
    // Strategy: Take the original prompt, remove the aspect ratio tag, append style modifiers, add aspect ratio back.
    let basePrompt = original.recreation_prompt;
    
    // Remove --ar tag if exists to append it at very end
    const arMatch = basePrompt.match(/--ar\s+\d+:\d+/);
    const arTag = arMatch ? arMatch[0] : (original.aspect_ratio || '');
    basePrompt = basePrompt.replace(/--ar\s+\d+:\d+/, '').trim();

    // If style is changed drastically (e.g. Anime), we might want to prepend/append specific keywords
    let modifiedPrompt = basePrompt;
    
    if (opts.style !== 'Original' && styleDef) {
      // Append the specific style description to ensure it takes effect
      modifiedPrompt = `${modifiedPrompt}, ${styleDef.desc}`;
    }
    
    if (modifiers.length > 0) {
      modifiedPrompt = `${modifiedPrompt}, ${modifiers.join(', ')}`;
    }

    // Re-add AR tag
    modifiedPrompt = `${modifiedPrompt} ${arTag}`.trim();

    // Update the displayed result
    this.analysisResult.update(res => {
        if (!res) return null;
        return {
            ...res,
            recreation_prompt: modifiedPrompt,
            structured_prompt: {
                ...res.structured_prompt!,
                style: combinedStyle
            }
        };
    });
  }

  async generateSuggestedPoseVisuals(suggestions: SuggestedPose[]) {
    // Mark them as loading initially
    const updatedSuggestions = suggestions.map(s => ({ ...s, isGeneratingVisual: true }));
    
    this.analysisResult.update(res => res ? { ...res, suggested_poses: updatedSuggestions } : null);

    // Process in parallel but handle errors individually
    const promises = updatedSuggestions.map(async (pose, index) => {
      try {
        const visualUrl = await this.geminiService.generatePoseReferenceImage(pose.instructions, this.genderPreference());
        
        // Update state with result
        this.analysisResult.update(res => {
          if (!res || !res.suggested_poses) return res;
          const newPoses = [...res.suggested_poses];
          newPoses[index] = { ...newPoses[index], visualUrl, isGeneratingVisual: false };
          return { ...res, suggested_poses: newPoses };
        });
        
        // Update history if it's the current image
        if (this.currentUser()) {
             this.history.update(prev => {
              if (prev.length > 0 && prev[0].image === this.currentImage()) {
                const updated = [...prev];
                // Deep copy result to update nested property
                const updatedResult = { ...updated[0].result };
                if (updatedResult.suggested_poses) {
                   const updatedPoses = [...updatedResult.suggested_poses];
                   updatedPoses[index] = { ...updatedPoses[index], visualUrl };
                   updatedResult.suggested_poses = updatedPoses;
                }
                updated[0] = { ...updated[0], result: updatedResult };
                this.authService.updateHistory(updated);
                return updated;
              }
              return prev;
            });
        }

      } catch (e) {
        console.error(`Failed to generate visual for pose ${index}`, e);
        // Mark as failed/done
        this.analysisResult.update(res => {
          if (!res || !res.suggested_poses) return res;
          const newPoses = [...res.suggested_poses];
          newPoses[index] = { ...newPoses[index], isGeneratingVisual: false };
          return { ...res, suggested_poses: newPoses };
        });
      }
    });

    await Promise.all(promises);
  }

  // Generate visual for the MAIN analyzed pose
  async generatePoseVisual(description?: string) {
    const details = description || this.analysisResult()?.pose?.details;
    if (!details) return;

    this.isGeneratingVisual.set(true);
    this.visualGenerationError.set(null);

    try {
      const visual = await this.geminiService.generatePoseReferenceImage(details, this.genderPreference());
      this.poseVisual.set(visual);
      
      if (this.currentUser() && !description) { 
         this.history.update(prev => {
          if (prev.length > 0 && prev[0].image === this.currentImage()) {
            const updated = [...prev];
            updated[0] = { ...updated[0], poseVisual: visual };
            this.authService.updateHistory(updated);
            return updated;
          }
          return prev;
        });
      }

    } catch (err: any) {
      console.error('Failed to generate visual', err);
      this.visualGenerationError.set(err.message || "Failed to generate visual.");
    } finally {
      this.isGeneratingVisual.set(false);
    }
  }

  addToHistory(image: string, mimeType: string, result: AnalysisResult) {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      image,
      mimeType,
      result
    };
    
    const newHistory = [newItem, ...this.history()];
    this.history.set(newHistory);
    this.authService.updateHistory(newHistory);
  }

  restoreHistoryItem(item: HistoryItem) {
    this.currentImage.set(item.image);
    this.currentMimeType.set(item.mimeType);
    this.analysisResult.set(item.result);
    // When restoring, we assume the saved result is the base.
    // If the user modified visuals before saving, that's what we load.
    // We set original to the loaded one to allow further edits from that point.
    this.originalAnalysisResult.set(JSON.parse(JSON.stringify(item.result))); 
    this.poseVisual.set(item.poseVisual || null);
    this.activeTab.set('prompt');
    this.error.set(null);
    this.visualGenerationError.set(null);
    this.showHistory.set(false);
    this.resetVisualOptions();
  }

  deleteHistoryItem(event: Event, id: string) {
    event.stopPropagation();
    const newHistory = this.history().filter(item => item.id !== id);
    this.history.set(newHistory);
    this.authService.updateHistory(newHistory);
  }

  toggleHistory() {
    this.showHistory.update(v => !v);
  }

  toggleTheme() {
    this.isDarkMode.update(dark => {
      const next = !dark;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme-preference', next ? 'dark' : 'light');
      }
      return next;
    });
  }

  reset() {
    this.currentImage.set(null);
    this.currentMimeType.set(null);
    this.analysisResult.set(null);
    this.originalAnalysisResult.set(null);
    this.poseVisual.set(null);
    this.isAnalyzing.set(false);
    this.error.set(null);
    this.visualGenerationError.set(null);
    this.resetVisualOptions();
  }

  logout() {
    this.authService.logout();
    this.reset();
  }

  openAuthModal() {
    this.showAuthModal.set(true);
  }

  closeAuthModal() {
    this.showAuthModal.set(false);
  }

  setActiveTab(tab: 'prompt' | 'visuals' | 'outfit' | 'pose' | 'tech' | 'library') {
    this.activeTab.set(tab);
  }

  showJsonModal = signal(false);
  copyJsonStatus = signal<'idle' | 'copied'>('idle');

  getFormattedJson(): string {
    const res = this.analysisResult();
    if (!res) return '{}';
    const jsonObject = {
      master_prompt: res.recreation_prompt,
      aspect_ratio: res.aspect_ratio || 'Original',
      structured_elements: res.structured_prompt || null,
      negative_prompt: res.negative_prompt || ''
    };
    return JSON.stringify(jsonObject, null, 2);
  }

  toggleJsonModal() {
    this.showJsonModal.update(v => !v);
  }

  copyJson() {
    const jsonStr = this.getFormattedJson();
    navigator.clipboard.writeText(jsonStr).then(() => {
      this.copyJsonStatus.set('copied');
      setTimeout(() => this.copyJsonStatus.set('idle'), 2000);
    });
  }

  downloadJson() {
    const jsonStr = this.getFormattedJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-prompt-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  copyPrompt() {
    const text = this.analysisResult()?.recreation_prompt;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.copyStatus.set('copied');
        setTimeout(() => this.copyStatus.set('idle'), 2000);
      });
    }
  }

  copyNegativePrompt() {
     const text = this.analysisResult()?.negative_prompt;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.copyNegativeStatus.set('copied');
        setTimeout(() => this.copyNegativeStatus.set('idle'), 2000);
      });
    }
  }
  
  copyText(text: string) {
      navigator.clipboard.writeText(text);
  }

  copyToClipboard(text: string | undefined, key: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedStates.update(s => ({ ...s, [key]: true }));
      setTimeout(() => {
        this.copiedStates.update(s => ({ ...s, [key]: false }));
      }, 2000);
    });
  }

  isCopied(key: string): boolean {
    return !!this.copiedStates()[key];
  }

  getShoppingLink(searchTerm: string): string {
    return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchTerm)}`;
  }

  showScrollTopBtn = signal(false);

  onMainScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (target) {
      this.showScrollTopBtn.set(target.scrollTop > 300);
    }
  }

  scrollToTop(mainElement: HTMLElement) {
    mainElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}
