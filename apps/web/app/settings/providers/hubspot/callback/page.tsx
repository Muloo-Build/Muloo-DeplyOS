import HubSpotOAuthCallback from "../../../../components/HubSpotOAuthCallback";

export default function SettingsProvidersHubSpotCallbackPage({
  searchParams
}: {
  searchParams?: {
    code?: string;
    state?: string;
    error?: string;
  };
}) {
  return (
    <HubSpotOAuthCallback
      code={searchParams?.code}
      state={searchParams?.state}
      error={searchParams?.error}
    />
  );
}
