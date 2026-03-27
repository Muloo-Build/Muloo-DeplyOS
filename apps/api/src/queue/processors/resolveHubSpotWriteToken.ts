import { prisma } from "../../prisma";

function normalizeHubSpotBaseUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "https://api.hubapi.com";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function resolveHubSpotOAuthRedirectUri(explicitRedirectUri?: string | null) {
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

async function loadHubSpotOAuthProviderConfig() {
  const provider = await prisma.workspaceProviderConnection.findUnique({
    where: { providerKey: "hubspot_oauth" }
  });

  if (!provider) {
    throw new Error("HubSpot OAuth provider is not configured");
  }

  return {
    clientId: provider.defaultModel?.trim() ?? "",
    clientSecret: provider.apiKey?.trim() ?? "",
    baseUrl: normalizeHubSpotBaseUrl(provider.endpointUrl),
    redirectUri: resolveHubSpotOAuthRedirectUri()
  };
}

async function refreshHubSpotPortalAccessTokenIfNeeded(portalId: string) {
  const portal = await prisma.hubSpotPortal.findUnique({
    where: { portalId }
  });

  if (!portal?.connected || !portal.refreshToken) {
    return portal?.accessToken?.trim() ?? "";
  }

  const tokenStillValid =
    portal.accessToken &&
    portal.tokenExpiresAt &&
    portal.tokenExpiresAt.getTime() > Date.now() + 60_000;

  if (tokenStillValid && portal.accessToken) {
    return portal.accessToken.trim();
  }

  const oauthConfig = await loadHubSpotOAuthProviderConfig();

  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw new Error("HubSpot app credentials are incomplete");
  }

  const refreshResponse = await fetch(`${oauthConfig.baseUrl}/oauth/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: oauthConfig.redirectUri,
      refresh_token: portal.refreshToken
    }).toString()
  });

  const refreshBody = (await refreshResponse.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: string;
    message?: string;
  } | null;

  if (!refreshResponse.ok || !refreshBody?.access_token) {
    throw new Error(
      refreshBody?.message ||
        refreshBody?.error ||
        "HubSpot access token refresh failed"
    );
  }

  const refreshedPortal = await prisma.hubSpotPortal.update({
    where: { id: portal.id },
    data: {
      accessToken: refreshBody.access_token,
      refreshToken: refreshBody.refresh_token ?? portal.refreshToken,
      tokenType: refreshBody.token_type ?? portal.tokenType ?? "bearer",
      tokenExpiresAt:
        typeof refreshBody.expires_in === "number"
          ? new Date(Date.now() + refreshBody.expires_in * 1000)
          : portal.tokenExpiresAt,
      connected: true
    }
  });

  return refreshedPortal.accessToken?.trim() ?? "";
}

export async function resolveHubSpotWriteToken(portalId: string) {
  const portalSession = await prisma.portalSession.findFirst({
    where: { portalId, valid: true },
    orderBy: { capturedAt: "desc" }
  });

  const privateAppToken = portalSession?.privateAppToken?.trim();

  if (privateAppToken) {
    return privateAppToken;
  }

  const accessToken = await refreshHubSpotPortalAccessTokenIfNeeded(portalId);
  return accessToken || null;
}
