// src/app/features/projects/projects.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { ProjectManagementComponent } from './project-management/project-management.component';
import { ProjectDetailsComponent } from './project-details/project-details.component';
// Import the standalone component
import { ProjectsComponent } from './projects.component';

const routes = [
  {
    path: '',
    component: ProjectManagementComponent // Use the standalone component as main
  },
  {
    path: 'create',
    component: ProjectManagementComponent // Open project management in create mode
  },
  {
    path: 'management',
    component: ProjectManagementComponent // Management features
  },
  {
    path: ':id',
    component: ProjectDetailsComponent // Project details
  }
];

@NgModule({
  declarations: [
    ProjectManagementComponent,
    ProjectDetailsComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild(routes),
    ProjectsComponent // Import the standalone component
  ]
})
export class ProjectsModule { }