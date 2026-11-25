import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  crv: "Ed25519",
  extractable: true,
});
const priv = (await exportPKCS8(privateKey)).trim().replace(/\n/g, "\\n");
const pub = (await exportSPKI(publicKey)).trim().replace(/\n/g, "\\n");

console.log("\nPaste these two lines into your .env:\n");
console.log(`PASSPORT_PRIVATE_KEY="${priv}"`);
console.log(`PASSPORT_PUBLIC_KEY="${pub}"\n`);
