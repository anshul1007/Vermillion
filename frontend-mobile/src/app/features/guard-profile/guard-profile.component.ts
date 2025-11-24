// import { Component, inject, signal, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { Router } from '@angular/router';
// import { AuthService } from '../../core/auth/auth.service';
// import { ApiService } from '../../core/services/api.service';

// @Component({
//   selector: 'app-guard-profile',
//   standalone: true,
//   imports: [CommonModule],
//   template: `
//     <div class="container">
//       <div class="row mb-2">
//         <div class="col-12">
//           <div class="row align-center">
//             <h1 class="mb-0">My Profile</h1>
//           </div>
//         </div>
//       </div>

//       <ng-container *ngIf="loading(); else profileLoaded">
//         <div class="row">
//           <div class="col-12">
//             <div class="card">
//               <div class="card-body">
//                 <p class="text-muted mb-0">Loading profile...</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </ng-container>

//       <ng-template #profileLoaded>
//         <ng-container *ngIf="profile(); else profileError">
//           <div class="row">
//             <div class="col-12">
//               <div class="card mb-2">
//                 <div class="card-body text-center">
//                   <div class="profile-icon mb-2">🛡️</div>
//                   <h2 class="mb-2">{{ profile()!.firstName }} {{ profile()!.lastName }}</h2>

//                   <div class="profile-details">
//                     <div class="profile-item mb-2">
//                       <div class="profile-label">Guard ID</div>
//                       <div class="profile-value">{{ profile()!.guardId }}</div>
//                     </div>

//                     <div class="profile-item mb-2">
//                       <div class="profile-label">Phone</div>
//                       <div class="profile-value">{{ profile()!.phoneNumber }}</div>
//                     </div>

//                     <div class="profile-item mb-2">
//                       <div class="profile-label">Status</div>
//                       <div class="profile-value">
//                         <span class="status-active" *ngIf="profile()!.isActive; else inactiveStatus">
//                           ● Active
//                         </span>
//                         <ng-template #inactiveStatus>
//                           <span class="status-inactive">● Inactive</span>
//                         </ng-template>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div class="row">
//             <div class="col-12">
//               <div class="card mb-2">
//                 <div class="card-body">
//                   <h2 class="mb-2">Assigned Project</h2>
//                   <div class="row align-center">
//                     <div class="avatar">🏗️</div>
//                     <div class="flex-1">
//                       <h3 class="mb-1">{{ profile()!.projectName }}</h3>
//                       <p class="text-muted mb-0">Project ID: {{ profile()!.projectId }}</p>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div class="row" *ngIf="contractors().length > 0">
//             <div class="col-12">
//               <div class="card mb-2">
//                 <div class="card-body">
//                   <h2 class="mb-2">Site Contractors</h2>
//                   <div
//                     *ngFor="let contractor of contractors()"
//                     [attr.data-id]="contractor.id"
//                     class="contractor-item mb-2"
//                   >
//                     <div class="row align-center">
//                       <div class="avatar">👷</div>
//                       <div class="flex-1">
//                         <h4 class="mb-1">{{ contractor.name }}</h4>
//                         <p class="text-muted mb-0">Contact: {{ contractor.contactPerson }}</p>
//                         <p class="mb-0">📞 {{ contractor.phoneNumber }}</p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </ng-container>

//         <ng-template #profileError>
//           <div class="row">
//             <div class="col-12">
//               <div class="card">
//                 <div class="card-body">
//                   <p class="text-danger mb-0">Failed to load profile</p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </ng-template>
//       </ng-template>
//     </div>
//   `,
// })
// export class GuardProfileComponent implements OnInit {
//   private authService = inject(AuthService);
//   private apiService = inject(ApiService);
//   private router = inject(Router);

//   profile = this.authService.guardProfile;
//   contractors = signal<any[]>([]);
//   loading = signal(false);

//   ngOnInit(): void {
//     this.loadProfile();
//   }

//   loadProfile(): void {
//     this.loading.set(true);

//     this.authService.loadGuardProfile().subscribe({
//       next: (profile) => {
//         this.loading.set(false);
//         this.loadContractors(profile.projectId);
//       },
//       error: (err) => {
//         this.loading.set(false);
//         console.error('Failed to load profile:', err);
//       },
//     });
//   }

//   loadContractors(projectId: number): void {
//     this.apiService.getContractorsByProject(projectId).subscribe({
//       next: (response) => {
//         this.contractors.set(response.data || []);
//       },
//       error: (err) => {
//         console.error('Failed to load contractors:', err);
//       },
//     });
//   }

//   goBack(): void {
//     this.router.navigate(['/dashboard']);
//   }
// }
