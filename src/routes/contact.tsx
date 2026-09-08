import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Docly — Support and partnerships" },
      {
        name: "description",
        content: "Get in touch with the Docly team about support, feedback, billing or partnerships.",
      },
      { property: "og:title", content: "Contact Docly" },
      { property: "og:description", content: "Support, feedback and partnership enquiries." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the team"
        description="Questions about a tool, an account or a partnership? Send us a note and we'll get back to you."
      />
      <div className="container-page grid gap-8 py-14 lg:grid-cols-2 lg:max-w-4xl">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <Field label="Name" type="text" placeholder="Your name" />
          <Field label="Email" type="email" placeholder="you@company.com" />
          <div>
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="message"
              rows={5}
              placeholder="How can we help?"
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Send message
          </button>
          <p className="text-xs text-muted-foreground">
            Message delivery is not connected yet in this preview release.
          </p>
        </form>
        <div className="space-y-4">
          {[
            { icon: Mail, title: "Email", copy: "support@docly.app — replies within one business day." },
            {
              icon: MessageSquare,
              title: "Product feedback",
              copy: "Tell us which tool you need next and we'll prioritise it.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <item.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Field({ label, type, placeholder }: { label: string; type: string; placeholder: string }) {
  const id = label.toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}
