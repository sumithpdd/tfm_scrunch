"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AZURE_DEPLOYMENT_PRESETS,
  GEMINI_MODEL_PRESETS,
  type AiKeySource,
  type AiProviderName,
} from "@/lib/ai-settings";
import type { StandDeskRole } from "@/lib/stand-desk";

const CUSTOM = "__custom__";

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#6e3fff] focus:ring-2 focus:ring-[#6e3fff]/20";

type SettingsPayload = {
  success?: boolean;
  error?: string;
  firestore?: boolean;
  projectId?: string | null;
  keys?: { azure: boolean; azureResource: boolean; gemini: boolean };
  settings?: {
    provider: AiProviderName;
    azureDeployment: string;
    geminiModel: string;
    azureApiKey: string;
    azureResourceName: string;
    geminiApiKey: string;
    source: "firestore" | "env";
    updatedAt: string | null;
    keySource?: {
      azureApiKey: AiKeySource;
      azureResourceName: AiKeySource;
      geminiApiKey: AiKeySource;
    };
  };
};

function selectValue(current: string, presets: readonly { id: string }[]): string {
  return presets.some((p) => p.id === current) ? current : CUSTOM;
}

function sourceLabelFor(source?: AiKeySource): string {
  if (source === "firestore") return "saved in Firestore";
  if (source === "env") return "from server env";
  return "not set";
}

