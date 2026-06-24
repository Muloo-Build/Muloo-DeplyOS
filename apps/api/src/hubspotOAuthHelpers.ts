export function normalizeHubSpotBaseUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "https://api.hubapi.com";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function resolveHubSpotOAuthRedirectUri(
  explicitRedirectUri?: string | null
) {
  const trimmedExplicitRedirectUri = explicitRedirectUri?.trim() ?? "";

  if (trimmedExplicitRedirectUri) {
    return trimmedExplicitRedirectUri;
  }

  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "https://deploy.wearemuloo.com";

  return `${baseUrl}/settings/providers/hubspot/callback`;
}
