import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Docly — Support and partnerships" },
      {
        name: "description",
        content:
          "Get in touch with the Docly team about support, feedback, billing or partnerships.",
      },
      { property: "og:title", content: "Contact Docly" },
      { property: "og:description", content: "Support, feedback and partnership enquiries." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // Invisible honeypot field
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();

    // Client-side quick checks before hitting API
    if (!cleanName) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (cleanName.length < 2) {
      setErrorMessage("Name must be at least 2 characters long.");
      return;
    }
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!cleanMessage) {
      setErrorMessage("Please enter your message.");
      return;
    }
    if (cleanMessage.length < 10) {
      setErrorMessage("Please enter a slightly more detailed message (minimum 10 characters).");
      return;
    }
    if (cleanMessage.length > 5000) {
      setErrorMessage("Your message is too long (maximum 5000 characters).");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          message: cleanMessage,
          hp,
        }),
      });

      const data = await response.json().catch(() => null) as {
        success?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        const errorText =
          data?.error ||
          "We couldn't send your message right now. Please try again later or email us directly at nayanbhatkhade8530@gmail.com.";
        setErrorMessage(errorText);
        toast.error("Could not send message");
        return;
      }

      // Success
      setSuccess(true);
      toast.success("Message sent successfully!");
      // Reset form fields on success
      setName("");
      setEmail("");
      setMessage("");
      setHp("");
    } catch {
      setErrorMessage(
        "We couldn't send your message right now. Please try again later or email us directly at nayanbhatkhade8530@gmail.com."
      );
      toast.error("Network error. Could not send message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the team"
        description="Questions about a tool, an account or a partnership? Send us a note and we'll get back to you."
      />
      <div className="container-page grid gap-8 py-14 lg:grid-cols-2 lg:max-w-4xl">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          {/* Invisible honeypot field to trap spambots */}
          <div aria-hidden="true" style={{ display: "none", position: "absolute", left: "-9999px" }}>
            <label htmlFor="company_hp">Do not fill this field</label>
            <input
              id="company_hp"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
            />
          </div>

          {/* Success Banner */}
          {success && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-foreground">Message sent successfully.</p>
                <p className="text-muted-foreground leading-relaxed">
                  We've received your message and will get back to you soon.
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p className="font-semibold text-foreground">Unable to send message</p>
                <p className="text-muted-foreground mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="contact-name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="contact-name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="contact-message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="contact-message"
              rows={5}
              placeholder="How can we help?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending message...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send message
              </>
            )}
          </button>
        </form>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">Email</h2>
            <p className="mt-1 text-sm font-medium text-foreground">
              <a
                href="mailto:nayanbhatkhade8530@gmail.com"
                className="hover:text-primary transition-colors underline-offset-2 hover:underline break-all"
              >
                nayanbhatkhade8530@gmail.com
              </a>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Replies within one business day.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">Product feedback</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us which tool you need next and we'll prioritise it.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
