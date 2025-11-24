import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';

export interface PublicHoliday {
  id?: string;
  name: string;
  date: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommonService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/attendance`;

  getPublicHolidays(year?: number): Observable<PublicHoliday[]> {
    let params = new HttpParams();
    if (year) params = params.set('year', year.toString());
    
    return this.http.get<ApiResponse<PublicHoliday[]>>(`${this.apiUrl}/holidays`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || response.error || 'Failed to fetch holidays');
        })
      );
  }
}
