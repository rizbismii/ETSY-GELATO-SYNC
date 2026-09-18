import { PolicyArticle } from "../../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Shipping · Fernora" };

export default function ShippingPolicyPage() {
  return <PolicyArticle policy={POLICY_COPY.shipping} />;
}
