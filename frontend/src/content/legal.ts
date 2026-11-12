/**
 * Legal pages of the site (footer → Legal), written for how the site actually works:
 * an online shop with a single seller — the site owner. Accounts with the "seller" or "admin"
 * role belong to the owner's staff, who list the coins and handle the orders on the owner's
 * behalf; customers cannot sell. A buyer orders, pays by the payment details sent with the
 * order (outside the site), marks the order as paid, and the staff member ships it.
 *
 * Text format: a string is a paragraph, an array of strings is a bulleted list.
 * "[text](/path)" inside a string becomes a link ("mailto:" and "https:" links work too).
 *
 * Before going live: fill in `operator` with the real details of the site owner (required in
 * Spain by Ley 34/2002 LSSI-CE, art. 10) and have the texts reviewed by a lawyer.
 * When something here changes, update `updated` below. Keep the promises on the Home and
 * Contact pages (content/site.ts) in line with these texts.
 */
import { company } from "./site";

export const operator = {
  /** Full legal name of the owner: a company (e.g. "Example Coins, S.L.") or a self-employed person. */
  legalName: "[Legal name of the site owner]",
  /** NIF / CIF (or NIE). */
  taxId: "[NIF / CIF]",
  address: "[Street, number, postal code, city], Spain",
  /** Mercantile Registry entry for a company; remove the line for a self-employed person. */
  registry: "[Registro Mercantil de ..., Tomo ..., Folio ..., Hoja ...]",
  email: company.email,
  phone: company.phone,
  /** Courts named for disputes with business customers. */
  city: "[City]",
};

const updated = "November 2026";
const emailLink = `[${operator.email}](mailto:${operator.email})`;
const contactLine = `${operator.legalName}, ${operator.address}. Email: ${emailLink}, phone: ${operator.phone}.`;

export type LegalBlock = string | string[];

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  path: string;
  title: string;
  /** Shown in the footer. */
  navLabel: string;
  subtitle: string;
  sections: LegalSection[];
}

