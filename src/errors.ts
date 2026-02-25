

export class PG_InvalidError extends Error {
    constructor( message:string ) {
        super(message);
        this.name = "PG_InvalidError";
    }
}


export class PG_NotFoundError extends Error {
    constructor( message:string ) {
        super(message);
        this.name = "PG_InvalidError";
    }
}

