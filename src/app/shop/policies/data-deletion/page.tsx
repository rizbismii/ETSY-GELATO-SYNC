import { PolicyArticle } from "../../policy-article";
import { POLICY_COPY } from "@/lib/shop-policies";

export const metadata = { title: "Data deletion · Fernora" };

export default function DataDeletionPage() {
  return <PolicyArticle policy={POLICY_COPY.dataDeletion} />;
}