export const terms: LegalDocument = {
  path: "/terms",
  title: "Terms of Service",
  navLabel: "Terms of Service",
  subtitle: `Last updated: ${updated} · Governing law: Spain (EU)`,
  sections: [
    {
      title: "About us and these terms",
      blocks: [
        `${company.name} is the online coin shop of ${operator.legalName} ("we", "us"). All coins on the site are sold by us. Our identification details are given in the [Legal Notice](/legal-notice).`,
        "These Terms govern the use of the site and every purchase made on it. By creating an account or placing an order you accept these Terms and the [Shipping Policy](/shipping), and confirm you have read the [Privacy Policy](/privacy).",
      ],
    },
    {
      title: "Who sells on the site",
      blocks: [
        "Coins are listed and orders are handled only by our staff. Customers cannot list or sell coins on the site.",
        "Your order may show the name and contacts of the staff member handling it. Whoever handles it, the contract of sale is always made with us, and we are responsible for it.",
      ],
    },
    {
      title: "Your account",
      blocks: [
        [
          "To place orders you need an account. You must be at least 18 years old.",
          "Give a real email address and keep your details accurate. Confirm your email address with the link we send after registration: accounts not confirmed within 7 days are deleted automatically.",
          "Keep your password secret: you are responsible for activity on your account. After several wrong password attempts the account is locked for a while; resetting the password lifts the lock.",
        ],
        "We may block an account in case of fraud or attempted fraud, repeated non-payment of orders, false information, misuse of the site or breach of these Terms. You are informed by email when your account is blocked or unblocked.",
      ],
    },
    {
      title: "Coins, descriptions and prices",
      blocks: [
        [
          "We describe every coin in good faith: country, year, denomination, metal, weight and other details. Photos show the actual coin offered.",
          "The grade is our own assessment. Grading is a matter of judgment and may differ slightly between experts.",
          "Prices are final prices in euros and include any applicable taxes. Shipping is added at checkout, as shown in the cart.",
          "Each coin is unique: once sold, it is no longer available. We may correct errors in a description or a price; if an error affects an order already placed, we contact you and you may cancel the order.",
        ],
      ],
    },
    {
      title: "Placing an order",
      blocks: [
        [
          "Adding a coin to your cart does not reserve it: until you place the order, another customer may buy it first.",
          "At checkout you choose a delivery address and a shipping method; the total, shipping included, is shown before you confirm.",
          "If a price, a shipping cost or the availability of a coin changed while it was in your cart, the order is not placed and you are asked to review your cart.",
          "Coins handled by different members of our staff become separate orders, each paid, shipped and tracked on its own. The cart shows this before you confirm.",
          "Placing the order is a purchase with an obligation to pay. The coins are reserved for you and removed from the shop, and we confirm the order by email with the payment details.",
        ],
      ],
    },
    {
      title: "Payment",
      blocks: [
        "Payment is made outside the site, using the payment details in the order confirmation email and on the [My purchases](/purchases) page. We do not take card payments on the site.",
        [
          "Once you have paid, mark the order as paid in My purchases. We check that the payment has arrived and ship the order.",
          "If our payment details change, we email you the new ones for any unpaid order. Always pay using the details shown in My purchases, and be careful with payment instructions that do not come from us.",
          "Any bank fees charged by your own bank are yours.",
        ],
      ],
    },
    {
      title: "Order status and cancellation",
      blocks: [
        "An order goes through three statuses: Awaiting payment → Paid → Shipped. You receive an email at each step; when the order is shipped, the email includes the tracking code if the shipping method has one. Shipping is described in the [Shipping Policy](/shipping).",
        "Placed orders cannot be cancelled on the site. To cancel an order before it is shipped, contact us; any amount already paid is refunded. After delivery, the right of withdrawal below applies.",
      ],
    },
    {
      title: "Right of withdrawal (14 days)",
      blocks: [
        "If you buy as a consumer, you may withdraw from the purchase within 14 days of the day you, or someone you name, receive the coins, without giving any reason (Real Decreto Legislativo 1/2007, arts. 102–108).",
        [
          `To withdraw, tell us before the 14 days end, for example by email to ${emailLink}. You may use the model form below, but it is not required.`,
          "Send the coins back to us without undue delay and no later than 14 days after telling us, in the condition and holder in which you received them. You pay the cost of returning them.",
          "We refund all payments received for the returned coins, including the standard shipping cost, within 14 days of receiving your notice, by the same means you paid, unless you agree otherwise. We may wait to refund until we have received the coins back.",
          "You are responsible for any loss in value caused by handling the coins beyond what is needed to examine them (for example, cleaning a coin or removing it from a sealed holder).",
        ],
        "The right of withdrawal does not apply to coins whose price depends on fluctuations of the precious-metals market that we cannot control, such as bullion coins priced by their metal content (art. 103.c).",
        "Model withdrawal form: \"To " +
          `${operator.legalName}, ${operator.address}, ${operator.email}: ` +
          "I hereby give notice that I withdraw from my contract of sale of the following goods: [coins, order number] — ordered on [date] / received on [date] — name — address — date — signature (only if sent on paper).\"",
      ],
    },
    {
      title: "Guarantee and authenticity",
      blocks: [
        "Every coin we sell is guaranteed to be genuine and to match its description. If you buy as a consumer, you also have the legal guarantee of conformity of Spanish consumer law: if a coin does not conform to the contract, you may ask for it to be put right, for a price reduction or for a refund (Real Decreto Legislativo 1/2007, arts. 114 and following).",
        "If a coin we sold proves not to be genuine, we take it back and refund the price you paid in full. Differences of opinion about a grade alone are not a lack of conformity.",
        `To make a claim, write to ${emailLink} with the order number and, where possible, photos.`,
      ],
    },
    {
      title: "Acceptable use",
      blocks: [
        "You may not place orders you do not intend to pay, use the site to defraud us or others, try to access other users' accounts or data, interfere with the site's operation, bypass its security checks, or use automated means to register accounts or overload the site.",
      ],
    },
    {
      title: "Intellectual property",
      blocks: [
        "The site's design, logo, texts, coin photos and descriptions and its software belong to us or our licensors. They may not be copied or reused without our written permission.",
      ],
    },
    {
      title: "Liability",
      blocks: [
        "We aim to keep the site available and its information accurate but cannot guarantee uninterrupted operation. Nothing in these Terms limits our liability where the law does not allow it, nor your rights as a consumer.",
      ],
    },
    {
      title: "Changes to these terms",
      blocks: [
        "We may update these Terms. The date at the top shows the latest version. Orders are governed by the Terms in force when they were placed.",
      ],
    },
    {
      title: "Governing law and disputes",
      blocks: [
        "These Terms are governed by Spanish law. If you are a consumer, you may bring proceedings before the courts of your place of residence, and you keep the protection of the mandatory rules of the country where you live.",
        `For customers acting as businesses, disputes are submitted to the courts of ${operator.city}, Spain.`,
        "Before going to court, please contact us: we will try to resolve the matter amicably.",
      ],
    },
    {
      title: "Contact",
      blocks: [contactLine, "You can also use our [contact page](/contact)."],
    },
  ],
};

