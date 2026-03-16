import { Component, Input, OnInit, HostBinding } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent implements OnInit {
  @Input() message: string = 'Loading';
  @Input() details: string = '';
  @Input() showProgress: boolean = false;
  @Input() progress: number = 0;
  @Input() overlay: boolean = false;
  @Input() size: 'small' | 'normal' | 'large' = 'normal';

  // Generate particles for animation
  particles: number[] = [];

  @HostBinding('class') get hostClasses(): string {
    const classes = ['loading-host'];
    if (this.overlay) classes.push('loading-overlay-host');
    if (this.size !== 'normal') classes.push(`loading-${this.size}-host`);
    return classes.join(' ');
  }

  ngOnInit() {
    // Create 5 particles for the floating animation
    this.particles = Array.from({ length: 5 }, (_, i) => i);
  }

  get containerClasses(): Record<string, boolean> {
    return {
      'loading-container': true,
      'overlay': this.overlay,
      'small': this.size === 'small',
      'large': this.size === 'large'
    };
  }
}