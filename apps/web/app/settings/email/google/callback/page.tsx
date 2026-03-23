import GoogleEmailOAuthCallback from "../../../../components/GoogleEmailOAuthCallback";

export default function SettingsEmailGoogleCallbackPage({
  searchParams
}: {
  searchParams?: {
    code?: string;
    state?: string;
    error?: string;
  };
}) {
  return (
    <GoogleEmailOAuthCallback
      code={searchParams?.code}
      state={searchParams?.state}
      error={searchParams?.error}
    />
  );
}
