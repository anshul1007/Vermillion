import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';

export interface FeatureToggle {
  id: string;
  featureKey: string;
  featureName: string;
  description?: string;
  isEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeatureToggleService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/featuretoggle`;

  getAll(): Observable<FeatureToggle[]> {
    return this.http.get<ApiResponse<FeatureToggle[]>>(`${this.apiUrl}`)
      .pipe(map(response => {
        if (response.success && response.data) return response.data;
        throw new Error(response.message || 'Failed to fetch feature toggles');
      }));
  }

  getByKey(key: string): Observable<FeatureToggle> {
    return this.http.get<ApiResponse<FeatureToggle>>(`${this.apiUrl}/key/${key}`)
      .pipe(map(response => {
        if (response.success && response.data) return response.data;
        throw new Error(response.message || 'Failed to fetch feature toggle');
      }));
  }

  check(key: string) {
    return this.http.get<ApiResponse<boolean>>(`${this.apiUrl}/check/${key}`)
      .pipe(map(response => {
        if (response.success) return response.data;
        throw new Error(response.message || 'Failed to check feature');
      }));
  }

  toggle(id: string, isEnabled: boolean) {
    return this.http.patch<ApiResponse<any>>(`${this.apiUrl}/${id}/toggle`, { isEnabled })
      .pipe(map(response => {
        if (response.success) return response.data;
        throw new Error(response.message || 'Failed to toggle feature');
      }));
  }
}
