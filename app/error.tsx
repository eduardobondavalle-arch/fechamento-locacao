"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-card">
        <AlertTriangle className="mx-auto text-rose-600" size={32} />
        <h1 className="mt-4 text-xl font-bold text-navy-900">
          Não foi possível abrir o quadro
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Ocorreu um erro inesperado. Seus dados locais permanecem preservados.
        </p>
        <button type="button" onClick={reset} className="button-primary mt-5">
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
