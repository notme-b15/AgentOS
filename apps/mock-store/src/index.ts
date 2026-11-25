import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import type { Product } from "@agentos/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
const PORT = Number(process.env.MOCK_STORE_PORT ?? 4100);

// Prices in paise. Spread from Rs 500 to Rs 10,000 so every demo case exists.
export const PRODUCTS: Product[] = [
  { id: "p_notebook",   name: "Spiral Notebook Set",      merchant: "Campus Store", price_paise: 50_000,    description: "Pack of 5 ruled notebooks." },
  { id: "p_mouse",      name: "Wireless Mouse",           merchant: "Campus Store", price_paise: 120_000,   description: "2.4GHz wireless optical mouse." },
  { id: "p_keyboard",   name: "Mechanical Keyboard",      merchant: "Campus Store", price_paise: 300_000,   description: "Hot-swappable 75% mechanical keyboard." },
  { id: "p_headphones", name: "Noise-Cancelling Headphones", merchant: "Campus Store", price_paise: 450_000, description: "Over-ear, 30h battery." },
  { id: "p_monitor",    name: "27-inch 4K Monitor",       merchant: "Campus Store", price_paise: 800_000,   description: "IPS panel, USB-C input." },
  { id: "p_chair",      name: "Ergonomic Office Chair",   merchant: "Campus Store", price_paise: 1_000_000, description: "Adjustable lumbar support." },
];

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "mock-store" }));

app.get("/products", (req, res) => {
  const q = String(req.query.query ?? "").toLowerCase().trim();
  const results = q
    ? PRODUCTS.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q))
    : PRODUCTS;
  res.json(results);
});

app.get("/products/:id", (req, res) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "unknown_product" });
  res.json(product);
});

app.listen(PORT, () => console.log(`Mock store listening on http://localhost:${PORT}`));
