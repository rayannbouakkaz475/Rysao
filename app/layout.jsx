import "./globals.css";

export const metadata = {
  title: "Rysao — Pronostics Football IA",
  description:
    "Pronostics football gratuits, analysés par une IA combinant modèle statistique et Claude.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
