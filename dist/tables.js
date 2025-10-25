import bcrypt from 'bcrypt';
import { PG_App } from "./app.js";
export class PG_Table {
    table_name;
    visibles;
    sql;
    async alter() {
        throw new Error("You need to overwrite this method. this is where your ALTER TABLE statement goes");
    }
    constructor(pg_app, name, feilds) {
        this.sql = pg_app.sql;
        this.table_name = name;
        this.visibles = feilds;
    }
    async create() {
        throw new Error("You need to overwrite this method. this is where your CREATE TABLE statement goes");
    } // to be overwritten
    async insert(data) {
        const keys = Object.keys(data);
        // validate keys
        for (const key of keys) {
            if (!this.visibles.includes(key)) {
                throw new Error(`field ${key} has to be in visibles which is currectly: ${this.visibles.join(", ")}`);
            }
        }
        return await this.sql `INSERT INTO ${this.sql(this.table_name)} ${this.sql(data, ...keys)} returning id`;
    }
    async fetch(row_id) {
        return await this.sql `SELECT ${this.sql(this.visibles)} FROM ${this.sql(this.table_name)} WHERE id=${row_id}`;
    }
    async list() {
        return await this.sql `SELECT ${this.sql(this.visibles)} FROM ${this.sql(this.table_name)}`;
    }
    async delete(row_id) {
        return await this.sql `DELETE FROM ${this.sql(this.table_name)} WHERE id=${row_id}`;
    }
    async update(row_id, data) {
        const keys = Object.keys(data);
        // validate keys
        for (const key of keys) {
            if (!this.visibles.includes(key)) {
                throw new Error("updated has to be a fillable");
            }
        }
        return await this.sql `UPDATE ${this.sql(this.table_name)} SET ${this.sql(data, ...keys)} where id=${row_id} returning id`;
    }
}
export class PG_AuthTable extends PG_Table {
    passwordField = "password_hash";
    table_name;
    constructor(pg_connection, name, fillables = []) {
        super(pg_connection, name, fillables);
        this.table_name = name;
    }
    /**
     * Override insert to hash password automatically
     */
    async insert(data) {
        // Hash password if present
        if (data.password) {
            data[this.passwordField] = await this.hashPassword(data.password);
            delete data.password; // Remove plain text password
        }
        // Validate keys against fillables
        const keys = Object.keys(data);
        for (const key of keys) {
            if (!this.visibles.includes(key) && key !== this.passwordField) {
                throw new Error(`${key} has to be a fillable`);
            }
        }
        return await this.sql `INSERT INTO ${this.sql(this.table_name)} ${this.sql(data, ...keys)} RETURNING id`;
    }
    /**
     * Update password method with secure hashing
     */
    async updatePassword(userId, newPassword) {
        const passwordHash = await this.hashPassword(newPassword);
        return await this.sql `
            UPDATE ${this.sql(this.table_name)} 
            SET ${this.sql({ [this.passwordField]: passwordHash })} 
            WHERE id = ${userId} 
            RETURNING id
        `;
    }
    /**
     * Verify password against stored hash
     */
    async verifyPassword(userId, plainTextPassword) {
        const [user] = await this.sql `
            SELECT ${this.sql(this.passwordField)} 
            FROM ${this.sql(this.table_name)} 
            WHERE id = ${userId}
        `;
        if (!user || !user[this.passwordField]) {
            // Perform dummy comparison to prevent side channel and timing attacks (they're hardware exploits)
            await bcrypt.compare('dummy_password', await this.hashPassword('dummy_password'));
            return false;
        }
        return await bcrypt.compare(plainTextPassword, user[this.passwordField]);
    }
    /**
     * Secure password hashing
     */
    async hashPassword(password) {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }
}
export class PG_Ledger {
    table_name;
    visibles;
    create;
    sql;
    constructor(pg_app, name, fillables) {
        this.sql = pg_app.sql;
        this.table_name = name;
        this.visibles = fillables;
        this.create = async () => {
            await this.createTable();
            await this.sql `
                ALTER TABLE ${this.sql(this.table_name)} ENABLE ROW LEVEL SECURITY;

                CREATE POLICY ${this.sql(`${this.table_name}_no_update_policy`)}
                ON ${this.sql(this.table_name)}
                TO PUBLIC
                FOR UPDATE
                WITH CHECK (false);

                CREATE POLICY ${this.sql(`${this.table_name}_no_delete_policy`)} 
                ON ${this.sql(this.table_name)}
                TO PUBLIC
                FOR DELETE
                USING (false);
            `;
        };
    }
    // to be overwritten by inheritors for them to alter their own tables schema
    async alter() {
        throw new Error("You need to overwrite this method. this is where your ALTER TABLE statement goes");
    }
    // to be overwritten by inheritors for them to make thier own schema but users call create like normal to create the tables
    async createTable() {
        throw new Error("You need to overwrite this method. this is where your CREATE TABLE statement goes");
    }
    async insert(data) {
        const keys = Object.keys(data);
        // validate keys
        for (const key of keys) {
            if (!this.visibles.includes(key)) {
                throw new Error("updated has to be a fillable");
            }
        }
        return await this.sql `INSERT INTO ${this.sql(this.table_name)} ${this.sql(data, ...keys)} returning id`;
    }
    async fetch(row_id) {
        return await this.sql `SELECT ${this.sql(this.visibles)} FROM ${this.sql(this.table_name)} WHERE id=${row_id}`;
    }
    async list() {
        return await this.sql `SELECT ${this.sql(this.visibles)} FROM ${this.sql(this.table_name)}`;
    }
    async delete(row_id) {
        throw new Error("this is a ledger!!! do not delete or update anything!!! this is not allowed");
    }
    async update(row_id) {
        throw new Error("this is a ledger!!! do not delete or update anything!!! this is not allowed");
    }
}
//# sourceMappingURL=tables.js.map