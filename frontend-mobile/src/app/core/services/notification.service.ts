import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  errorMessage = signal('');
  successMessage = signal('');

  showError(msg: string, timeout = 4000) {
    this.errorMessage.set(msg || 'An error occurred');
    if (timeout > 0) setTimeout(() => this.errorMessage.set(''), timeout);
  }

  showSuccess(msg: string, timeout = 3000) {
    this.successMessage.set(msg || 'Done');
    if (timeout > 0) setTimeout(() => this.successMessage.set(''), timeout);
  }

  clear() {
    this.errorMessage.set('');
    this.successMessage.set('');
  }
}
