import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from '../../shared/shared.module';
import { ProfileDashboardRoutingModule } from './profile-dashboard-routing.module';
import { ProfileDashboardComponent } from './profile-dashboard.component';

@NgModule({
  declarations: [ProfileDashboardComponent],
  imports: [
    CommonModule,
    SharedModule,
    ProfileDashboardRoutingModule
  ]
})
export class ProfileDashboardModule {}
