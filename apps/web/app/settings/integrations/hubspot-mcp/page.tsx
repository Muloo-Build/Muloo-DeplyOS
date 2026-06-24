export default function HubSpotMcpSettingsPage() {
  return (
    <div className="px-6 py-8 text-white">
      <h1 className="text-lg font-semibold">HubSpot Agentic (MCP)</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-2">
        Connect each client HubSpot portal so Muloo agents can deliver work via
        HubSpot&apos;s MCP server. Connect per portal from the project workspace.
        Note: agent activity through the MCP connector is not covered by Anthropic
        zero-data-retention.
      </p>
    </div>
  );
}