export const shipping: LegalDocument = {
  path: "/shipping",
  title: "Shipping Policy",
  navLabel: "Shipping Policy",
  subtitle: `Last updated: ${updated}`,
  sections: [
    {
      title: "Shipping methods and costs",
      blocks: [
        [
          "The shipping methods available for your order, each with its fixed price in euros, are shown in your cart. You choose one before placing the order, and its price is added to the order total.",
          "If no shipping method is offered for an order, shipping is \"arranged with us\": its cost is not included in the order total. Contact us to agree on the method and cost before you pay.",
          "If shipping methods or prices change while coins are in your cart, you are asked to review your choice.",
          "Coins in separate orders (see the [Terms of Service](/terms)) are shipped separately, each with its own shipping cost.",
        ],
      ],
    },
    {
      title: "Delivery address",
      blocks: [
        [
          "At checkout you choose one of your saved addresses or enter a new one. A phone number is optional but helps couriers deliver.",
          "The address is saved with the order. Later changes to your saved addresses do not change orders already placed.",
          "To correct the address of a placed order, contact us before it is shipped.",
        ],
      ],
    },
    {
      title: "Dispatch and tracking",
      blocks: [
        [
          "We ship the order once your payment has reached us.",
          "When the order is shipped, you receive an email with the tracking code if the shipping method has one. You can see the status and tracking code in [My purchases](/purchases).",
          "If we correct the tracking code later, you are notified by email again.",
        ],
      ],
    },
    {
      title: "Delivery times",
      blocks: [
        "Delivery times depend on the shipping method, the destination and the carrier. Ask us if you need an estimate before ordering. We are not responsible for delays caused by carriers or customs, but if your order does not arrive, contact us: see below.",
      ],
    },
    {
      title: "Packaging",
      blocks: [
        "We pack coins securely, in the holders or capsules they were listed in, so that they arrive in the condition described. Whether a shipment is insured, and up to what value, depends on the shipping method chosen; ask us if you need more cover.",
      ],
    },
    {
      title: "Customs, duties and taxes",
      blocks: [
        "Orders shipped outside the European Union may be subject to import duties, taxes and customs fees in the destination country. These are paid by the recipient and are not included in the order total. We declare the real value and content of every shipment on customs forms. Please make sure the coins may be imported into your country.",
      ],
    },
    {
      title: "Damaged, lost or incorrect parcels",
      blocks: [
        [
          "If you buy as a consumer, the coins travel at our risk: the risk passes to you only when you, or someone you name, receive them.",
          "On delivery, check the parcel. If it is damaged, note it with the carrier if possible and photograph the parcel and its content.",
          "Report any damage, missing coin or wrong coin to us as soon as possible, and keep the packaging until the matter is resolved: the carrier may need to inspect it.",
          "If a parcel is lost, we make the claim to the carrier and send the coins again or refund you.",
        ],
      ],
    },
    {
      title: "Contact",
      blocks: [`For any question about shipping: ${contactLine} You can also use our [contact page](/contact).`],
    },
  ],
};

