
import { Component, output, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div class="glass-panel rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="px-8 pt-8 pb-6 text-center">
          <h2 class="text-2xl font-bold text-white mb-2">Welcome Back</h2>
          <p class="text-sm text-slate-400">Sign in to access your history and preferences</p>
        </div>

        <!-- Tabs -->
        <div class="flex px-8 border-b border-white/5">
          <button 
            (click)="mode.set('login')" 
            class="flex-1 pb-3 text-sm font-medium transition-colors relative"
            [class.text-indigo-400]="mode() === 'login'"
            [class.text-slate-500]="mode() !== 'login'"
            [class.hover:text-slate-300]="mode() !== 'login'"
          >
            Sign In
            @if(mode() === 'login') {
              <div class="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full"></div>
            }
          </button>
          <button 
            (click)="mode.set('register')" 
            class="flex-1 pb-3 text-sm font-medium transition-colors relative"
            [class.text-indigo-400]="mode() === 'register'"
            [class.text-slate-500]="mode() !== 'register'"
            [class.hover:text-slate-300]="mode() !== 'register'"
          >
            Create Account
            @if(mode() === 'register') {
              <div class="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full"></div>
            }
          </button>
        </div>

        <div class="p-8">
          @if (error()) {
            <div class="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-red-400 mt-0.5 shrink-0">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <span class="text-red-300 text-xs leading-5">{{ error() }}</span>
            </div>
          }

          @if (mode() === 'login') {
            <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-4">
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email or Username</label>
                <input 
                  type="text" 
                  formControlName="identifier"
                  class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  placeholder="Enter your identifier"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <input 
                  type="password" 
                  formControlName="password"
                  class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit" 
                [disabled]="!loginForm.valid"
                class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20 mt-2"
              >
                Sign In
              </button>
            </form>
          } @else {
            <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="space-y-4">
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Username</label>
                <input 
                  type="text" 
                  formControlName="username"
                  class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  placeholder="Choose a username"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  formControlName="email"
                  class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  placeholder="name@example.com"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <input 
                  type="password" 
                  formControlName="password"
                  class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                  placeholder="Min 6 characters"
                />
              </div>
              <button 
                type="submit" 
                [disabled]="!registerForm.valid"
                class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20 mt-2"
              >
                Create Account
              </button>
            </form>
          }
        </div>

        <div class="bg-black/20 p-4 border-t border-white/5 flex justify-center">
          <button (click)="close.emit()" class="text-slate-400 text-xs font-medium hover:text-white transition-colors">
            Cancel
          </button>
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
export class AuthModalComponent {
  close = output<void>();
  loginSuccess = output<void>();
  
  authService = inject(AuthService);
  fb: FormBuilder = inject(FormBuilder);

  mode = signal<'login' | 'register'>('login');
  error = signal<string | null>(null);

  loginForm = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required]
  });

  registerForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onLogin() {
    if (this.loginForm.invalid) return;
    
    const { identifier, password } = this.loginForm.value;
    const result = this.authService.login(identifier!, password!);
    
    if (result.success) {
      this.loginSuccess.emit();
      this.close.emit();
    } else {
      this.error.set(result.message);
    }
  }

  onRegister() {
    if (this.registerForm.invalid) return;

    const { username, email, password } = this.registerForm.value;
    const result = this.authService.register(username!, email!, password!);

    if (result.success) {
      this.loginSuccess.emit();
      this.close.emit();
    } else {
      this.error.set(result.message);
    }
  }
}
