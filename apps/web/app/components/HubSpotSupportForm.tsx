"use client";

import Script from "next/script";
import { useState } from "react";

declare global {
  interface Window {
    hbspt?: {
      forms: {
        create: (options: {
          portalId: string;
          formId: string;
          region: string;
          target: string;
        }) => void;
      };
    };
  }
}

export default function HubSpotSupportForm() {
  const [formReady, setFormReady] = useState(false);

  function mountForm() {
    if (formReady || typeof window === "undefined" || !window.hbspt?.forms) {
      return;
    }

    window.hbspt.forms.create({
      portalId: "8066413",
      formId: "34c86737-6548-462a-8632-6dfef89e6868",
      region: "na1",
      target: "#hubspot-support-form"
    });
    setFormReady(true);
  }

  return (
    <>
      <Script
        id="hubspot-forms-v2"
        src="https://js.hsforms.net/forms/embed/v2.js"
        strategy="afterInteractive"
        onLoad={mountForm}
      />
      <div
        id="hubspot-support-form"
        className="min-h-[480px] rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#0b1126] p-4"
      />
    </>
  );
}
