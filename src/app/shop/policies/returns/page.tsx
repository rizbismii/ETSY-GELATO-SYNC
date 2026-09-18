import { PolicyArticle } from "../../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Returns & refunds · Fernora" };

export default function ReturnsPolicyPage() {
  return <PolicyArticle policy={POLICY_COPY.returns} />;
}
