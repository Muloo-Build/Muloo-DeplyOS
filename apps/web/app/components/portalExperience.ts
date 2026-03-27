export type PortalExperience = "client" | "partner";

export function resolvePortalExperienceFromPathname(
  pathname?: string | null
): PortalExperience {
  return pathname?.startsWith("/partner") ? "partner" : "client";
}

export function getPortalBasePath(portalExperience: PortalExperience) {
  return `/${portalExperience}`;
}

export function getPortalLabel(portalExperience: PortalExperience) {
  return portalExperience === "partner" ? "Partner" : "Client";
}

export function getPortalLoginPath(portalExperience: PortalExperience) {
  return `${getPortalBasePath(portalExperience)}/login`;
}

export function getPortalActivatePath(portalExperience: PortalExperience) {
  return `${getPortalBasePath(portalExperience)}/activate`;
}

export function getPortalForgotPasswordPath(
  portalExperience: PortalExperience
) {
  return `${getPortalBasePath(portalExperience)}/forgot-password`;
}

export function getPortalProjectsPath(portalExperience: PortalExperience) {
  return `${getPortalBasePath(portalExperience)}/projects`;
}

export function getPortalProjectPath(
  portalExperience: PortalExperience,
  projectId: string
) {
  return `${getPortalProjectsPath(portalExperience)}/${encodeURIComponent(projectId)}`;
}

export function getPortalQuotePath(
  portalExperience: PortalExperience,
  projectId: string
) {
  return `${getPortalProjectPath(portalExperience, projectId)}/quote`;
}

export function getPortalDeliveryPath(
  portalExperience: PortalExperience,
  projectId: string
) {
  return `${getPortalProjectPath(portalExperience, projectId)}/delivery`;
}

export function getPortalInboxPath(portalExperience: PortalExperience) {
  return `${getPortalBasePath(portalExperience)}/inbox`;
}

export function getPortalSupportPath(portalExperience: PortalExperience) {
  return `${getPortalBasePath(portalExperience)}/support`;
}

export function getPortalRequestWorkPath(portalExperience: PortalExperience) {
  return `${getPortalBasePath(portalExperience)}/request-work`;
}

export function isPublicPortalRoute(
  pathname: string,
  portalExperience: PortalExperience
) {
  return (
    pathname === getPortalLoginPath(portalExperience) ||
    pathname === getPortalActivatePath(portalExperience) ||
    pathname === getPortalForgotPasswordPath(portalExperience)
  );
}
