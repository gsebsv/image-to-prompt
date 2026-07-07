
import { Injectable, signal } from '@angular/core';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string; // In a real app, never store plain passwords. This is a simulation.
  history: any[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly USERS_KEY = 'style_replicator_users';
  private readonly SESSION_KEY = 'style_replicator_session';

  currentUser = signal<User | null>(null);

  constructor() {
    this.restoreSession();
  }

  private getUsers(): Record<string, User> {
    const usersJson = localStorage.getItem(this.USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : {};
  }

  private saveUsers(users: Record<string, User>) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  restoreSession() {
    const sessionId = localStorage.getItem(this.SESSION_KEY);
    if (sessionId) {
      const users = this.getUsers();
      if (users[sessionId]) {
        this.currentUser.set(users[sessionId]);
      } else {
        localStorage.removeItem(this.SESSION_KEY);
      }
    }
  }

  register(username: string, email: string, password: string): { success: boolean, message: string } {
    const users = this.getUsers();
    
    // Simple check if user exists (by email or username)
    const exists = Object.values(users).some(u => u.email === email || u.username === username);
    if (exists) {
      return { success: false, message: 'User with this email or username already exists.' };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      passwordHash: btoa(password), // Simple encoding for simulation. NOT SECURE for production.
      history: []
    };

    users[newUser.id] = newUser;
    this.saveUsers(users);
    
    // Auto login
    this.login(email, password);
    return { success: true, message: 'Account created successfully.' };
  }

  login(identifier: string, password: string): { success: boolean, message: string } {
    const users = this.getUsers();
    const foundUser = Object.values(users).find(u => 
      (u.email === identifier || u.username === identifier) && u.passwordHash === btoa(password)
    );

    if (foundUser) {
      this.currentUser.set(foundUser);
      localStorage.setItem(this.SESSION_KEY, foundUser.id);
      return { success: true, message: 'Logged in successfully.' };
    }

    return { success: false, message: 'Invalid credentials.' };
  }

  logout() {
    this.currentUser.set(null);
    localStorage.removeItem(this.SESSION_KEY);
  }

  updateHistory(newHistory: any[]) {
    const user = this.currentUser();
    if (user) {
      const users = this.getUsers();
      if (users[user.id]) {
        users[user.id].history = newHistory;
        this.saveUsers(users);
        
        // Update local state
        this.currentUser.set({ ...users[user.id] });
      }
    }
  }
}
