export const DEFAULT_WORKSPACE_ID = "default";

const apiKeyEnvMap: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  xero: "XERO_CLIENT_SECRET"
};

type WorkspaceApiKeyLookup = {
  workspaceApiKey: {
    findUnique(args: {
      where: {
        workspaceId_keyName: {
          workspaceId: string;
          keyName: string;
        };
      };
    }): Promise<{ keyValue: string } | null>;
  };
};

export async function getApiKey(
  workspaceId: string,
  keyName: string,
  prisma: WorkspaceApiKeyLookup
): Promise<string | null> {
  const normalizedWorkspaceId = workspaceId.trim() || DEFAULT_WORKSPACE_ID;
  const normalizedKeyName = keyName.trim().toLowerCase();

  const record = await prisma.workspaceApiKey.findUnique({
    where: {
      workspaceId_keyName: {
        workspaceId: normalizedWorkspaceId,
        keyName: normalizedKeyName
      }
    }
  });

  if (record?.keyValue?.trim()) {
    return record.keyValue.trim();
  }

  const envKey = apiKeyEnvMap[normalizedKeyName];
  return envKey ? process.env[envKey]?.trim() || null : null;
}
