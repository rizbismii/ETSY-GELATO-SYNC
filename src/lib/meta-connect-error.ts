export const META_ACCOUNT_DISABLED_HELP =
  "Meta has disabled this Facebook login (account integrity). Pressroom cannot connect that account or any token it issues. The same email cannot open Business Suite via Instagram or a Managed Meta Account — Instagram on that email is still Dealstic. A partner with a live Business Suite must paste a new token on Ads.";

export function isMetaAccountDisabledError(message?: string | null, code?: number, subcode?: number) {
  if (code === 190 && (subcode === 459 || subcode === 464 || subcode === 490)) return true;
  return /disabled this Facebook login|account integrity|blocking checkpoint|user checkpoint|community standards on account integrity|we've disabled your account|we have disabled your account/i.test(
    message || "",
  );
}

export function explainMetaConnectError(message?: string | null, code?: number, subcode?: number) {
  const raw = (message || "").trim() || `Meta API error${code ? ` ${code}` : ""}`;
  if (isMetaAccountDisabledError(raw, code, subcode)) return META_ACCOUNT_DISABLED_HELP;
  return raw;
}
