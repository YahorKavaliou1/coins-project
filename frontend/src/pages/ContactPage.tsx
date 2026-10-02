import { useState, type ReactNode } from "react";
import { ChevronDown, Mail, Phone, Send } from "lucide-react";
import { company, contact } from "../content/site";
import { inputClass, labelClass } from "../components/formStyles";

export function ContactPage() {
  return (
    <div className="flex flex-col gap-10 pb-10">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Contact us</h1>
        <p className="text-gray-600 leading-relaxed">{contact.intro}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <InfoCard icon={<Phone className="w-5 h-5" />} title="Phone">
            <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className="hover:text-accent">
              {company.phone}
            </a>
          </InfoCard>
          <InfoCard icon={<Mail className="w-5 h-5" />} title="Email">
            <a href={`mailto:${company.email}`} className="hover:text-accent break-all">
              {company.email}
            </a>
            <div className="text-xs text-gray-500 mt-1">{company.responseTime}</div>
          </InfoCard>
        </div>

        <ContactForm />
      </div>

      <section className="max-w-3xl">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
        <div className="flex flex-col gap-2">
          {contact.faq.map((item) => (
            <details key={item.q} className="group bg-white border border-gray-200 rounded-md">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 py-4 font-semibold text-gray-900">
                {item.q}
                <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">{icon}</div>
      <div className="text-sm text-gray-700 leading-relaxed min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * There is no message endpoint on the server yet, so the form opens the visitor's email app
 * with the message filled in, addressed to company.email.
 */
function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(contact.subjects[0]);
  const [message, setMessage] = useState("");

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = `${message}\n\n— ${name}${email ? ` <${email}>` : ""}`;
    const params = new URLSearchParams({ subject, body });
    // URLSearchParams encodes spaces as "+", which email apps show literally.
    window.location.href = `mailto:${company.email}?${params.toString().replace(/\+/g, "%20")}`;
  }

  return (
    <form onSubmit={send} className="lg:col-span-3 bg-white border border-gray-200 rounded-md p-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-gray-900">Send us a message</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className={labelClass}>
            Your name
          </label>
          <input
            id="contact-name"
            required
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-subject" className={labelClass}>
          Subject
        </label>
        <select id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
          {contact.subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="contact-message"
          required
          rows={6}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us which coin or order this is about, or describe the coins you'd like to sell."
          className={`${inputClass} resize-y`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Opens your email app with the message ready to send.</p>
        <button
          type="submit"
          className="bg-accent hover:bg-accent-dark text-white font-bold uppercase tracking-wide text-sm rounded-sm px-6 py-3 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send message
        </button>
      </div>
    </form>
  );
}
