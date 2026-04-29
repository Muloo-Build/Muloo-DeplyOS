import AppShell from "../components/AppShell";
import { StandaloneProductsCatalog } from "../components/ProductsCatalog";

export default function ProductsPage() {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.32em] text-[#49cde1]">
            Sales
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Product catalogue
          </h1>
          <p className="text-sm text-text-secondary">
            One-off services, retainers and add-ons that can be pulled into
            quotes. Edit prices, billing models and descriptions in one place.
          </p>
        </header>
        <section className="rounded-2xl border border-white/10 bg-background-card p-2">
          <StandaloneProductsCatalog />
        </section>
      </div>
    </AppShell>
  );
}
