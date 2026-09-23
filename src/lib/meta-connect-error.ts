export const META_ACCOUNT_DISABLED_HELP =
  "Meta has disabled this Facebook login (account integrity). Pressroom cannot connect that account or any token it issues. The same email cannot open Business Suite via Instagram or a Managed Meta Account — Instagram on that email is still Dealstic. A partner with a live Business Suite must paste a new token on Ads.";

export const META_TOKEN_EXPIRED_HELP =
  "The Graph Explorer user token expired. Open Graph API Explorer, set Meta App to Fernora Pressroom (2165594861508604), generate a new User Token, and paste it on Ads. Explorer tokens last about an hour — Save, then create the paused campaign in the same sitting.";

export const META_APP_DEVELOPMENT_HELP =
  "The paused Fernora · Pressroom campaign and NZ/AU ad set are ready. Meta will not attach the Page ad while Fernora Pressroom is in Development mode. In the app dashboard open App settings → Basic, add the privacy policy https://fernora.nz/policies/privacy-policy, then switch the app to Live. Create paused campaign again after that. Do not Go live on the campaign until we decide to.";

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

export function isMetaAppDevelopmentError(message?: string | null) {
  return /app that is in development mode|must be in public to create this ad|development mode/i.test(message || "");
}

export function explainMetaConnectError(message?: string | null, code?: number, subcode?: number) {
  const raw = (message || "").trim() || `Meta API error${code ? ` ${code}` : ""}`;
  if (isMetaAccountDisabledError(raw, code, subcode)) return META_ACCOUNT_DISABLED_HELP;
  if (isMetaTokenExpiredError(raw, code, subcode)) return META_TOKEN_EXPIRED_HELP;
  if (isMetaAppDevelopmentError(raw)) return META_APP_DEVELOPMENT_HELP;
  return raw;
}
