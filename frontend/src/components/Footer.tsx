import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import { company } from "../content/site";
import { mainNav } from "./navigation";

const headingClass = "text-xs font-semibold uppercase tracking-widest text-gold mb-3";
const linkClass = "text-sm text-gray-300 hover:text-white transition-colors";

/** In the colours of the logo and the home page emblem: logo maroon with muted gold. */
export function Footer() {
  return (
    <footer className="bg-logo text-white mt-12">
      <div className="max-w-6xl mx-auto px-5 py-10 max-md:px-4 max-md:py-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 text-lg font-bold hover:text-gray-200">
            <img src="/logo.png" alt="" width={40} height={40} className="w-10 h-10" />
            {company.name}
          </Link>
          <p className="text-sm text-gray-300 leading-relaxed mt-3 max-w-xs">{company.tagline}</p>
        </div>

        <nav aria-label="Footer">
          <h2 className={headingClass}>Explore</h2>
          <ul className="flex flex-col gap-2">
            {mainNav.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={headingClass}>Get in touch</h2>
          <ul className="flex flex-col gap-2">
            <li>
              <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} className={`${linkClass} inline-flex items-center gap-2`}>
                <Phone className="w-4 h-4 text-gold" />
                {company.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${company.email}`} className={`${linkClass} inline-flex items-center gap-2 break-all`}>
                <Mail className="w-4 h-4 text-gold shrink-0" />
                {company.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gold/25">
        <div className="max-w-6xl mx-auto px-5 py-4 max-md:px-4 flex flex-wrap justify-between gap-2 text-xs text-gray-400">
          <span>
            © {new Date().getFullYear()} {company.name}. All rights reserved.
          </span>
          <span>Est. {company.foundedYear}</span>
        </div>
      </div>
    </footer>
  );
}
