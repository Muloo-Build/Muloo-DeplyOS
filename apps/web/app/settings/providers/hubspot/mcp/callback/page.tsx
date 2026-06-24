import HubSpotMcpOAuthCallback from "../../../../../components/HubSpotMcpOAuthCallback";

export default function SettingsProvidersHubSpotMcpCallbackPage({
  searchParams
}: {
  searchParams?: {
    code?: string;
    state?: string;
    error?: string;
  };
}) {
  return (
    <HubSpotMcpOAuthCallback
      code={searchParams?.code}
      state={searchParams?.state}
      error={searchParams?.error}
    />
  );
}
