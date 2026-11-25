import { useEffect, useState } from "react";
import { formatINR, type Product } from "@agentos/shared";
import { supabase } from "./lib/supabase";

type Check = { label: string; state: "loading" | "ok" | "fail"; detail?: string };

export default function App() {
  const [checks, setChecks] = useState<Check[]>([
    { label: "AgentOS API", state: "loading" },
    { label: "Database (Supabase)", state: "loading" },
    { label: "Mock store", state: "loading" },
  ]);
  const [products, setProducts] = useState<Product[]>([]);

  const set = (i: number, c: Partial<Check>) =>
    setChecks((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...c } : x)));

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(() => set(0, { state: "ok", detail: "reachable" }))
      .catch((e) => set(0, { state: "fail", detail: String(e) }));

    fetch("/api/health/db")
      .then((r) => r.json())
      .then((j) =>
        j.ok
          ? set(1, { state: "ok", detail: `${j.agents} agents, audit chain valid: ${j.audit_chain?.[0]?.valid}` })
          : set(1, { state: "fail", detail: `${j.step}: ${j.error}` })
      )
      .catch((e) => set(1, { state: "fail", detail: String(e) }));

    fetch("/store/products")
      .then((r) => r.json())
      .then((p: Product[]) => {
        setProducts(p);
        set(2, { state: "ok", detail: `${p.length} products` });
      })
      .catch((e) => set(2, { state: "fail", detail: String(e) }));

    // Confirms the anon key + RLS wiring (empty list until you log in is expected)
    supabase.from("agents").select("id").then(({ error }) => {
      if (error) console.warn("Supabase anon read:", error.message);
    });
  }, []);

  const color = { loading: "bg-slate-600", ok: "bg-emerald-500", fail: "bg-red-500" };

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">AgentOS</h1>
      <p className="mt-1 text-slate-400">Phase 1 setup check</p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {checks.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${color[c.state]}`} />
              <span className="font-medium">{c.label}</span>
            </div>
            <p className="mt-2 break-words text-sm text-slate-400">{c.detail ?? "checking..."}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Mock store catalog</h2>
        <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
          {products.map((p) => (
            <li key={p.id} className="flex justify-between p-3">
              <span>{p.name}</span>
              <span className="text-slate-300">{formatINR(p.price_paise)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
