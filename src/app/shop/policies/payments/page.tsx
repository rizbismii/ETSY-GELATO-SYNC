import { PolicyArticle } from "../../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Payments · Fernora" };

export default function PaymentsPolicyPage() {
  return <PolicyArticle policy={POLICY_COPY.payments} />;
}
