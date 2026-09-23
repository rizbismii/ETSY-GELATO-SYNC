export const META_ACCOUNT_DISABLED_HELP =
  "Meta has disabled this Facebook login (account integrity). Pressroom cannot connect that account or any token it issues. The same email cannot open Business Suite via Instagram or a Managed Meta Account — Instagram on that email is still Dealstic. A partner with a live Business Suite must paste a new token on Ads.";

export const META_TOKEN_EXPIRED_HELP =
  "The Graph Explorer user token expired. Open Graph API Explorer, set Meta App to Fernora Pressroom (2165594861508604), generate a new User Token, and paste it on Ads. Explorer tokens last about an hour — Save, then create the paused campaign in the same sitting.";

export function isMetaAccountDisabledError(message?: string | null, code?: number, subcode?: number) {
  if (code === 190 && (subcode === 459 || subcode === 464 || subcode === 490)) return true;
  return /disabled this Facebook login|account integrity|blocking checkpoint|user checkpoint|community standards on account integrity|we've disabled your account|we have disabled your account/i.test(
    message || "",
  );
}

export function isMetaTokenExpiredError(message?: string | null, code?: number, subcode?: number) {
  if (code === 190 && (subcode === 463 || subcode === 467)) return true;
  return /session has expired|error validating access token: session has expired|expired on /i.test(message || "");
}

export function explainMetaConnectError(message?: string | null, code?: number, subcode?: number) {
  const raw = (message || "").trim() || `Meta API error${code ? ` ${code}` : ""}`;
  if (isMetaAccountDisabledError(raw, code, subcode)) return META_ACCOUNT_DISABLED_HELP;
  if (isMetaTokenExpiredError(raw, code, subcode)) return META_TOKEN_EXPIRED_HELP;
  return raw;
}
