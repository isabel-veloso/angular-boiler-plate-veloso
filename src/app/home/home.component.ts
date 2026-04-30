import { Component } from '@angular/core';
import { AccountService } from '@app/_services';

@Component({ templateUrl: 'home.component.html', standalone: false })
export class HomeComponent {
    account: any; // 1. Declare the variable here

    constructor(private accountService: AccountService) {
        // 2. Assign the value here inside the constructor
        this.account = this.accountService.accountValue;
    }
}