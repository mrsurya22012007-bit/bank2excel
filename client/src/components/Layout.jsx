import { NavLink, Outlet } from "react-router-dom";

const profiles = [
  "JPMorgan Chase",
  "Bank of America",
  "Wells Fargo",
  "Citibank NA",
  "Silicon Valley Bank",
  "Mercury Technologies",
  "Barclays Corporate",
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-ink text-champagne">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3 pr-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-champagne/40">
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true">
                <path d="M8 1L15 4.5V9C15 14 11.5 17.8 8 19C4.5 17.8 1 14 1 9V4.5L8 1Z" stroke="#F8E7C9" strokeWidth="1.4" />
              </svg>
            </div>
            <div>
              <p className="font-serif text-lg italic leading-none">Bank2Excel</p>
              <p className="mt-1 text-[10px] tracking-[0.18em] text-champagne/70">AUDIT LEDGER PARSER</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded-full border border-champagne/30 px-3 py-1 text-[11px]">
              Engine: Python Flask / pdfplumber
            </span>
            <span className="rounded-full bg-champagne px-3 py-1 text-[11px] font-semibold text-ink">
              In-memory Processing
            </span>
          </div>

          <nav className="ml-auto flex items-center gap-6 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `border-b-2 pb-1 ${isActive ? "border-champagne text-champagne" : "border-transparent text-champagne/70"}`
              }
            >
              Convert Statement
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `border-b-2 pb-1 ${isActive ? "border-champagne text-champagne" : "border-transparent text-champagne/70"}`
              }
            >
              Batch History
            </NavLink>
          </nav>

          <div className="hidden items-center gap-2 text-[11px] lg:flex">
            <span className="text-champagne/70">SECURE ENGINE SESSION</span>
            <span className="rounded-full border border-champagne/40 px-2 py-0.5">v1.0 Ready</span>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-1 text-center text-[10px] tracking-wide text-champagne/60 lg:px-6">
          LOCAL WORKSTATION • PDF EXTRACTION • BALANCE VERIFICATION • EXCEL EXPORT • PERSISTENT BATCH HISTORY
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink/10 bg-ink text-champagne/80">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-6 text-sm lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <p>Statements are parsed by the local Python extractor. Batch history is stored in your MongoDB database.</p>
          <div className="flex flex-wrap gap-3">
            <span>Privacy</span>
            <span>•</span>
            <span>Security Protocol</span>
            <span>•</span>
            <span>Documentation</span>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 pb-6 text-xs text-champagne/50 lg:flex-row lg:justify-between lg:px-6">
          <p>© 2026 Bank2Excel — React, Express, Python Flask, pdfplumber & ExcelJS</p>
          <p>Exactly two pages: Convert Statement and Batch History</p>
        </div>
      </footer>
    </div>
  );
}

export { profiles };
