
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface TopNavItem {
  label: string;
  route: string;
  exact?: boolean;
}

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './shell.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./shell.component.css']
})
export class ShellComponent implements OnInit {
  darkMode = localStorage.getItem('limitr_dark') === '1';
  readonly topNav: TopNavItem[] = [
    { label: 'OVERVIEW', route: '/dashboard' },
    { label: 'TRAFFIC', route: '/traffic' },
    { label: 'RULES', route: '/rules' },
    { label: 'LOGS', route: '/logs' },
    { label: 'INCIDENTS', route: '/incidents' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.applyDarkMode();
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('limitr_dark', this.darkMode ? '1' : '0');
    this.applyDarkMode();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private applyDarkMode(): void {
    document.body.classList.toggle('theme-dark', this.darkMode);
  }
}
