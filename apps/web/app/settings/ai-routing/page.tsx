import AiRoutingSettings from "../../components/AiRoutingSettings";
import SettingsShell from "../../components/SettingsShell";

export default function SettingsAiRoutingPage() {
  return (
    <SettingsShell
      title="AI Routing"
      subtitle="Decide which provider and model should handle each workflow so discovery, summaries, and blueprints can be tested across Anthropic, OpenAI, and Gemini."
    >
      <AiRoutingSettings />
    </SettingsShell>
  );
}
