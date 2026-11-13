import { loadEnvConfig } from "@next/env";

// Imported first by scripts so DATABASE_URL etc. are set before the db module loads.
loadEnvConfig(process.cwd());
