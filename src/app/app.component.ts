import { Component } from '@angular/core';

import { AccountService } from './_services';
import { Account, Role } from './_models';

@Component({ 
    selector: 'app-root', 
    templateUrl: 'app.component.html',
    standalone: false // Add this to prevent the NG6008 error if it was missing
})
export class AppComponent {
    Role = Role;
    account?: Account | null;

    constructor(private accountService: AccountService) {
        this.accountService.account.subscribe(x => this.account = x);
    }

    logout() {
        this.accountService.logout();
    }
}