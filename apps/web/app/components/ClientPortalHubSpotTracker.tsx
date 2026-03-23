"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  consumePendingHubSpotPortalLogin,
  identifyHubSpotPortalUser,
  resolveHubSpotPortalEventForPath,
  trackHubSpotPortalEvent,
  trackHubSpotPortalPage,
  type HubSpotPortalEventIds
} from "./hubspotClientTracking";

interface ClientPortalHubSpotTrackerProps {
  portalId?: string | null;
  eventIds?: HubSpotPortalEventIds;
}

interface ClientSessionResponse {
  authenticated?: boolean;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
}

export default function ClientPortalHubSpotTracker({
  portalId,
  eventIds = {}
}: ClientPortalHubSpotTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [readyToLoadScript, setReadyToLoadScript] = useState(false);
  const identifiedEmailRef = useRef<string | null>(null);
  const lastTrackedPathRef = useRef<string | null>(null);
  const hasPrimedTrackingRef = useRef(false);

  const currentPath = useMemo(() => {
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  async function syncAuthenticatedUser() {
    try {
      const response = await fetch("/api/client-auth/session", {
        credentials: "include"
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as ClientSessionResponse;

      if (!body.authenticated || !body.user?.email) {
        identifiedEmailRef.current = null;
        return null;
      }

      const normalizedEmail = body.user.email.trim().toLowerCase();

      if (identifiedEmailRef.current !== normalizedEmail) {
        identifyHubSpotPortalUser({
          email: normalizedEmail,
          firstName: body.user.firstName,
          lastName: body.user.lastName
        });
        identifiedEmailRef.current = normalizedEmail;
      }

      return body.user;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function primeTracking() {
      if (!portalId?.trim()) {
        return;
      }

      if (hasPrimedTrackingRef.current) {
        return;
      }

      await syncAuthenticatedUser();

      if (consumePendingHubSpotPortalLogin()) {
        trackHubSpotPortalEvent(eventIds.login);
      }

      trackHubSpotPortalEvent(
        resolveHubSpotPortalEventForPath(pathname, eventIds)
      );

      if (cancelled) {
        return;
      }

      hasPrimedTrackingRef.current = true;
      lastTrackedPathRef.current = currentPath;
      setReadyToLoadScript(true);
    }

    void primeTracking();

    return () => {
      cancelled = true;
    };
  }, [eventIds, pathname, currentPath, portalId]);

  useEffect(() => {
    let cancelled = false;

    async function trackRouteChange() {
      if (!portalId?.trim() || !readyToLoadScript) {
        return;
      }

      if (lastTrackedPathRef.current === null) {
        lastTrackedPathRef.current = currentPath;
        return;
      }

      if (lastTrackedPathRef.current === currentPath) {
        if (consumePendingHubSpotPortalLogin()) {
          trackHubSpotPortalEvent(eventIds.login);
        }
        return;
      }

      await syncAuthenticatedUser();

      if (cancelled) {
        return;
      }

      trackHubSpotPortalPage(currentPath);

      if (consumePendingHubSpotPortalLogin()) {
        trackHubSpotPortalEvent(eventIds.login);
      }

      trackHubSpotPortalEvent(
        resolveHubSpotPortalEventForPath(pathname, eventIds)
      );

      lastTrackedPathRef.current = currentPath;
    }

    void trackRouteChange();

    return () => {
      cancelled = true;
    };
  }, [currentPath, eventIds, pathname, portalId, readyToLoadScript]);

  if (!portalId?.trim()) {
    return null;
  }

  return readyToLoadScript ? (
    <Script
      id="hubspot-client-portal-tracking"
      strategy="afterInteractive"
      src={`https://js.hs-scripts.com/${portalId.trim()}.js`}
    />
  ) : null;
}
