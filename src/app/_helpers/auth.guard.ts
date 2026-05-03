import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AccountService } from '@app/_services';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private accountService: AccountService
    ) { }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
        const account = this.accountService.accountValue;
        if (account) {
            // check if route is restricted by role [cite: 67]
            if (route.data.roles && !route.data.roles.includes(account.role)) {
                // role not authorized so redirect to home page [cite: 67]
                this.router.navigate(['/']);
                return false;
            }

            // authorized so return true [cite: 66]
            return true;
        }

        // not logged in so redirect to login page with the return url [cite: 67]
        this.router.navigate(['/account/login'], { queryParams: { returnUrl: state.url } });
        return false;
    }
}