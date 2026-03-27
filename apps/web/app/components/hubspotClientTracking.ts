"use client";

declare global {
  interface Window {
    _hsq?: Array<unknown>;
  }
}

export interface HubSpotPortalIdentity {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface HubSpotPortalEventIds {
  login?: string | null;
  quoteViewed?: string | null;
  deliveryViewed?: string | null;
  supportViewed?: string | null;
  requestWorkViewed?: string | null;
}

function ensureHubSpotQueue() {
  if (typeof window === "undefined") {
    return null;
  }

  window._hsq = window._hsq ?? [];
  return window._hsq;
}

export function identifyHubSpotPortalUser(identity: HubSpotPortalIdentity) {
  const queue = ensureHubSpotQueue();

  if (!queue || !identity.email.trim()) {
    return;
  }

  queue.push([
    "identify",
    {
      email: identity.email.trim().toLowerCase(),
      ...(identity.firstName ? { firstname: identity.firstName } : {}),
      ...(identity.lastName ? { lastname: identity.lastName } : {})
    }
  ]);
}

export function trackHubSpotPortalPage(path: string) {
  const queue = ensureHubSpotQueue();

  if (!queue || !path.trim()) {
    return;
  }

  queue.push(["setPath", path]);
  queue.push(["trackPageView"]);
}

export function trackHubSpotPortalEvent(eventId?: string | null) {
  const queue = ensureHubSpotQueue();

  if (!queue || !eventId?.trim()) {
    return;
  }

  queue.push([
    "trackEvent",
    {
      id: eventId.trim()
    }
  ]);
}

export function markPendingHubSpotPortalLogin() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem("muloo:hubspot-client-login", "pending");
}

export function consumePendingHubSpotPortalLogin() {
  if (typeof window === "undefined") {
    return false;
  }

  const pending = window.sessionStorage.getItem("muloo:hubspot-client-login");

  if (pending === "pending") {
    window.sessionStorage.removeItem("muloo:hubspot-client-login");
    return true;
  }

  return false;
}

export function resolveHubSpotPortalEventForPath(
  pathname: string,
  eventIds: HubSpotPortalEventIds
) {
  if (/^\/(?:client|partner)\/projects\/[^/]+\/quote$/.test(pathname)) {
    return eventIds.quoteViewed ?? null;
  }

  if (/^\/(?:client|partner)\/projects\/[^/]+\/delivery$/.test(pathname)) {
    return eventIds.deliveryViewed ?? null;
  }

  if (pathname === "/client/support" || pathname === "/partner/support") {
    return eventIds.supportViewed ?? null;
  }

  if (
    pathname === "/client/request-work" ||
    pathname === "/partner/request-work"
  ) {
    return eventIds.requestWorkViewed ?? null;
  }

  return null;
}
