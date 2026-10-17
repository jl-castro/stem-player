interface Env {
  DB: D1Database;
  ADMIN_EXPORT_TOKEN?: string;
}

declare namespace App {
  interface Locals { runtime: { env: Env } }
}
