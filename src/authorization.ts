import { PG_UnauthorizedError } from "./errors.js";

export type PG_AccessChecker = ( metadata:Record<string, any> ) => Promise<boolean>


export class PG_SecureAction{
    protected actions_checkers : Map<string, {check:PG_AccessChecker}>

    constructor(){
        this.actions_checkers = new Map;
    }

    registerAction( action:string, checker: PG_AccessChecker) {
        this.actions_checkers.set(action, {check:checker});
    }


    async secureAction( action:string, metadata:Record<string, any> ) {
        const permitted = await this.actions_checkers.get(action)?.check(metadata);
        if( ! permitted ) {
            throw new PG_UnauthorizedError("Unauthorized");
        }
    }

}


