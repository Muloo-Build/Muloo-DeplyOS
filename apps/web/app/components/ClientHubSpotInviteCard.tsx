"use client";

import { useEffect, useState } from "react";

interface HubSpotInviteResponse {
  partnerInviteUrl: string | null;
  connected: boolean;
  portalId: string | null;
  error?: string;
}

export default function ClientHubSpotInviteCard() {
  const [data, setData] = useState<HubSpotInviteResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInviteData() {
      try {
        const response = await fetch("/api/client-auth/hubspot-invite", {
          credentials: "include"
        });

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const body = await response.json();
        setData(body);
      } catch {
        // Silently fail if endpoint is not available
      } finally {
        setLoading(false);
      }
    }

    void loadInviteData();
  }, []);

  // Don't render if loading or no data
  if (loading || !data) {
    return null;
  }

  // If already connected, render success state
  if (data.connected) {
    return (
      <div className="rounded-[14px] border border-[rgba(81,208,176,0.3)] bg-[rgba(81,208,176,0.08)] p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="text-xl leading-6 mt-0.5">✓</div>
          <div>
            <h3 className="text-white font-semibold mb-1">HubSpot Connected</h3>
            {data.portalId && (
              <p className="text-text-2 text-sm">Portal ID: {data.portalId}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If no invite URL is set, hide the card
  if (!data.partnerInviteUrl) {
    return null;
  }

  // Render the invite card
  return (
    <div className="rounded-[14px] border border-[rgba(123,226,239,0.3)] bg-[rgba(123,226,239,0.08)] p-6 mb-6">
      <h3 className="text-white font-semibold mb-2">Invite Muloo to HubSpot</h3>
      <p className="text-text-2 text-sm mb-4">
        Use this link to invite Muloo as a partner/admin in your HubSpot
        portal. This gives us the access needed to complete the approved
        setup work. A HubSpot Super Admin from your team needs to click the
        link. Takes about 10 seconds.
      </p>
      <a
        href={data.partnerInviteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 bg-[#7be2ef] hover:bg-[#69d4dd] text-[#0f1419] font-medium rounded-lg transition-colors text-sm"
      >
        Open invite in HubSpot ↗
      </a>
    </div>
  );
}
