// src/app/features/sprints/sprints.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { SprintManagementComponent } from './sprint-management/sprint-management.component';

const routes = [
  {
    path: '',
    component: SprintManagementComponent
  },
  {
    path: ':projectId',
    component: SprintManagementComponent
  }
];

@NgModule({
  declarations: [
    SprintManagementComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class SprintsModule { }