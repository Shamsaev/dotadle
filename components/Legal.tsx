import Link from "next/link";

// Общий каркас для страниц «Условия использования» и «Политика конфиденциальности»
export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
export const UPDATED = "22.11.2026";

export function LegalPage({ title, en, ru }: { title: string; en: React.ReactNode; ru: React.ReactNode }) {
  return (
    <main className="stage legal">
      <p><Link href="/">← Dotadle</Link></p>
      <h1>{title}</h1>
      <p className="sub">Last updated / Обновлено: {UPDATED}</p>
      <nav className="legal-nav"><a href="#en">English</a><a href="#ru">Русский</a></nav>
      <section id="en">{en}</section>
      <hr />
      <section id="ru">{ru}</section>
    </main>
  );
}

export function Contact({ lang }: { lang: "en" | "ru" }) {
  if (CONTACT) return <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
  return <span>{lang === "en" ? "the Dotadle Discord app page" : "страницу приложения Dotadle в Discord"}</span>;
}
