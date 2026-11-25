// Offline passport checks: no database calls. Run: npm run test:crypto
import { SignJWT, generateKeyPair } from "jose";
import { issuePassport, verifyPassport } from "../src/modules/credentials/service";

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failed++;
};
const rejects = async (p: Promise<unknown>) => p.then(() => false, () => true);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const agent = { id: "agent_test", owner: "test@agentos.local", token_version: 1 };
const policy = {
  scopes: ["search_products", "purchase", "check_budget"],
  max_per_txn: 500_000, daily_budget: 1_500_000, approval_threshold: 400_000,
};

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

console.log("\nPassport crypto checks\n");

// 1. A fresh passport verifies and carries the limits inside it
const { token } = await issuePassport(agent, policy, 600);
const claims = await verifyPassport(token);
check("valid passport verifies", claims.sub === "agent_test");
check("limits are baked into the token",
  claims.max_per_txn === 500_000 && claims.daily_budget === 1_500_000 &&
  claims.approval_threshold === 400_000 && claims.scopes.includes("purchase"));
check("token carries version and expiry", claims.ver === 1 && typeof claims.exp === "number");

// 2. Privilege escalation: edit the payload, keep the old signature
const [h, p, s] = token.split(".");
const forgedPayload = { ...decode(p), max_per_txn: 9_999_999_900 };
check("tampered payload (raised limit) is rejected",
  await rejects(verifyPassport([h, b64(forgedPayload), s].join("."))));

// 3. Attacker signs a perfectly valid-looking token with THEIR OWN key
const attacker = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const forged = await new SignJWT({ ...decode(p) })
  .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
  .sign(attacker.privateKey);
check("token signed with a different key is rejected", await rejects(verifyPassport(forged)));

// 4. Unsigned token (alg none)
const none = `${b64({ alg: "none", typ: "JWT" })}.${b64(decode(p))}.`;
check("unsigned (alg none) token is rejected", await rejects(verifyPassport(none)));

// 5. Expiry
const short = await issuePassport(agent, policy, 1);
check("short-lived token is valid at first", (await verifyPassport(short.token)).sub === "agent_test");
await sleep(2200);
check("expired token is rejected", await rejects(verifyPassport(short.token)));

// 6. Garbage
check("garbage string is rejected", await rejects(verifyPassport("not.a.jwt")));
check("empty string is rejected", await rejects(verifyPassport("")));

// 7. Signed correctly but wrong claim shape (unknown scope)
const { priv } = await (await import("../src/crypto/keys")).getKeys();
const badShape = await new SignJWT({ scopes: ["delete_everything"], max_per_txn: 1, daily_budget: 1,
  approval_threshold: 1, owner: "x", ver: 1 })
  .setProtectedHeader({ alg: "EdDSA" }).setSubject("agent_x").setIssuer("agentos")
  .setExpirationTime("10m").sign(priv);
check("validly signed token with unknown scope is rejected", await rejects(verifyPassport(badShape)));

console.log(failed ? `\n${failed} check(s) FAILED\n` : "\nAll crypto checks passed\n");
process.exit(failed ? 1 : 0);
