# PG-NORM (PostgreSQL NoORM)

> 💡 **Tip**: Install the [`es6-string-html`](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html) extension in VS Code/VSCodium for syntax highlighting inside `sql`` tagged templates.

**PG-NORM** is an SQL-first database layer for PostgreSQL that embraces raw SQL while offering sensible abstractions for common operations. Built on top of [`postgres.js`](https://github.com/porsager/postgres) with full TypeScript support.

Think of it as a **NoORM** (Not an ORM)—a lightweight toolkit that gives you model-like classes with basic CRUD operations so you can focus on writing expressive, performant, and maintainable SQL.

---

## Table of Contents

- [PG-NORM (PostgreSQL NoORM)](#pg-norm-postgresql-noorm)
  - [Table of Contents](#table-of-contents)
  - [Why PG-NORM?](#why-pg-norm)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [Configure your database (`src/db.ts`)](#configure-your-database-srcdbts)
    - [Define a model (`src/models.ts`)](#define-a-model-srcmodelsts)
  - [Core Concepts](#core-concepts)
    - [1. Basic Tables (`PG_Table`)](#1-basic-tables-pg_table)
    - [2. Authentication Tables (`PG_AuthTable`)](#2-authentication-tables-pg_authtable)
    - [3. Ledger Tables (`PG_Ledger`)](#3-ledger-tables-pg_ledger)
  - [API Reference](#api-reference)
    - [`PG_App`](#pg_app)
    - [`PG_Table`](#pg_table)
    - [`PG_AuthTable` (extends `PG_Table`)](#pg_authtable-extends-pg_table)
    - [`PG_Ledger` (immutable)](#pg_ledger-immutable)
  - [Security Features](#security-features)
  - [Best Practices](#best-practices)
  - [Example: E-commerce Application](#example-e-commerce-application)
  - [License](#license)

---

## Why PG-NORM?

**Traditional ORMs and query builders often fall short:**

- ❌ Hide powerful PostgreSQL-specific features  
- ❌ Require verbose code for transactions  
- ❌ Introduce performance bottlenecks on complex queries  
- ❌ Force you to “fight SQL” instead of using it directly  
- ❌ Recreate SQL logic in JavaScript—defeating the purpose

**PG-NORM empowers you with:**

- ✅ Full access to raw SQL—leverage every PostgreSQL feature  
- ✅ Built-in migrations and table management  
- ✅ Automatic SQL injection protection via `postgres.js` tagged templates  
- ✅ Sensible defaults for CRUD without hiding the database  
- ✅ Easy extensibility: write custom queries as methods  
- ✅ First-class TypeScript support  
- ✅ Immutable ledgers and secure auth out of the box  

> SQL was designed for databases. JavaScript wasn’t. PG-NORM lets you use the right tool for the job.

---

## Installation

```bash
npm create pg-norm@latest your-project-name
cd your-project-name
npm install
```

> The `create-pg-norm` starter includes a ready-to-use project scaffold.

---

## Quick Start

After initialization, your project structure looks like this:

```txt
.
├── cli
│   ├── alter.ts
│   └── create.ts
├── package.json
├── src
│   ├── db.ts        # Database connection
│   └── models.ts    # Table definitions
└── tsconfig.json
```

### Configure your database (`src/db.ts`)

```ts
import { PG_App } from 'pg-norm';

export const app = new PG_App({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: 'pass',
  // ... other postgres.js options
  connection: {
    application_name: 'my-app',
    // See: https://www.postgresql.org/docs/current/runtime-config-client.html
  }
});
```

### Define a model (`src/models.ts`)

```ts
import { PG_App, PG_AuthTable } from 'pg-norm';
import { app } from './db.js';

class UsersTable extends PG_AuthTable {
  constructor(pg_app: PG_App) {
    super(pg_app, 'users', ['name', 'email', 'age']);
  }

  async create() {
    await this.sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }

  async findAdults() {
    return this.sql`
      SELECT ${this.sql(this.visibles)}
      FROM ${this.sql(this.table_name)}
      WHERE age >= 18
      ORDER BY name ASC
    `;
  }
}

// Register and use
const usersTable = new UsersTable(app);
app.register(usersTable);

