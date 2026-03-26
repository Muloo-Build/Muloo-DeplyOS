import { JobPayload, JobResult } from '../jobRouter';

let executePropertyApply: any;

// Try to import the function, but if it doesn't exist, use a stub
try {
  ({ executePropertyApply } = require('@muloo/executor'));
} catch (e) {
  executePropertyApply = async () => {
    console.warn('[property_apply] Executor not yet implemented');
    return { success: true, status: 'not_implemented' };
  };
}

export async function runPropertyApply(data: JobPayload): Promise<JobResult> {
  if (!data.projectId) {
    throw new Error('projectId required for property_apply');
  }

  try {
    const result = await executePropertyApply({
      projectId: data.projectId,
      dryRun: data.dryRun ?? false,
      payload: data.payload,
    });

    return {
      success: result.success ?? true,
      dryRun: data.dryRun ?? false,
      output: result,
    };
  } catch (err: any) {
    // Log the error to output for visibility
    const errorMsg = err?.message ?? String(err);
    console.warn(`[property_apply] Error: ${errorMsg}`);

    return {
      success: false,
      dryRun: data.dryRun ?? false,
      output: {
        error: errorMsg,
        message: 'Property apply executor not yet implemented or encountered an error',
      },
    };
  }
}
