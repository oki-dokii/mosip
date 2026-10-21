import { defineConfig } from "prisma/config";

process.env.DATABASE_URL ??= "postgresql://playground:playground@127.0.0.1:5432/playground";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