export const privacy: LegalDocument = {
  path: "/privacy",
  title: "Privacy Policy",
  navLabel: "Privacy Policy",
  subtitle: `Last updated: ${updated} · GDPR (EU 2016/679) and LOPDGDD (Ley Orgánica 3/2018)`,
  sections: [
    {
      title: "Data controller",
      blocks: [
        `${operator.legalName}, NIF ${operator.taxId}, ${operator.address}. Email: ${emailLink}, phone: ${operator.phone}.`,
        "This policy explains which personal data of our customers and visitors the site processes, why, and what rights you have.",
      ],
    },
    {
      title: "Data we process",
      blocks: [
        [
          "Account data: email address, name, password (stored only as a hash, never readable), email confirmation status, registration date.",
          "Security data: wrong-password attempts and temporary account locks, account blocks and the actions our administrators take on accounts.",
          "Delivery addresses: recipient name, phone (optional), country, city, postal code and street address.",
          "Order data: the coins ordered, prices, shipping method and cost, the delivery address at the time of the order, order status and dates, tracking code.",
          "Cart and favourites: the coins you added.",
          "Emails we send you: the service emails listed below are stored while waiting to be sent and after.",
          "Messages you send us by email or phone, including those written with the form on our contact page (it opens your own email app; nothing is sent through the site).",
          "Technical data: IP address and browser data, used to limit repeated requests, for the anti-bot check on some forms and in the server logs of our hosting provider.",
        ],
        "We do not process payment card data: payments are made outside the site.",
      ],
    },
    {
      title: "Purposes and legal bases",
      blocks: [
        [
          "Creating and managing your account, handling and delivering your orders, and sending service emails — performance of the contract (art. 6.1.b GDPR).",
          "Service emails: email confirmation, password reset and password change, account blocked, unblocked or locked, order confirmation with payment details, order paid, order shipped, changes to the payment details of an unpaid order.",
          "Account security, preventing fraud and abuse, protecting the site against bots (CAPTCHA) and excess requests — our legitimate interest (art. 6.1.f GDPR) in keeping the site and its users safe.",
          "Answering your messages — your request and our legitimate interest.",
          "Keeping order records and meeting legal obligations, including tax and accounting obligations and requests from authorities — legal obligation (art. 6.1.c GDPR).",
        ],
        "We do not send newsletters or advertising, do not create marketing profiles and do not make automated decisions with legal effects. The data marked as required in the forms is needed to create the account or deliver the order.",
      ],
    },
    {
      title: "Who sees your data",
      blocks: [
        [
          "Our staff, as far as needed to handle your orders and run the site.",
          "The carrier delivering your order: name, delivery address and, if given, phone.",
          "Service providers acting on our behalf, under data processing agreements: application hosting (Render), database (Neon, servers in Frankfurt, Germany), photo storage, sending of emails (Brevo) and the anti-bot check on the registration, password-reset and confirmation-email forms (Cloudflare Turnstile).",
          "Public authorities, when the law requires it.",
        ],
        "We do not sell or rent personal data.",
      ],
    },
    {
      title: "International transfers",
      blocks: [
        "We store data in the European Union. Some providers (Render, Neon, Cloudflare) are US companies that may access data from outside the European Economic Area. Such transfers are covered by the EU–US Data Privacy Framework or by the European Commission's Standard Contractual Clauses.",
      ],
    },
    {
      title: "How long we keep data",
      blocks: [
        [
          "Accounts whose email is not confirmed: deleted automatically after 7 days.",
          "Account data, addresses, cart and favourites: while the account exists. You can delete addresses and remove coins from your cart and favourites at any time.",
          "Orders: kept after an account is closed, for as long as needed for possible claims and legal obligations (up to 6 years, Spanish Commercial Code, art. 30).",
          "Messages: as long as needed to answer them and handle the matter.",
          "Server logs: for the limited period set by the hosting provider.",
        ],
      ],
    },
    {
      title: "Your rights",
      blocks: [
        "You may request access to your data, its rectification or erasure, the restriction of its processing, data portability, and object to processing based on legitimate interest. You can change your name, addresses and password yourself in [Account settings](/account).",
        `To exercise your rights, or to close your account, write to ${emailLink} from the email address of your account. We answer within one month.`,
        "If you think your data is processed unlawfully, you may file a complaint with the Spanish Data Protection Agency (Agencia Española de Protección de Datos, [www.aepd.es](https://www.aepd.es)).",
      ],
    },
    {
      title: "Security",
      blocks: [
        "Connections to the site are encrypted (HTTPS). Passwords are stored as hashes. Login is protected against password guessing by temporary account locks and an anti-bot check, and changing or resetting the password signs the account out on all devices. Access to data is limited to what each user and staff member needs.",
      ],
    },
    {
      title: "Cookies",
      blocks: ["How the site stores data on your device is described in the [Cookie Policy](/cookies)."],
    },
    {
      title: "Changes to this policy",
      blocks: [
        "We may update this policy when the site or the law changes. The date at the top shows the latest version; material changes are announced on the site or by email.",
      ],
    },
  ],
};

