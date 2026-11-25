import { importPKCS8, importSPKI, type KeyLike } from "jose";
import { config } from "../config";

// .env stores the PEMs on one line with literal \n; turn them back into newlines
const unescape = (s: string) => s.replace(/\\n/g, "\n");

let cache: { priv: KeyLike; pub: KeyLike } | null = null;

export async function getKeys() {
  if (!cache) {
    cache = {
      priv: await importPKCS8(unescape(config.PASSPORT_PRIVATE_KEY), "EdDSA"),
      pub: await importSPKI(unescape(config.PASSPORT_PUBLIC_KEY), "EdDSA"),
    };
  }
  return cache;
}
