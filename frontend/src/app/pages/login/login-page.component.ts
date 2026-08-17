
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login-page',
    imports: [ReactiveFormsModule],
    templateUrl: './login-page.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent {
  loading = false;
  errorMessage = '';

  form = this.formBuilder.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const { username, password } = this.form.getRawValue();

    this.authService.login(username || '', password || '').subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = this.loginErrorMessage(error);
      }
    });
  }

  private loginErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unable to sign in. Please try again.';
    }

    if (error.status === 401) {
      return 'Invalid username or password.';
    }

    if (error.status === 0) {
      return 'Unable to reach the Limitr backend. Confirm it is running and try again.';
    }

    if (error.status >= 500) {
      return 'The Limitr backend is temporarily unavailable. Please try again shortly.';
    }

    if (error.status === 400) {
      return 'The login request was rejected. Check your entries and try again.';
    }

    return 'Unable to sign in. Please try again.';
  }
}