// Basic usage
await usersTable.insert({ 
  name: 'John', 
  email: 'john@example.com', 
  age: 25, 
  password: 'pass1234' 
});

const user = await usersTable.fetch(1);
const adults = await usersTable.findAdults();
```

---

## Core Concepts

### 1. Basic Tables (`PG_Table`)

For standard CRUD operations with full SQL control.

```ts
class ProductsTable extends PG_Table {
  constructor(pg_app: PG_App) {
    super(pg_app, 'products', ['name', 'price', 'category']);
  }

  async create() {
    await this.sql`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50),
        in_stock BOOLEAN DEFAULT true
      )
    `;
  }

  async findByCategory(category: string) {
    return this.sql`
      SELECT ${this.sql(this.visibles)}
      FROM ${this.sql(this.table_name)}
      WHERE category = ${category}
    `;
  }
}
```

### 2. Authentication Tables (`PG_AuthTable`)

Handles password hashing (bcrypt), verification, and secure updates.

```ts
class UsersTable extends PG_AuthTable {
  constructor(pg_app: PG_App) {
    super(pg_app, 'users', ['username', 'email']);
  }

  async create() {
    await this.sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }
}

// Usage
await users.insert({ username: 'alice', email: 'a@example.com', password: 'secret' });
const isValid = await users.verifyPassword(1, 'secret');
```

### 3. Ledger Tables (`PG_Ledger`)

Immutable tables—ideal for audit logs, financial records, or event sourcing.

```ts
class TransactionLedger extends PG_Ledger {
  constructor(pg_app: PG_App) {
    super(pg_app, 'transactions', ['from_account', 'to_account', 'amount', 'type']);
  }

  async create() {
    await this.sql`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        from_account INTEGER NOT NULL,
        to_account INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
        type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }
}

// ✅ Allowed
await ledger.insert({ from_account: 1, to_account: 2, amount: 100, type: 'transfer' });

// ❌ Throws error: ledgers are immutable
// await ledger.update(1, { amount: 200 });
// await ledger.delete(1);
```

> PG-NORM enforces immutability both in code **and** via PostgreSQL Row-Level Security (RLS).

---

## API Reference

### `PG_App`

- `new PG_App(options)` – Initialize connection (uses `postgres.js` options)
- `.register(table)` – Register a table instance
- `.createTables()` – Create all registered tables

### `PG_Table`

- `.insert(data)` – Insert record
- `.fetch(id)` – Get by ID
- `.list()` – Get all
- `.update(id, data)` – Update record
- `.delete(id)` – Delete record

### `PG_AuthTable` (extends `PG_Table`)

- `.verifyPassword(userId, plainText)` → `Promise<boolean>`
- `.updatePassword(userId, newPassword)` – Securely rehash

### `PG_Ledger` (immutable)

- Only `.insert()` is allowed
- Updates/deletes throw runtime errors
- Enforced at the database level via RLS

---

## Security Features

- 🔒 **SQL Injection Protection**: All queries use parameterized `sql`` templates
- 🔑 **Password Security**: Automatic bcrypt hashing with configurable rounds
- 🛡️ **Immutable Ledgers**: RLS policies prevent tampering—even via direct SQL
- 🧪 **Field Whitelisting**: Only declared `visibles` fields can be inserted/updated

---

## Best Practices

1. **Extend, don’t replace**: Add domain-specific query methods to your table classes
2. **Use ledgers for history**: Financial data, logs, or any append-only use case
3. **Validate early**: Rely on PostgreSQL constraints + visible field filtering
4. **Write raw SQL**: Take full advantage of CTEs, window functions, JSON, etc.
5. **Type everything**: Use TypeScript interfaces for query results when needed

---

## Example: E-commerce Application

```ts
class OrdersTable extends PG_Table {
  constructor(pg_app: PG_App) {
    super(pg_app, 'orders', ['user_id', 'total', 'status']);
  }

  async create() {
    await this.sql`
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }

  async getUserOrders(userId: number) {
    return this.sql`
      SELECT o.*,
             json_agg(
               json_build_object('product_id', oi.product_id, 'quantity', oi.quantity)
             ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ${userId}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
  }
}
```

---

## License

MIT © Hussein Layth Al-Madhachi

---
