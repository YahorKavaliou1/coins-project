/**
 * Texts and contact details of the Home and Contact pages.
 *
 * PLACEHOLDER CONTENT: everything below is invented so the pages look finished. Replace it
 * with the real business details before going live. The phone number (555-01xx) and the
 * ".example" email domain are reserved for fiction and reach no one.
 */

export const company = {
  name: "Coins Catalog",
  tagline: "Collector coins and bullion, authenticated and graded",
  foundedYear: 2012,
  email: "info@coins-catalog.example",
  phone: "+1 (555) 014-2398",
  address: {
    line1: "48 Mint Street, Suite 3",
    line2: "Springfield, IL 62701",
    country: "United States",
  },
  /** Opening hours of the showroom, in local time. */
  hours: [
    { days: "Monday – Friday", time: "10:00 – 18:00" },
    { days: "Saturday", time: "11:00 – 16:00" },
    { days: "Sunday", time: "Closed" },
  ],
  responseTime: "We reply to every message within one business day.",
};

export const home = {
  hero: {
    eyebrow: `Numismatic dealers since ${company.foundedYear}`,
    title: "Coins with a story, from people who know them",
    text:
      "Ancient silver, modern commemoratives and investment bullion — every piece in our " +
      "catalogue is inspected by hand, photographed as it is and described honestly.",
    primaryCta: "Browse the shop",
    secondaryCta: "Contact us",
  },
  features: [
    {
      icon: "shield",
      title: "Authenticity guaranteed",
      text: "Each coin is checked by our specialists. If a coin ever proves not genuine, you get a full refund — no time limit.",
    },
    {
      icon: "award",
      title: "Honest grading",
      text: "We grade conservatively and photograph both sides of every lot, so what you see is what arrives.",
    },
    {
      icon: "truck",
      title: "Insured shipping",
      text: "Orders ship within two business days in discreet, fully insured packaging with tracking.",
    },
    {
      icon: "rotate",
      title: "14-day returns",
      text: "Changed your mind? Send the coin back in its original holder within 14 days for a refund.",
    },
  ],
  steps: [
    { title: "Find your coin", text: "Filter the shop by country, metal, grade or category, or search by name and year." },
    { title: "Check the details", text: "Study the photos, weight, diameter, mintage and catalogue number of every lot." },
    { title: "Order securely", text: "Add coins to your cart and check out — we confirm every order by email." },
    { title: "Receive it insured", text: "Your coins travel tracked and insured, packed to arrive exactly as pictured." },
  ],
  about: {
    title: "A small team of collectors",
    paragraphs: [
      `${company.name} started in ${company.foundedYear} as a table at local coin fairs. Today we ` +
        "offer several thousand coins from over a hundred countries, but we still work the way " +
        "we started: every coin passes through the hands of a collector before it is listed.",
      "We buy collections, single rarities and bullion. If you have coins to sell, get in touch — " +
        "valuations are free and without obligation.",
    ],
  },
  sellCta: {
    title: "Selling a collection?",
    text: "Tell us what you have and we'll come back with a free, no-obligation valuation.",
    button: "Get a valuation",
  },
};

export const contact = {
  intro:
    "Questions about a coin, an order or selling your collection? Write to us, call, or visit " +
    "the showroom — we're happy to help.",
  subjects: ["Question about a coin", "My order", "Selling coins", "Other"],
  faq: [
    {
      q: "Can I see a coin in person before buying?",
      a: "Yes. Let us know which lots you're interested in and book a visit to the showroom during opening hours.",
    },
    {
      q: "How long does delivery take?",
      a: "We ship within two business days. Domestic orders usually arrive in 2–4 days, international ones in 5–10.",
    },
    {
      q: "Do you buy coins?",
      a: "We do — single coins as well as whole collections. Send us photos and a short description for a free valuation.",
    },
    {
      q: "What if my coin arrives damaged?",
      a: "Every shipment is insured. Photograph the parcel and the coin, contact us within 48 hours and we'll put it right.",
    },
  ],
};
