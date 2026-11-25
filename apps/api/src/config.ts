import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// Load the single .env at the repo root
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Ed25519 passport keys: generate with `npm run keys`
  PASSPORT_PRIVATE_KEY: z.string().min(50),
  PASSPORT_PUBLIC_KEY: z.string().min(50),
  API_PORT: z.coerce.number().default(4000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("\nInvalid environment. Check your root .env (copy from .env.example).");
  console.error("Passport keys missing? Run `npm run keys` and paste both lines into .env.\n");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
