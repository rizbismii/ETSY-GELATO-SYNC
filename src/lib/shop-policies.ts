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
  dataDeletion: "/shop/policies/data-deletion",
} as const;

export function storefrontPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export const POLICY_COPY = {
  returns: {
    title: "Returns & refunds",
    summary:
      "Fernora pieces are personalised and made to order. We do not accept returns or refunds for change of mind, and we do not provide a return address.",
    body: [
      "Every Fernora item is printed after payment for the size, colour, and artwork you selected. Personalised made-to-order goods cannot be returned: we cannot take back unused items, buyer’s remorse, or a different size or colour chosen at checkout.",
      "Measure against a garment you already own before ordering apparel. Once printing has started, size and colour are not exchangeable.",
      "If an item arrives damaged, misprinted, defective, or is the wrong product, email hello@fernora.nz within 30 days of delivery. Include your order number, a short description, and clear photographs of the item, the outer packaging, any inserts, and the shipping label. That is the evidence we need to reprint under our quality guarantee.",
      "Where we confirm a production or fulfilment fault, the remedy is a free reprint of the same item to the original address. A refund of the item price (and original shipping, where the reprint is not feasible) is offered only in that case. We do not refund because you no longer want the piece.",
      "Incorrect or incomplete addresses, unclaimed parcels, and refused deliveries are not production faults. You may request a new print; you pay shipping on that replacement. Duties, import VAT, and carrier fees outside NZ/AU GST-inclusive pricing remain the buyer’s responsibility.",
      "Approved refunds return to the original Shopify payment method. Chargebacks filed before you contact us delay investigation; write to hello@fernora.nz first.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    summary:
      "We collect only what we need to take payment, print, and deliver. We do not sell personal information.",
    body: [
      "When you check out on fernora.nz, Shopify collects your name, email, phone, shipping address, and payment details. Fernora and our print studio receive the fulfilment fields required to manufacture and ship the order (name, address, contact, line items). Payment card numbers are handled by Shopify Payments — we never store full card data.",
      "Pressroom, our operations desk, keeps order records so we can reprint defects, push tracking, and answer support. Production files and delivery events are stored only as needed to print and ship. We do not sell, rent, or share customer lists for advertising.",
      "Cookies and similar storage remember your bag, country, and currency on this device. You can clear them in the browser. If we add analytics later, this policy will name the provider.",
      "To access, correct, or delete personal information we hold, email hello@fernora.nz. Shopify account holders can also manage data from the order email or Shopify customer account. We retain order records as long as tax, fulfilment, and dispute rules require.",
      "How to delete your data: email hello@fernora.nz with the subject “Delete my data” and the email or order number used at checkout. We delete or anonymise Pressroom, Pixel, and fulfilment records we control within 30 days, except records we must keep for tax, shipping, or disputes. The same request is published at fernora.nz/pages/data-deletion.",
    ],
  },
  dataDeletion: {
    title: "User data deletion",
    summary:
      "Email hello@fernora.nz to delete personal information Fernora holds from a shop order or from Meta ads.",
    body: [
      "This page is the user-data-deletion instruction URL for the Fernora Pressroom Meta app and for fernora.nz.",
      "Send one email to hello@fernora.nz with the subject “Delete my data”. Include the email address used at checkout or in a Facebook/Instagram comment, and any Shopify order number you have.",
      "We will delete or anonymise your name, email, phone, address, and ad-event identifiers that Pressroom stores, and we will ask our print and checkout processors to do the same where they hold a copy. Pixel events already sent to Meta are deleted through Meta’s tools when you use Facebook or Instagram’s own off-Facebook activity controls.",
      "We complete requests within 30 days. We may keep a minimal order record where New Zealand tax, shipping-claim, or payment-dispute rules require it. We will say so in the reply.",
      "This does not delete your Facebook, Instagram, or Shopify account. Those are closed in those products’ own settings.",
    ],
  },
  terms: {
    title: "Terms of service",
    summary: "An order on fernora.nz is a made-to-order print contract.",
    body: [
      "By placing an order you offer to buy the catalog item at the price shown for your selected country and currency, plus destination shipping. We accept when Shopify records payment. Title passes when the parcel is handed to the carrier.",
      "Artwork, product photographs, and the Fernora name are ours or used with permission. Print files supplied for production are not licensed for resale or reproduction.",
      "Each piece is printed in your region. Production and transit windows on product pages are estimates, not guarantees. Events outside our control (customs, carrier delays, print-facility closures, force majeure) can add time and are excluded from delivery guarantees.",
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
      "Printing does not start until Shopify reports the order paid. Unpaid checkouts can be cancelled from Pressroom. Do not send bank transfer outside Shopify unless we confirm it in writing.",
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
