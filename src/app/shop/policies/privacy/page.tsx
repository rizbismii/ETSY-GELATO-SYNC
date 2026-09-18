import { PolicyArticle } from "../../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Privacy · Fernora" };

export default function PrivacyPolicyPage() {
  return <PolicyArticle policy={POLICY_COPY.privacy} />;
}
