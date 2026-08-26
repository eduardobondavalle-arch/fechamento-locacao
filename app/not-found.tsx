import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="text-center">
        <p className="text-5xl font-black text-navy-900">404</p>
        <p className="mt-2 text-sm text-slate-500">Página não encontrada.</p>
        <Link href="/" className="button-primary mt-5">
          Voltar ao quadro
        </Link>
      </div>
    </main>
  );
}
