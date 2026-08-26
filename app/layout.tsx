import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BoardProvider } from "@/components/providers/board-provider";
import { BackgroundGlow } from "@/components/theme/background-glow";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fechamento de Locação",
  description: "Gestão operacional de fechamentos de locação",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fechamento-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <BackgroundGlow />
          <div className="app-content-layer">
            <BoardProvider>{children}</BoardProvider>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
