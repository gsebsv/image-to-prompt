import { Component, output, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModelService, CustomModel } from '../services/model.service';

@Component({
  selector: 'app-model-manager-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" (click)="close.emit()">
      <div class="glass-panel rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl border border-white/10 animate-scale-in flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="px-8 py-5 border-b border-white/5 bg-slate-900/60 flex items-center justify-between">
           <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.062.511.092.77.092h2.75c.259 0 .517-.03.77-.092m-4.29-9.18c.253-.062.511-.092.77-.092h2.75c.259 0 .517.03.77.092m0 0c.688.06 1.386.09 2.09.09H16.5a4.5 4.5 0 1 1 0 9h-.75c-.704 0-1.402.03-2.09.09m0-9.18c.352.16.7.351 1.036.568M14.22 5.23c.352.16.7.351 1.036.568M11.18 18.77c-.352-.16-.7-.351-1.036-.568M11.18 18.77c-.352-.16-.7-.351-1.036-.568M12 9v6m-3-3h6" />
                 </svg>
              </div>
              <div>
                 <h2 class="text-lg font-bold text-white leading-none">Custom AI Model Registry</h2>
                 <p class="text-[10px] text-slate-400 font-medium tracking-wide mt-1">Register and manage custom vision and language models at runtime</p>
              </div>
           </div>
           <button (click)="close.emit()" class="text-slate-400 hover:text-white transition-colors p-1 bg-transparent border-0 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
           </button>
        </div>

        <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-slate-950/40">
           <!-- Left Panel: Model List -->
           <div class="w-full md:w-1/2 p-6 border-r border-white/5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <div class="flex justify-between items-center mb-2">
                 <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Registered Models</h3>
                 <span class="text-[9px] px-2 py-0.5 bg-slate-800 rounded-full font-mono text-slate-400">{{ modelsCount() }} total</span>
              </div>

              <!-- Default Built-in -->
              <div class="p-4 rounded-xl border border-indigo-500/10 bg-indigo-950/10 flex justify-between items-start">
                 <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                       <span class="text-xs font-bold text-white">Gemini 2.5 Flash</span>
                       <span class="text-[9px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-bold uppercase">Built-In</span>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono">Provider: Google</span>
                    <span class="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                       <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                       Image support active & default
                    </span>
                 </div>
              </div>

              <!-- Custom List -->
              @if (customModels().length === 0) {
                 <div class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900/10 rounded-xl border border-dashed border-white/5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-8 h-8 text-slate-600 mb-2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-xs text-slate-500 font-medium">No custom models registered yet.</p>
                    <p class="text-[10px] text-slate-600 mt-1">Fill out the form on the right to register your custom OpenAI/Anthropic/Groq keys.</p>
                 </div>
              } @else {
                 @for (m of customModels(); track m.id) {
                    <div class="p-4 rounded-xl border transition-all duration-300" 
                         [class.border-pink-500/20]="m.status === 'active' && editingModelId() !== m.id"
                         [class.bg-pink-950/5]="m.status === 'active' && editingModelId() !== m.id"
                         [class.border-white/5]="m.status === 'disabled' && editingModelId() !== m.id"
                         [class.opacity-60]="m.status === 'disabled'"
                         [class.border-pink-500]="editingModelId() === m.id"
                         [class.bg-pink-500/10]="editingModelId() === m.id"
                    >
                       <div class="flex justify-between items-start gap-2">
                          <div class="flex flex-col gap-1 min-w-0">
                             <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-xs font-bold text-white truncate max-w-[150px]">{{ m.name }}</span>
                                <span class="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-semibold font-mono uppercase">{{ m.provider }}</span>
                                @if (m.imageSupport) {
                                   <span class="text-[9px] px-1 py-0.2 bg-emerald-500/10 text-emerald-400 rounded font-bold uppercase" title="Vision Capable">Vision</span>
                                }
                             </div>
                             <span class="text-[9px] text-slate-500 font-mono truncate" [title]="m.apiKey">API Key: ••••••••{{ m.apiKey.slice(-4) }}</span>
                             @if (m.baseEndpoint) {
                                <span class="text-[9px] text-slate-500 font-mono truncate" [title]="m.baseEndpoint">Endpoint: {{ m.baseEndpoint }}</span>
                             }
                          </div>

                          <div class="flex items-center gap-1 shrink-0">
                             <!-- Edit Button -->
                             <button 
                               (click)="startEdit(m)" 
                               class="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors bg-transparent border-0 cursor-pointer"
                               title="Edit model configuration"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                             </button>
                             <!-- Delete Button -->
                             <button 
                               (click)="deleteModel(m.id)" 
                               class="p-1.5 hover:bg-red-500/15 rounded-lg text-slate-400 hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer"
                               title="Delete model"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                             </button>
                          </div>
                       </div>
                       
                       <div class="flex items-center justify-between border-t border-white/5 mt-3 pt-2.5">
                          <span class="text-[9px] text-slate-400 font-mono">Status: {{ m.status === 'active' ? 'Active' : 'Disabled' }}</span>
                          <button 
                            (click)="toggleStatus(m)" 
                            class="text-[9px] font-bold text-indigo-400 hover:text-white bg-transparent border-0 cursor-pointer"
                          >
                             {{ m.status === 'active' ? 'Disable Model' : 'Activate Model' }}
                          </button>
                       </div>
                    </div>
                 }
              }
           </div>

           <!-- Right Panel: Form -->
           <div class="w-full md:w-1/2 p-6 overflow-y-auto custom-scrollbar flex flex-col min-h-0 bg-slate-900/10">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                 {{ editingModelId() ? 'Edit Model Configuration' : 'Register New AI Model' }}
              </h3>

              @if (error()) {
                 <div class="mb-4 p-3 bg-red-950/20 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{{ error() }}</span>
                 </div>
              }

              @if (successMessage()) {
                 <div class="mb-4 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{{ successMessage() }}</span>
                 </div>
              }

              <form [formGroup]="modelForm" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
                 <!-- Model Name -->
                 <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Model Name <span class="text-pink-500">*</span></label>
                    <input 
                      type="text" 
                      formControlName="name"
                      placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                      class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all placeholder:text-slate-600"
                    />
                 </div>

                 <!-- Provider -->
                 <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Provider / Engine API <span class="text-pink-500">*</span></label>
                    <div class="relative">
                       <select 
                         formControlName="provider"
                         class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer"
                       >
                          <option value="openai">OpenAI (or OpenAI Compatible)</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="groq">Groq AI</option>
                          <option value="openrouter">OpenRouter API</option>
                          <option value="custom">Fully Custom Endpoint</option>
                       </select>
                       <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                       </div>
                    </div>
                 </div>

                 <!-- API Key -->
                 <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Key / Access Token <span class="text-pink-500">*</span></label>
                    <input 
                      type="password" 
                      formControlName="apiKey"
                      placeholder="sk-..."
                      class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all placeholder:text-slate-600 font-mono"
                    />
                 </div>

                 <!-- Image support & status -->
                 <div class="grid grid-cols-2 gap-4">
                    <div class="flex items-center gap-2 bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2.5">
                       <input 
                         type="checkbox" 
                         formControlName="imageSupport" 
                         id="imageSupport"
                         class="w-3.5 h-3.5 text-pink-500 focus:ring-0 rounded border-white/10 bg-slate-950/80 cursor-pointer"
                       />
                       <label for="imageSupport" class="text-[10px] font-bold text-slate-300 uppercase tracking-wider cursor-pointer">Vision Support</label>
                    </div>

                    <div class="flex items-center gap-2 bg-slate-950/40 border border-white/5 rounded-lg px-3 py-2.5">
                       <input 
                         type="checkbox" 
                         formControlName="isActive" 
                         id="isActive"
                         class="w-3.5 h-3.5 text-pink-500 focus:ring-0 rounded border-white/10 bg-slate-950/80 cursor-pointer"
                       />
                       <label for="isActive" class="text-[10px] font-bold text-slate-300 uppercase tracking-wider cursor-pointer">Active</label>
                    </div>
                 </div>

                 <!-- Advanced Fields Toggle -->
                 <button 
                   type="button" 
                   (click)="showAdvanced.set(!showAdvanced())" 
                   class="text-[10px] font-bold text-left text-slate-400 hover:text-white uppercase tracking-wider flex items-center gap-1.5 mt-1 bg-transparent border-0 cursor-pointer"
                 >
                    <span>{{ showAdvanced() ? 'Hide' : 'Show' }} Advanced API Fields</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3 h-3 transition-transform duration-300" [class.rotate-180]="showAdvanced()">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                 </button>

                 @if (showAdvanced()) {
                    <div class="flex flex-col gap-4 border-l border-white/5 pl-4 py-1 animate-fade-in">
                       <!-- Base Endpoint -->
                       <div class="flex flex-col gap-1.5">
                          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Endpoint URL</label>
                          <input 
                            type="text" 
                            formControlName="baseEndpoint"
                            placeholder="e.g. https://api.openai.com/v1/chat/completions"
                            class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all placeholder:text-slate-600 font-mono"
                          />
                       </div>

                       <!-- API Version & Timeout -->
                       <div class="grid grid-cols-2 gap-4">
                          <div class="flex flex-col gap-1.5">
                             <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Version</label>
                             <input 
                               type="text" 
                               formControlName="apiVersion"
                               placeholder="e.g. 2023-06-01"
                               class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all placeholder:text-slate-600 font-mono"
                             />
                          </div>

                          <div class="flex flex-col gap-1.5">
                             <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timeout (Seconds)</label>
                             <input 
                               type="number" 
                               formControlName="timeout"
                               class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all"
                             />
                          </div>
                       </div>

                       <!-- Max Tokens & Temperature -->
                       <div class="grid grid-cols-2 gap-4">
                          <div class="flex flex-col gap-1.5">
                             <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Tokens</label>
                             <input 
                               type="number" 
                               formControlName="maxTokens"
                               class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all"
                             />
                          </div>

                          <div class="flex flex-col gap-1.5">
                             <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temperature</label>
                             <input 
                               type="number" 
                               step="0.1"
                               min="0"
                               max="1.5"
                               formControlName="temperature"
                               class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 transition-all"
                             />
                          </div>
                       </div>

                       <!-- Additional Headers JSON -->
                       <div class="flex flex-col gap-1.5">
                          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Headers (JSON String)</label>
                          <textarea 
                            rows="2"
                            formControlName="additionalHeaders"
                            placeholder='e.g. { "x-custom-header": "value" }'
                            class="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-pink-500 transition-all"
                          ></textarea>
                       </div>
                    </div>
                 }

                 <!-- Buttons -->
                 <div class="flex justify-end gap-3 mt-4 border-t border-white/5 pt-4">
                    @if (editingModelId()) {
                       <button 
                         type="button" 
                         (click)="cancelEdit()" 
                         class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all bg-transparent border border-white/10 cursor-pointer"
                       >
                          Cancel
                       </button>
                    }
                    <button 
                      type="submit" 
                      [disabled]="!modelForm.valid"
                      class="px-5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-indigo-600 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-0 cursor-pointer shadow-lg"
                    >
                       {{ editingModelId() ? 'Update Configuration' : 'Register Custom Model' }}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    .animate-scale-in { animation: scaleIn 0.2s ease-out cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModelManagerModalComponent {
  close = output<void>();

  modelService = inject(ModelService);
  fb: FormBuilder = inject(FormBuilder);

  customModels = this.modelService.customModels;
  modelsCount = computed(() => this.customModels().length + 1);

  showAdvanced = signal(false);
  editingModelId = signal<string | null>(null);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  modelForm = this.fb.group({
    name: ['', Validators.required],
    provider: ['openai' as 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'custom', Validators.required],
    apiKey: ['', Validators.required],
    imageSupport: [true],
    isActive: [true],
    baseEndpoint: [''],
    apiVersion: [''],
    timeout: [60],
    maxTokens: [4000],
    temperature: [0.2],
    additionalHeaders: ['']
  });

  onSubmit() {
    if (this.modelForm.invalid) return;

    this.error.set(null);
    this.successMessage.set(null);

    const f = this.modelForm.value;
    const modelData = {
      name: f.name!,
      provider: f.provider!,
      apiKey: f.apiKey!,
      imageSupport: !!f.imageSupport,
      status: f.isActive ? ('active' as const) : ('disabled' as const),
      baseEndpoint: f.baseEndpoint || undefined,
      apiVersion: f.apiVersion || undefined,
      timeout: Number(f.timeout) || undefined,
      maxTokens: Number(f.maxTokens) || undefined,
      temperature: Number(f.temperature) !== undefined ? Number(f.temperature) : undefined,
      additionalHeaders: f.additionalHeaders || undefined
    };

    const editId = this.editingModelId();
    if (editId) {
      const res = this.modelService.updateModel(editId, modelData);
      if (res.success) {
        this.successMessage.set(res.message);
        this.editingModelId.set(null);
        this.modelForm.reset({
          provider: 'openai',
          imageSupport: true,
          isActive: true,
          timeout: 60,
          maxTokens: 4000,
          temperature: 0.2
        });
      } else {
        this.error.set(res.message);
      }
    } else {
      const res = this.modelService.addModel(modelData);
      if (res.success) {
        this.successMessage.set(res.message);
        this.modelForm.reset({
          provider: 'openai',
          imageSupport: true,
          isActive: true,
          timeout: 60,
          maxTokens: 4000,
          temperature: 0.2
        });
      } else {
        this.error.set(res.message);
      }
    }
  }

  startEdit(model: CustomModel) {
    this.error.set(null);
    this.successMessage.set(null);
    this.editingModelId.set(model.id);
    this.showAdvanced.set(true);

    this.modelForm.patchValue({
      name: model.name,
      provider: model.provider,
      apiKey: model.apiKey,
      imageSupport: model.imageSupport,
      isActive: model.status === 'active',
      baseEndpoint: model.baseEndpoint || '',
      apiVersion: model.apiVersion || '',
      timeout: model.timeout || 60,
      maxTokens: model.maxTokens || 4000,
      temperature: model.temperature !== undefined ? model.temperature : 0.2,
      additionalHeaders: model.additionalHeaders || ''
    });
  }

  cancelEdit() {
    this.editingModelId.set(null);
    this.error.set(null);
    this.successMessage.set(null);
    this.modelForm.reset({
      provider: 'openai',
      imageSupport: true,
      isActive: true,
      timeout: 60,
      maxTokens: 4000,
      temperature: 0.2
    });
  }

  deleteModel(id: string) {
    this.error.set(null);
    this.successMessage.set(null);
    if (confirm('Are you sure you want to delete this custom model configuration?')) {
      const res = this.modelService.deleteModel(id);
      if (res.success) {
        this.successMessage.set(res.message);
        if (this.editingModelId() === id) {
          this.cancelEdit();
        }
      } else {
        this.error.set(res.message);
      }
    }
  }

  toggleStatus(model: CustomModel) {
    this.error.set(null);
    this.successMessage.set(null);
    const newStatus = model.status === 'active' ? ('disabled' as const) : ('active' as const);
    const res = this.modelService.updateModel(model.id, { status: newStatus });
    if (res.success) {
      this.successMessage.set(`Model is now ${newStatus}.`);
    } else {
      this.error.set(res.message);
    }
  }
}
