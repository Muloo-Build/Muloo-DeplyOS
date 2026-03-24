import type { ReactNode } from "react";
import { Suspense } from "react";

import ClientAuthGate from "../components/ClientAuthGate";
import ClientPortalHubSpotTracker from "../components/ClientPortalHubSpotTracker";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <ClientPortalHubSpotTracker
          portalId={process.env.HUBSPOT_PORTAL_ID ?? "8066413"}
          eventIds={{
            login: process.env.HUBSPOT_CLIENT_LOGIN_EVENT_ID,
            quoteViewed: process.env.HUBSPOT_CLIENT_QUOTE_VIEW_EVENT_ID,
            deliveryViewed: process.env.HUBSPOT_CLIENT_DELIVERY_VIEW_EVENT_ID,
            supportViewed: process.env.HUBSPOT_CLIENT_SUPPORT_VIEW_EVENT_ID,
            requestWorkViewed:
              process.env.HUBSPOT_CLIENT_REQUEST_WORK_VIEW_EVENT_ID
          }}
        />
      </Suspense>
      <ClientAuthGate>{children}</ClientAuthGate>
    </>
  );
}
