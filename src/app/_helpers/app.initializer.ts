import { of } from 'rxjs'; // Add this line
import { catchError } from 'rxjs/operators'; // Operators usually come from rxjs/operators

import { AccountService } from '@app/_services';

export function appInitializer(accountService: AccountService) {
    return () => accountService.refreshToken()
    .pipe(
        // catch error to start app on success or failure
        catchError(() => of())
    );
}