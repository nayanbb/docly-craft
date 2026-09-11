import { Link } from "@tanstack/react-router";
import { Github, Linkedin, Twitter } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "PDF Tools", to: "/pdf-tools" },
      { label: "Image Tools", to: "/image-tools" },
      { label: "AI Tools", to: "/ai-tools" },
      { label: "Pricing", to: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Dashboard", to: "/dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Everything you need to work with PDFs, images and documents — in one calm, fast
            workspace.
          </p>
          <div className="mt-5 flex gap-2">
            {[Twitter, Linkedin, Github].map((Icon, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground"
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {column.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Docly. All rights reserved.</p>
          <p>Built for teams that move documents all day.</p>
        </div>
      </div>
    </footer>
  );
}
