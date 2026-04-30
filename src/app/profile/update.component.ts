import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';

import { AccountService, AlertService } from '@app/_services';
import { MustMatch } from '@app/_helpers';

@Component({ templateUrl: 'update.component.html', standalone: false })
export class UpdateComponent implements OnInit {

    // 1. Just declare it here without assigning a value
    account: any;

    // account = this.accountService.accountValue;
    form!: FormGroup;
    submitting = false;
    submitted = false;
    deleting = false;

    constructor(
        private formBuilder: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private accountService: AccountService,
        private alertService: AlertService
    ) {
        // 2. This safely assigns the value once the service is ready
        this.account = this.accountService.accountValue;
    }

    ngOnInit() {
        this.form = this.formBuilder.group({
            title: [this.account?.title, Validators.required],
            firstName: [this.account?.firstName, Validators.required],
            lastName: [this.account?.lastName, Validators.required],
            email: [this.account?.email, [Validators.required, Validators.email]],
            password: ['', [Validators.minLength(6)]],
            confirmPassword: ['']
        }, {
            validator: MustMatch('password', 'confirmPassword')
        });
    }

    // convenience getter for easy access to form fields
    get f() { return this.form.controls; }

    onSubmit() {
        this.submitted = true;

        // reset alerts on submit
        this.alertService.clear();

        // stop here if form is invalid
        if (this.form.invalid) {
            return;
        }

        this.submitting = true;
        this.accountService.update(this.account!.id, this.form.value)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Update successful', { keepAfterRouteChange: true });
                    this.router.navigate(['../'], { relativeTo: this.route });
                },
                error: error => {
                    this.alertService.error(error);
                    this.submitting = false;
                }
            });
    }

    onDelete() {
        if (confirm('Are you sure?')) {
            this.deleting = true;
            this.accountService.delete(this.account!.id)
                .pipe(first())
                .subscribe(() => {
                    this.alertService.success('Account deleted successfully');
                });
        }
    }
}