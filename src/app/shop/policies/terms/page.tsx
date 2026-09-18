import { PolicyArticle } from "../../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Terms of service · Fernora" };

export default function TermsPolicyPage() {
  return <PolicyArticle policy={POLICY_COPY.terms} />;
}
