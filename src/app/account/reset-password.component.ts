import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/_services';
import { MustMatch } from '@app/_helpers';

enum TokenStatus {
    Validating,
    Valid,
    Invalid
}

@Component({ templateUrl: 'reset-password.component.html', standalone: false })
export class ResetPasswordComponent implements OnInit {
    TokenStatus = TokenStatus;
    tokenStatus = TokenStatus.Validating;
    token?: string;
    form!: FormGroup;
    loading = false;
    submitted = false;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        const urlParams = new URLSearchParams(window.location.search);
        this.token = urlParams.get('token') || undefined;

        this.form = this.formBuilder.group({
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', Validators.required]
        }, {
            validator: MustMatch('password', 'confirmPassword')
        });

        if (this.token) {
            this.accountService.validateResetToken(this.token)
                .pipe(first())
                .subscribe({
                    next: () => {
                        this.tokenStatus = TokenStatus.Valid;
                        this.cdr.detectChanges(); // force UI update
                    },
                    error: () => {
                        this.tokenStatus = TokenStatus.Invalid;
                        this.cdr.detectChanges(); // force UI update
                    }
                });
        } else {
            this.tokenStatus = TokenStatus.Invalid;
            this.cdr.detectChanges();
        }

        setTimeout(() => {
            this.router.navigate([], {
                relativeTo: this.route,
                replaceUrl: true,
                queryParams: {}
            });
        }, 1000);
    }

    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;
        this.alertService.clear();

        if (this.form.invalid) return;

        this.loading = true;
        this.accountService.resetPassword(this.token!, this.f['password'].value, this.f['confirmPassword'].value)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Password reset successful, you can now login', { keepAfterRouteChange: true });
                    this.router.navigate(['../login'], { relativeTo: this.route });
                },
                error: error => {
                    this.alertService.error(error);
                    this.loading = false;
                }
            });
    }
}