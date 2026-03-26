import { JobPayload, JobResult } from '../jobRouter';

let runPortalAuditAgent: any;

// Try to import the function, but if it doesn't exist, use a stub
try {
  ({ runPortalAuditAgent } = require('@muloo/executor'));
} catch (e) {
  runPortalAuditAgent = async () => {
    console.warn('[portal_audit] Agent not yet implemented');
    return { status: 'not_implemented' };
  };
}

export async function runPortalAudit(data: JobPayload): Promise<JobResult> {
  if (!data.portalId || !data.projectId) {
    throw new Error('portalId and projectId are required for portal_audit');
  }

  try {
    const result = await runPortalAuditAgent({
      portalId: data.portalId,
      projectId: data.projectId,
      dryRun: data.dryRun ?? false,
    });

    return {
      success: true,
      dryRun: data.dryRun ?? false,
      output: result,
    };
  } catch (err: any) {
    // Log the error to output for visibility
    const errorMsg = err?.message ?? String(err);
    console.warn(`[portal_audit] Error: ${errorMsg}`);

    return {
      success: false,
      dryRun: data.dryRun ?? false,
      output: {
        error: errorMsg,
        message: 'Portal audit executor not yet implemented or encountered an error',
      },
    };
  }
}
