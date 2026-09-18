import { PolicyArticle } from "../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Contact · Fernora" };

export default function ContactPage() {
  return <PolicyArticle policy={POLICY_COPY.contact} />;
}
