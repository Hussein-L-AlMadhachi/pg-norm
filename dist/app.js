import postgres from "postgres";
import {} from "./tables.js";
export class PG_App {
    tables = {};
    sql;
    constructor(options) {
        this.sql = postgres(options);
    }
    register(table) {
        this.tables[table.table_name] = table;
    }
    async createTables() {
        for (const table_name in this.tables) {
            await this.tables[table_name].create();
        }
    }
    async alterTables() {
        for (const table_name in this.tables) {
            await this.tables[table_name].alter();
        }
    }
}
//# sourceMappingURL=app.js.map