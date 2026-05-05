import ContactDetailView from "../../components/ContactDetailView";

export default function ContactDetailPage({
  params
}: {
  params: { id: string };
}) {
  return <ContactDetailView contactId={params.id} />;
}
