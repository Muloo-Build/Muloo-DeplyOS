import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync("apps/api/src/server.ts", "utf8");

test("project serialization uses the safe HubSpot portal serializer", () => {
  const serializeProjectMatch = serverSource.match(
    /function serializeProject<[\s\S]*?function serializeExternalApproval/
  );

  assert.ok(serializeProjectMatch, "serializeProject block should be present");

  const serializeProjectSource = serializeProjectMatch[0];

  assert.match(
    serializeProjectSource,
    /portal:\s*normalizedProject\.portal\s*\?\s*serializeHubSpotPortal\(normalizedProject\.portal\)\s*:\s*null/,
    "serializeProject should overwrite the raw portal relation with the safe serializer"
  );
});

test("safe HubSpot portal serializer does not expose OAuth tokens", () => {
  const serializerMatch = serverSource.match(
    /function serializeHubSpotPortal<[\s\S]*?function createHubSpotLogger/
  );

  assert.ok(serializerMatch, "serializeHubSpotPortal block should be present");

  const serializerSource = serializerMatch[0];
  assert.doesNotMatch(serializerSource, /accessToken\s*:/);
  assert.doesNotMatch(serializerSource, /refreshToken\s*:/);
});