function SecretField({
  label,
  value,
  onChange,
  source,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  source?: AiKeySource;
  placeholder?: string;
}) {
  const [show, setShow] = useState(true);
  return (
    <label className="block text-sm font-medium text-zinc-700">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-xs font-normal text-zinc-500">{sourceLabelFor(source)}</span>
      </span>
      <div className="mt-1 flex gap-2">
        <input
          type={show ? "text" : "password"}
          autoComplete="off"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="shrink-0 rounded-xl border border-zinc-200 px-3 text-sm font-semibold text-zinc-700"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

export function StandDeskSettingsView() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [role, setRole] = useState<StandDeskRole | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"azure" | "gemini" | null>(null);
  const [payload, setPayload] = useState<SettingsPayload | null>(null);

  const [provider, setProvider] = useState<AiProviderName>("azure");
  const [azureSelect, setAzureSelect] = useState<string>(AZURE_DEPLOYMENT_PRESETS[0].id);
  const [azureCustom, setAzureCustom] = useState("");
  const [geminiSelect, setGeminiSelect] = useState<string>(GEMINI_MODEL_PRESETS[0].id);
  const [geminiCustom, setGeminiCustom] = useState("");
  const [azureApiKey, setAzureApiKey] = useState("");
  const [azureResourceName, setAzureResourceName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const applyPayload = useCallback((data: SettingsPayload) => {
    setPayload(data);
    const next = data.settings;
    if (!next) return;
    setProvider(next.provider);
    setAzureSelect(selectValue(next.azureDeployment, AZURE_DEPLOYMENT_PRESETS));
    setAzureCustom(selectValue(next.azureDeployment, AZURE_DEPLOYMENT_PRESETS) === CUSTOM ? next.azureDeployment : "");
    setGeminiSelect(selectValue(next.geminiModel, GEMINI_MODEL_PRESETS));
    setGeminiCustom(selectValue(next.geminiModel, GEMINI_MODEL_PRESETS) === CUSTOM ? next.geminiModel : "");
    setAzureApiKey(next.azureApiKey ?? "");
    setAzureResourceName(next.azureResourceName ?? "");
    setGeminiApiKey(next.geminiApiKey ?? "");
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    const data = (await res.json()) as SettingsPayload;
    if (res.status === 401) {
      setUnlocked(false);
      return;
    }
    if (res.status === 403) {
      setUnlocked(true);
      setError(data.error ?? "Booth AEs can't change settings — ask the stand admin.");
      return;
    }
    if (!res.ok || !data.success) throw new Error(data.error ?? "Could not load settings");
    applyPayload(data);
  }, [applyPayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/leads/session");
        const data = (await res.json()) as { unlocked?: boolean; role?: StandDeskRole | null };
        if (cancelled) return;
        setUnlocked(Boolean(data.unlocked));
        setRole(data.role ?? null);
        if (data.unlocked) await loadSettings();
      } catch {
        if (!cancelled) setUnlocked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = (await res.json()) as { success?: boolean; role?: StandDeskRole; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "That passcode doesn't match.");
      setUnlocked(true);
      setRole(data.role ?? null);
      setSecret("");
      await loadSettings();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const azureDeployment = azureSelect === CUSTOM ? azureCustom.trim() : azureSelect;
  const geminiModel = geminiSelect === CUSTOM ? geminiCustom.trim() : geminiSelect;

  const formBody = useMemo(
    () => ({
      provider,
      azureDeployment,
      geminiModel,
      azureApiKey,
      azureResourceName,
      geminiApiKey,
    }),
    [provider, azureDeployment, geminiModel, azureApiKey, azureResourceName, geminiApiKey],
  );

  const keyWarning = useMemo(() => {
    if (provider === "azure" && (!azureApiKey.trim() || !azureResourceName.trim())) {
      return "Azure is selected, but the API key or resource name is empty.";
    }
    if (provider === "gemini" && !geminiApiKey.trim()) {
      return "Gemini is selected, but the API key is empty.";
    }
    return null;
  }, [provider, azureApiKey, azureResourceName, geminiApiKey]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    if (!azureDeployment || !geminiModel) {
      setError("Pick a preset or enter a custom model id for both Azure and Gemini.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formBody),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok || !data.success) throw new Error(data.error ?? "Could not save settings");
      applyPayload(data);
      setNotice("Saved to Firestore. New audits use these keys within a few seconds — no redeploy.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onTest(which: "azure" | "gemini") {
    setTesting(which);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formBody, provider: which }),
      });
      const data = (await res.json()) as { success?: boolean; model?: string; sample?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Could not reach ${which}.`);
      }
      setTestResult(`${which} ok · ${data.model}${data.sample ? ` · “${data.sample}”` : ""}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(null);
    }
  }

  if (unlocked === null) {
    return <p className="text-sm text-zinc-500">Checking stand desk…</p>;
  }

  if (!unlocked) {
    return (
      <section className="mx-auto max-w-md rounded-[1.75rem] border border-[#ece4ff] bg-white p-8 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#6e3fff]">Stand desk</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-[#212121]">Settings</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Super admin only. Same stand-admin passcode as the leads desk.
        </p>
        <form onSubmit={(e) => void onUnlock(e)} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">
            Passcode
            <input
              type="password"
              autoComplete="current-password"
              className={`${inputClass} mt-1`}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[0.625rem] bg-[#212121] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </section>
    );
  }

  if (role !== "super") {
    return (
      <section className="mx-auto max-w-lg rounded-[1.75rem] border border-[#ece4ff] bg-white p-8">
        <h1 className="font-serif text-2xl font-semibold text-[#212121]">Settings</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Booth AEs can&apos;t change the model. Ask the stand admin (super-admin passcode) to open
          this page.
        </p>
        <Link href="/stand-desk" className="mt-6 inline-block rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700">
          Back to leads
        </Link>
      </section>
    );
  }

  const sourceLabel = payload?.settings?.source === "firestore" ? "Firestore" : "environment defaults";
  const keySource = payload?.settings?.keySource;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6e3fff]">
              Stand desk · Super admin
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#212121]">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Provider, model, and API keys are stored in Firestore. Save, then Test — no Vercel
              redeploy. Super admin only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/stand-desk"
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Leads
            </Link>
            <Link
              href="/stand-desk/events"
              className="rounded-[0.625rem] border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Audit log
            </Link>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-800">{notice}</p> : null}
        {testResult ? <p className="mt-3 text-sm text-emerald-800">{testResult}</p> : null}
      </section>

      <form
        onSubmit={(e) => void onSave(e)}
        className="space-y-5 rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Active engine · currently {sourceLabel}
          {payload?.settings?.updatedAt
            ? ` · saved ${new Date(payload.settings.updatedAt).toLocaleString()}`
            : ""}
        </p>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-zinc-900">Provider</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-4">
            <input
              type="radio"
              name="provider"
              className="mt-1"
              checked={provider === "azure"}
              onChange={() => setProvider("azure")}
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-900">Azure OpenAI</span>
              <span className="mt-1 block text-sm text-zinc-600">
                Org IT sandbox. Uses the Foundry deployment name below.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-4">
            <input
              type="radio"
              name="provider"
              className="mt-1"
              checked={provider === "gemini"}
              onChange={() => setProvider("gemini")}
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-900">Google Gemini</span>
              <span className="mt-1 block text-sm text-zinc-600">Uses the Gemini API key below.</span>
            </span>
          </label>
        </fieldset>

        <label className="block text-sm font-medium text-zinc-700">
          Azure deployment name
          <select
            className={`${inputClass} mt-1`}
            value={azureSelect}
            onChange={(e) => setAzureSelect(e.target.value)}
          >
            {AZURE_DEPLOYMENT_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
        </label>
        {azureSelect === CUSTOM ? (
          <label className="block text-sm font-medium text-zinc-700">
            Custom Azure deployment
            <input
              className={`${inputClass} mt-1`}
              value={azureCustom}
              onChange={(e) => setAzureCustom(e.target.value)}
              placeholder="exact Foundry deployment name"
            />
          </label>
        ) : null}

        <label className="block text-sm font-medium text-zinc-700">
          Gemini model
          <select
            className={`${inputClass} mt-1`}
            value={geminiSelect}
            onChange={(e) => setGeminiSelect(e.target.value)}
          >
            {GEMINI_MODEL_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
        </label>
        {geminiSelect === CUSTOM ? (
          <label className="block text-sm font-medium text-zinc-700">
            Custom Gemini model id
            <input
              className={`${inputClass} mt-1`}
              value={geminiCustom}
              onChange={(e) => setGeminiCustom(e.target.value)}
              placeholder="gemini-…"
            />
          </label>
        ) : null}

        <div className="space-y-4 rounded-2xl border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">API keys</p>
          <p className="text-sm leading-6 text-zinc-600">
            Values shown here are what the audit will use. Empty + Save clears the Firestore copy
            and falls back to Vercel / <code className="rounded bg-zinc-100 px-1">.env.local</code>.
          </p>
          <SecretField
            label="Azure OpenAI API key"
            value={azureApiKey}
            onChange={setAzureApiKey}
            source={keySource?.azureApiKey}
          />
          <label className="block text-sm font-medium text-zinc-700">
            <span className="flex items-center justify-between gap-2">
              <span>Azure resource name</span>
              <span className="text-xs font-normal text-zinc-500">
                {sourceLabelFor(keySource?.azureResourceName)}
              </span>
            </span>
            <input
              className={`${inputClass} mt-1`}
              value={azureResourceName}
              onChange={(e) => setAzureResourceName(e.target.value)}
              placeholder="sitecoreopenai-sandbox-et"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <SecretField
            label="Gemini API key"
            value={geminiApiKey}
            onChange={setGeminiApiKey}
            source={keySource?.geminiApiKey}
            placeholder="AQ.… or AIza…"
          />
        </div>

        {keyWarning ? <p className="text-sm text-amber-800">{keyWarning}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || payload?.firestore === false}
            className="rounded-[0.625rem] bg-[#6e3fff] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            disabled={testing !== null}
            onClick={() => void onTest("azure")}
            className="rounded-[0.625rem] border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-50"
          >
            {testing === "azure" ? "Testing Azure…" : "Test Azure"}
          </button>
          <button
            type="button"
            disabled={testing !== null}
            onClick={() => void onTest("gemini")}
            className="rounded-[0.625rem] border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-50"
          >
            {testing === "gemini" ? "Testing Gemini…" : "Test Gemini"}
          </button>
        </div>
        {payload?.firestore === false ? (
          <p className="text-sm text-red-700">
            Firestore is not configured on this server, so settings cannot be saved. Set{" "}
            <code className="rounded bg-zinc-100 px-1">FIREBASE_SERVICE_ACCOUNT_JSON</code> and{" "}
            <code className="rounded bg-zinc-100 px-1">NEXT_PUBLIC_FIREBASE_PROJECT_ID</code>.
          </p>
        ) : null}
      </form>

      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <h2 className="font-serif text-xl font-semibold text-[#212121]">Create a Gemini API key</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700">
          <li>
            Open{" "}
            <a
              href="https://aistudio.google.com/apikey"
              className="font-semibold text-[#6e3fff] underline"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio → API keys
            </a>
            .
          </li>
          <li>Create a key, paste it in Gemini API key above, Save, then Test Gemini.</li>
        </ol>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Do not commit keys, put them in README, or paste them in Slack. If a key leaks, delete it
          in AI Studio and paste a new one here.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-[#ece4ff] bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(67,0,173,0.35)]">
        <h2 className="font-serif text-xl font-semibold text-[#212121]">Database</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This app uses <strong>Cloud Firestore</strong>
          {payload?.projectId ? (
            <>
              {" "}
              in Firebase project <code className="rounded bg-zinc-100 px-1">{payload.projectId}</code>
            </>
          ) : (
            " (set NEXT_PUBLIC_FIREBASE_PROJECT_ID)"
          )}
          . Writes go through Firebase Admin — the browser never talks to Firestore directly.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-zinc-700">
          <li>
            <code className="rounded bg-zinc-100 px-1">tmf_scrunch_settings</code> /{" "}
            <code className="rounded bg-zinc-100 px-1">app</code> — provider, model, and API keys
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1">tmf_scrunch_leads</code> — booth companies
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1">tmf_scrunch_reports</code> — visibility briefs + PDFs
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1">tmf_scrunch_audit_events</code> — every generate attempt
          </li>
        </ul>
      </section>
    </div>
  );
}
