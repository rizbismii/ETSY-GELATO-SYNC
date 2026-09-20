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
      "Fernora pieces are personalised, made to order by Gelato. We do not accept returns or refunds for change of mind, and we do not provide a return address.",
    body: [
      "Every Fernora item is printed after payment for the size, colour, and artwork you selected. Gelato does not accept returns of personalised print-on-demand goods, and Fernora follows that policy: we cannot take back unused items, buyer’s remorse, or a different size or colour chosen at checkout.",
      "Measure against a garment you already own before ordering apparel. Once Gelato has started the print, size and colour are not exchangeable.",
      "If an item arrives damaged, misprinted, defective, or is the wrong product, email hello@fernora.nz within 30 days of delivery. Include your order number, a short description, and clear photographs of the item, the outer packaging, any inserts, and the shipping label. That is the same evidence Gelato requires to reprint under its quality guarantee.",
      "Where Gelato confirms a production or fulfilment fault, the remedy is a free reprint of the same item to the original address. A refund of the item price (and original shipping, where Gelato refunds it) is offered only when a reprint is not feasible. We do not refund because you no longer want the piece.",
      "Incorrect or incomplete addresses, unclaimed parcels, and refused deliveries are not production faults. You may request a new print; you pay shipping on that replacement. Duties, import VAT, and carrier fees outside NZ/AU GST-inclusive pricing remain the buyer’s responsibility.",
      "Approved refunds return to the original Shopify payment method. Chargebacks filed before you contact us delay investigation; write to hello@fernora.nz first.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    summary:
      "We collect only what Shopify and Gelato need to take payment, print, and deliver. We do not sell personal information.",
    body: [
      "When you check out on fernora.nz, Shopify collects your name, email, phone, shipping address, and payment details. Fernora and our print partner Gelato receive the fulfilment fields required to manufacture and ship the order (name, address, contact, line items). Payment card numbers are handled by Shopify Payments — we never store full card data.",
      "Pressroom, our operations desk, keeps order records so we can reprint defects, push tracking, and answer support. Gelato stores production files and delivery events under its own privacy terms. We do not sell, rent, or share customer lists for advertising.",
      "Cookies and similar storage remember your bag, country, and currency on this device. You can clear them in the browser. If we add analytics later, this policy will name the provider.",
      "To access, correct, or delete personal information we hold, email hello@fernora.nz. Shopify account holders can also manage data from the order email or Shopify customer account. We retain order records as long as tax, fulfilment, and dispute rules require.",
    ],
  },
  terms: {
    title: "Terms of service",
    summary: "An order on fernora.nz is a made-to-order print contract fulfilled by Gelato.",
    body: [
      "By placing an order you offer to buy the catalog item at the price shown for your selected country and currency, plus destination shipping. We accept when Shopify records payment. Title passes when Gelato hands the parcel to the carrier.",
      "Artwork, product photographs, and the Fernora name are ours or used with permission. Print files supplied for production are not licensed for resale or reproduction.",
      "Gelato manufactures in-region. Production and transit windows on product pages are estimates, not guarantees. Events outside our control (customs, carrier delays, print-facility closures, force majeure) can add time and are excluded from delivery guarantees.",
      "New Zealand law governs these terms. Contact hello@fernora.nz before chargebacks; qualifying defects are reprinted or refunded as set out in the returns policy.",
    ],
  },
  shipping: {
    title: "Shipping policy",
    summary: GELATO_SHIP_BLURB,
    body: [
      "Fernora ships to the countries listed at checkout. Choose your country in the header (country name and currency code). Checkout shipping is the destination rate for that product — printed near you. Wellington 6012 is the studio address, not the parcel origin.",
      "Typical transit after print: New Zealand 2–8 days, Australia 3–10 days, United States, United Kingdom and Europe 4–12 days. Selected Americas, Asia, and Middle East destinations follow the United States international lane unless the product page says otherwise.",
      "You pay destination shipping. Duties or import VAT, if a carrier assesses them, are the buyer’s responsibility outside NZ/AU GST-inclusive pricing. Tracking is emailed when the parcel is released.",
      "Lost-in-transit claims follow our quality and delivery process. We need the order number and a reasonable wait after the quoted window before a reprint is raised.",
    ],
  },
  payments: {
    title: "Payments",
    summary:
      "Pay at Shopify checkout. Prices follow the country you select in the header, shown with that country’s currency code.",
    body: [
      "Checkout on fernora.nz is the Shopify Online Store. Pay with Shopify Payments: cards, and Shop Pay, Apple Pay, or Google Pay where Shopify offers them for your country.",
      "Select your country in the header. The control shows the country name and currency code (for example New Zealand · NZD, Australia · AUD, United States · USD, United Kingdom · GBP, France · EUR). Catalog prices convert to that currency. The shop’s base currency remains New Zealand dollars (NZD); your bank may still apply its own conversion on the card statement.",
      "Gelato does not start the print until Shopify reports the order paid. Unpaid checkouts can be cancelled from Pressroom. Do not send bank transfer outside Shopify unless we confirm it in writing.",
      "Failed or expired checkouts can be retried from your order email. For payment issues, contact hello@fernora.nz with the order reference.",
    ],
  },
  contact: {
    title: "Contact",
    summary: `Studio ${FERNORA_STUDIO}. Email ${FERNORA_CONTACT_EMAIL}.`,
    body: [
      "Fernora is a made-to-order print studio for Aotearoa, Australia, and the other countries we ship to.",
      `Email ${FERNORA_CONTACT_EMAIL} for orders, damaged parcels, and catalog questions. Include your Shopify order reference and photographs if you are reporting a defect.`,
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
