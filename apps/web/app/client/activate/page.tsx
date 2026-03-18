import ClientActivateForm from "../../components/ClientActivateForm";

export const dynamic = "force-dynamic";

export default function ClientActivatePage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  return <ClientActivateForm token={searchParams?.token ?? ""} />;
}
