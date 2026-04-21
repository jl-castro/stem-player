import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-player-page',
  standalone: true,
  templateUrl: './player-page.component.html',
  styleUrl: './player-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPageComponent {}
