
import { Component, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-uploader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="relative w-full h-72 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group border border-dashed bg-slate-900/50"
      [class.border-indigo-500]="isDragging()"
      [class.bg-indigo-500/10]="isDragging()"
      [class.border-slate-700]="!isDragging()"
      [class.hover:border-slate-500]="!isDragging()"
      [class.hover:bg-slate-800/80]="!isDragging()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
    >
      <input 
        #fileInput 
        type="file" 
        class="hidden" 
        accept="image/*" 
        (change)="onFileSelected($event)"
      />
      
      <div class="pointer-events-none flex flex-col items-center space-y-4 z-10 p-8 text-center transition-transform duration-300 group-hover:scale-105">
        <div class="w-20 h-20 rounded-2xl bg-slate-800 shadow-inner flex items-center justify-center group-hover:bg-slate-700 transition-colors border border-white/5">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-indigo-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
        </div>
        <div class="space-y-1">
          <p class="text-lg font-medium text-slate-200">Upload Reference Image</p>
          <p class="text-sm text-slate-400">Drag & drop or click to browse</p>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-black/20 px-3 py-1 rounded-full border border-white/5">
          <span>JPG</span>
          <span class="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>PNG</span>
          <span class="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>WEBP</span>
        </div>
      </div>
      
      <!-- Subtle scan line animation on hover -->
      <div class="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity duration-500 bg-[linear-gradient(transparent_0%,#818cf8_50%,transparent_100%)] bg-[length:100%_200%] animate-[scan_2s_infinite_linear]"></div>
    </div>
  `,
  styles: [`
    @keyframes scan {
      from { background-position: 0% -100%; }
      to { background-position: 0% 200%; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploaderComponent {
  imageSelected = output<{ base64: string, mimeType: string }>();
  isDragging = signal(false);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  private processFile(file: File) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.imageSelected.emit({
        base64: result,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  }
}
