/** Main sections of the site, shown in the header and the footer. */
export const mainNav = [
  // `end`: "/" would otherwise also count as active on every other page.
  { to: "/", label: "Home", end: true },
  { to: "/browse", label: "Shop", end: false },
  { to: "/contact", label: "Contact", end: false },
];
