import { FERNORA_SHOPIFY_STOREFRONT } from "@/lib/shopify-shop";
import { GELATO_SHIP_BLURB } from "@/lib/gelato-countries";

export const FERNORA_CONTACT_EMAIL = "hello@fernora.nz";
export const FERNORA_STUDIO = "Wellington 6012, New Zealand";
export const FERNORA_ORIGIN = `https://${FERNORA_SHOPIFY_STOREFRONT}`;

export const POLICY_PATHS = {
  returns: "/shop/policies/returns",
  privacy: "/shop/policies/privacy",
  terms: "/shop/policies/terms",
  shipping: "/shop/policies/shipping",
  payments: "/shop/policies/payments",
  contact: "/shop/contact",
} as const;

export function storefrontPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export const POLICY_COPY = {
  returns: {
    title: "Returns & refunds",
    summary:
      "Made-to-order Gelato prints are not returnable because you changed your mind. We replace or refund items that arrive damaged, defective, or incorrect.",
    body: [
      "Fernora pieces are printed to order by Gelato after payment. Because each item is made for you, we cannot accept returns for change of mind, wrong colour or size chosen at checkout, or buyer’s remorse.",
      "If a parcel arrives damaged, misprinted, or is the wrong product, email hello@fernora.nz within 14 days of delivery with your order number, photos of the item and the packaging. We will reprint, replace, or refund the item price and original shipping.",
      "Apparel (tees, hoodies, sweatshirts) follows the size chart on the product page. Measure a garment you already like before ordering. We do not offer exchanges for size once Gelato has started the print.",
      "Refunds return to the original Shopify payment method (card, Shop Pay, Apple Pay, Google Pay). Reprint transit follows the same Gelato lane as the original order.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    summary: "We keep only what we need to fulfil your order and run the Fernora shop.",
    body: [
      "Fernora collects the name, email, phone, and shipping address you give at checkout so Gelato can print and deliver, and so Shopify can take payment. Order history on fernora.nz is stored in your browser unless you also check out through Shopify, where Shopify holds the customer record.",
      "We do not sell personal information. Pressroom (our operations desk) stores order details to fulfil Gelato prints and customer service. Payment card data is handled by Shopify Payments — we never see full card numbers.",
      "Cookies on the shop remember your bag and profile on this device. You can clear them in the browser. Analytics, if enabled later, will be disclosed here.",
      "To access, correct, or delete account details we hold, email hello@fernora.nz. Shopify customers can also manage data from the invoice email or Shopify account.",
    ],
  },
  terms: {
    title: "Terms of service",
    summary: "Buying from Fernora is a made-to-order print contract fulfilled by Gelato.",
    body: [
      "By placing an order on fernora.nz or through the Shopify invoice, you offer to buy the catalog item at the listed NZD price plus destination shipping. We accept when Shopify records payment. Title passes when Gelato hands the parcel to the carrier.",
      "Artwork, product photos, and the Fernora name are ours or used with permission. You may not reproduce print files sold as finished goods. Catalog print templates in Pressroom are for production, not resale.",
      "Gelato manufactures in-region. Production and transit windows on each product page are estimates, not guarantees. Events outside our control (customs, carrier delays, print-facility closures) can add time.",
      "New Zealand law governs these terms. If a term cannot be enforced, the rest still apply. Contact hello@fernora.nz for disputes before chargebacks — we will reprint or refund qualifying defects.",
    ],
  },
  shipping: {
    title: "Shipping policy",
    summary: GELATO_SHIP_BLURB,
    body: [
      "Fernora ships wherever Gelato delivers: New Zealand, Australia, the United States, the United Kingdom, the European Union, and the other countries listed at checkout. The country field matches Gelato destinations — if a country is missing, Gelato does not currently print there for this catalog.",
      "Shipping charged at checkout is the Gelato destination rate for that product (print-near-you). Wellington 6012 is the studio and Shopify shop address, not the parcel origin.",
      "Typical transit after print: New Zealand 2–8 days, Australia 3–10 days, United States, United Kingdom and Europe 4–12 days. Other Gelato destinations follow the United States international lane unless the product page says otherwise.",
      "You pay destination shipping. Duties or import VAT, if a carrier assesses them, are the buyer’s responsibility outside NZ/AU GST-inclusive pricing. Tracking is emailed when Gelato releases the parcel.",
    ],
  },
  payments: {
    title: "Payments",
    summary: "Pay securely at Shopify checkout on fernora.nz. Gelato prints after Shopify marks the order paid.",
    body: [
      "Checkout on fernora.nz is the Shopify Online Store (gi6ey4-wc.myshopify.com). You pay there with Shopify Payments: credit and debit cards, and Shop Pay, Apple Pay, or Google Pay where Shopify offers them for your country.",
      "Prices are New Zealand dollars (NZD). Your bank may convert at its own rate. We do not add a Fernora surcharge on top of Shopify’s processing.",
      "Gelato does not start the print until Shopify reports the order paid. Unpaid checkouts stay pending in Pressroom and can be cancelled. Do not send bank transfer outside Shopify unless we confirm it in writing.",
      "Failed or expired checkouts can be retried from your order email. For payment issues, contact hello@fernora.nz with the order reference.",
    ],
  },
  contact: {
    title: "Contact",
    summary: `Studio ${FERNORA_STUDIO}. Email ${FERNORA_CONTACT_EMAIL}.`,
    body: [
      "Fernora is a made-to-order print shop for Aotearoa, Australia, and every other country Gelato ships to.",
      `Email ${FERNORA_CONTACT_EMAIL} for orders, damaged parcels, and catalog questions. Include your Shopify invoice or order reference.`,
      `Postal studio (not the print origin): ${FERNORA_STUDIO}.`,
      "Pressroom operators: open /connections on the public desk hostname. Customers: stay on fernora.nz.",
    ],
  },
} as const;

export function policyHtml(key: keyof typeof POLICY_COPY) {
  const policy = POLICY_COPY[key];
  const paragraphs = policy.body.map((paragraph) => `<p>${escapePolicyHtml(paragraph)}</p>`).join("");
  return `<h2>${escapePolicyHtml(policy.title)}</h2><p>${escapePolicyHtml(policy.summary)}</p>${paragraphs}`;
}

function escapePolicyHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