export const cookies: LegalDocument = {
  path: "/cookies",
  title: "Cookie Policy",
  navLabel: "Cookie Policy",
  subtitle: `Last updated: ${updated} · Ley 34/2002 LSSI-CE, art. 22.2`,
  sections: [
    {
      title: "What cookies are",
      blocks: [
        "Cookies, and similar technologies such as the browser's local storage, store small pieces of information on your device when you visit a website, so that the site can work or remember something.",
      ],
    },
    {
      title: "What the site uses",
      blocks: [
        "The site itself sets no cookies. It uses only the following, all of which are strictly necessary:",
        [
          "access_token (browser local storage): keeps you logged in. Expires after 30 minutes and is renewed automatically while you use the site; deleted when you log out.",
          "refresh_token (browser local storage): renews your login so you do not have to log in on every visit. Valid for up to one year from your last visit; deleted when you log out.",
          "Cloudflare Turnstile (challenges.cloudflare.com): the anti-bot check shown on the registration, password-reset and confirmation-email forms. To tell people from bots, Cloudflare may process technical data about your browser and store the information needed for the check, only on those forms. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).",
        ],
        "We do not use analytics, advertising, social media or other tracking cookies.",
      ],
    },
    {
      title: "Consent",
      blocks: [
        "Technologies strictly necessary to provide a service you request — such as staying logged in or protecting a form against bots — do not require consent (art. 22.2 LSSI-CE). That is why the site does not show a cookie banner. If we ever add cookies that are not strictly necessary, we will ask for your consent first and update this policy.",
      ],
    },
    {
      title: "How to control them",
      blocks: [
        "You can delete the data stored by the site at any time by logging out or by clearing the site data in your browser settings. If you block it, you will not be able to log in. Instructions for the most common browsers:",
        [
          "[Chrome](https://support.google.com/chrome/answer/95647)",
          "[Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox)",
          "[Safari](https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac)",
          "[Edge](https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)",
        ],
      ],
    },
    {
      title: "Contact",
      blocks: [
        `Questions about this policy: ${contactLine} More about how we process personal data in the [Privacy Policy](/privacy).`,
      ],
    },
  ],
};

export const legalNotice: LegalDocument = {
  path: "/legal-notice",
  title: "Legal Notice",
  navLabel: "Legal Notice",
  subtitle: "Aviso legal · Ley 34/2002 LSSI-CE, art. 10",
  sections: [
    {
      title: "Owner of the website",
      blocks: [
        [
          `Owner: ${operator.legalName}`,
          `NIF: ${operator.taxId}`,
          `Address: ${operator.address}`,
          `Registry details: ${operator.registry}`,
          `Email: ${emailLink}`,
          `Phone: ${operator.phone}`,
        ],
      ],
    },
    {
      title: "Purpose",
      blocks: [
        `${company.name} is the online shop of the owner, selling collector coins and bullion. Use of the site is governed by the [Terms of Service](/terms), the [Shipping Policy](/shipping), the [Privacy Policy](/privacy) and the [Cookie Policy](/cookies).`,
      ],
    },
    {
      title: "Intellectual property",
      blocks: [
        "The design, logo, texts, coin photos and descriptions and the software of the website belong to the owner or its licensors. Reproducing or reusing them without written permission is not allowed.",
      ],
    },
    {
      title: "Links",
      blocks: [
        "Coin pages may link to external websites, such as coin catalogues. We are not responsible for their content.",
      ],
    },
    {
      title: "Applicable law",
      blocks: ["This website is governed by Spanish law."],
    },
  ],
};

/** In footer order. */
export const legalDocuments: LegalDocument[] = [terms, shipping, privacy, cookies, legalNotice];
