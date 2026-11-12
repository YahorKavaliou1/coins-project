/**
 * Texts and contact details of the Home and Contact pages.
 *
 * The phone number and email are real. The founding year and the "About" story are
 * placeholders: replace them before going live.
 *
 * The promises here (authenticity, returns, shipping, payment) must match the legal pages in
 * content/legal.ts, which describe how the site actually works: we are the only seller, our
 * staff list the coins and handle the orders, the buyer pays by the payment details sent with
 * the order and we ship once the payment has arrived.
 */

export const company = {
  name: "Coins Catalog",
  tagline: "Collector coins and bullion, authenticated and graded",
  foundedYear: 2012,
  email: "agaro.coins@gmail.com",
  /** As displayed; the tel: link uses the digits only. */
  phone: "+34 640 325 691",
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
    /** Set around the logo on the home page banner, like the legend of a coin. */
    emblemLegend: `${company.name} • Est. ${company.foundedYear} • Authenticity guaranteed •`,
  },
  features: [
    {
      icon: "shield",
      title: "Authenticity guaranteed",
      text: "Every coin is checked by us before it is listed. If a coin we sold proves not genuine, we take it back and refund it in full.",
    },
    {
      icon: "award",
      title: "Honest grading",
      text: "Grades are our own careful assessment, and the photos show the actual coin you will receive.",
    },
    {
      icon: "truck",
      title: "Clear shipping",
      text: "Choose a shipping method in your cart and see its price before you order. We ship as soon as your payment arrives.",
    },
    {
      icon: "rotate",
      title: "14-day returns",
      text: "Changed your mind? Return a coin in its original holder within 14 days of delivery for a refund. Bullion priced by its metal is excluded.",
    },
  ],
  steps: [
    { title: "Find your coin", text: "Filter the shop by country, metal, grade, category or labels, or search by name and year." },
    { title: "Check the details", text: "Study the photos, weight, diameter, mintage and catalogue number of every coin." },
    { title: "Place your order", text: "Add coins to your cart, choose the delivery address and shipping, and place the order." },
    { title: "Pay and receive", text: "Pay by the details we email you and mark the order as paid. We ship it and send you the tracking code." },
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
    "Questions about a coin, an order or selling your collection? Write to us or call — " +
    "we're happy to help.",
  subjects: ["Question about a coin", "My order", "Selling coins", "Other"],
  faq: [
    {
      q: "How do I pay?",
      a: "After you place the order we email you our payment details; you also find them in My purchases. Pay, then mark the order as paid there — we ship once the payment arrives.",
    },
    {
      q: "How much is shipping and how long does it take?",
      a: "The shipping methods and their prices are shown in your cart before you order. Delivery time depends on the method and the destination — ask us if you need an estimate.",
    },
    {
      q: "Can I return a coin?",
      a: "Yes, within 14 days of delivery, in its original holder: tell us by email and we refund it, shipping included. Bullion priced by its metal content cannot be returned.",
    },
    {
      q: "Do you buy coins?",
      a: "We do — single coins as well as whole collections. Send us photos and a short description for a free valuation.",
    },
    {
      q: "What if my coin arrives damaged?",
      a: "Photograph the parcel and the coin, keep the packaging and contact us as soon as possible — we'll put it right.",
    },
  ],
};
