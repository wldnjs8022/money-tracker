import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { seedDefaultsForUser } from "@/server/defaults";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days: this is a personal app, stay signed in
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        // Every new user starts with a few wallets and a full category set.
        after: async (user) => {
          await seedDefaultsForUser(user.id);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
