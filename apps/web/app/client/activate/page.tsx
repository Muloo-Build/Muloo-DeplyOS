import ClientActivateForm from "../../components/ClientActivateForm";

export default function ClientActivatePage({
  searchParams
}: {
  searchParams?: { token?: string };
}) {
  return <ClientActivateForm token={searchParams?.token ?? ""} />;
}
