
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { AdminApiService } from '../../services/admin-api.service';

const ruleRelationshipValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const baseLimit = control.get('baseLimitPerMinute')?.value;
  const throttledLimit = control.get('throttledLimitPerMinute')?.value;
  const warnThreshold = control.get('warnThreshold')?.value;
  const throttleThreshold = control.get('throttleThreshold')?.value;
  const banThreshold = control.get('banThreshold')?.value;
  const errors: ValidationErrors = {};

  if (
    typeof baseLimit === 'number' &&
    typeof throttledLimit === 'number' &&
    throttledLimit > baseLimit
  ) {
    errors['rateLimitOrder'] = true;
  }

  if (
    typeof warnThreshold === 'number' &&
    typeof throttleThreshold === 'number' &&
    typeof banThreshold === 'number' &&
    !(warnThreshold < throttleThreshold && throttleThreshold < banThreshold)
  ) {
    errors['thresholdOrder'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

@Component({
    selector: 'app-rules-page',
    imports: [ReactiveFormsModule],
    templateUrl: './rules-page.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./rules-page.component.css']
})
export class RulesPageComponent implements OnInit {
  message = '';
  error = '';
  loadingRules = true;
  rulesLoaded = false;
  rulesLoadError = '';
  savingRules = false;

  ruleForm = this.formBuilder.group(
    {
      baseLimitPerMinute: [60, [Validators.required, Validators.min(1)]],
      throttledLimitPerMinute: [20, [Validators.required, Validators.min(1)]],
      warnThreshold: [2, [Validators.required, Validators.min(0)]],
      throttleThreshold: [4, [Validators.required, Validators.min(1)]],
      banThreshold: [7, [Validators.required, Validators.min(1)]],
      banMinutes: [15, [Validators.required, Validators.min(1)]]
    },
    { validators: ruleRelationshipValidator }
  );

  banForm = this.formBuilder.group({
    principalId: ['', Validators.required],
    minutes: [15, [Validators.required, Validators.min(1)]]
  });

  unbanForm = this.formBuilder.group({
    principalId: ['', Validators.required]
  });

  constructor(
    private formBuilder: FormBuilder,
    private adminApiService: AdminApiService
  ) {}

  ngOnInit(): void {
    this.ruleForm.disable({ emitEvent: false });
    this.loadRules();
  }

  loadRules(): void {
    this.loadingRules = true;
    this.rulesLoaded = false;
    this.rulesLoadError = '';
    this.message = '';
    this.error = '';
    this.ruleForm.disable({ emitEvent: false });

    this.adminApiService.getStats().subscribe({
      next: (response) => {
        const rules = response.rules;
        this.ruleForm.patchValue({
          baseLimitPerMinute: rules.baseLimitPerMinute,
          throttledLimitPerMinute: rules.throttledLimitPerMinute,
          warnThreshold: rules.warnThreshold,
          throttleThreshold: rules.throttleThreshold,
          banThreshold: rules.banThreshold,
          banMinutes: rules.banMinutes
        });
        this.ruleForm.enable({ emitEvent: false });
        this.ruleForm.updateValueAndValidity({ emitEvent: false });
        this.ruleForm.markAsPristine();
        this.ruleForm.markAsUntouched();
        this.rulesLoaded = true;
        this.loadingRules = false;
      },
      error: () => {
        this.loadingRules = false;
        this.rulesLoadError = 'Unable to load the current rules. The form remains locked to prevent an unsafe overwrite.';
      }
    });
  }

  saveRules(): void {
    this.message = '';
    this.error = '';
    if (!this.rulesLoaded || this.loadingRules || this.savingRules) {
      this.error = 'Load the current rule configuration before saving changes.';
      return;
    }

    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }

    this.savingRules = true;
    const payload = this.ruleForm.getRawValue();
    this.adminApiService.updateRules(payload).subscribe({
      next: () => {
        this.savingRules = false;
        this.ruleForm.markAsPristine();
        this.message = 'Rules updated successfully.';
      },
      error: (error: HttpErrorResponse) => {
        this.savingRules = false;
        this.error = this.extractErrorMessage(error, 'Unable to update rules.');
      }
    });
  }

  banPrincipal(): void {
    this.message = '';
    this.error = '';
    if (this.banForm.invalid) {
      this.banForm.markAllAsTouched();
      return;
    }

    const values = this.banForm.getRawValue();
    this.adminApiService.banPrincipal(values.principalId || '', Number(values.minutes || 15)).subscribe({
      next: () => {
        this.message = 'Principal banned.';
      },
      error: (error: HttpErrorResponse) => {
        this.error = this.extractErrorMessage(error, 'Unable to ban principal.');
      }
    });
  }

  unbanPrincipal(): void {
    this.message = '';
    this.error = '';
    if (this.unbanForm.invalid) {
      this.unbanForm.markAllAsTouched();
      return;
    }

    const values = this.unbanForm.getRawValue();
    this.adminApiService.unbanPrincipal(values.principalId || '').subscribe({
      next: () => {
        this.message = 'Principal unbanned.';
      },
      error: (error: HttpErrorResponse) => {
        this.error = this.extractErrorMessage(error, 'Unable to unban principal.');
      }
    });
  }

  private extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = error.error?.error;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
