import { contactsBySource } from './contactsBySource';
import { contactsCreatedByMonth } from './contactsCreatedByMonth';
import { mqlByMonth } from './mqlByMonth';
import { mqlBySource } from './mqlBySource';
import { lifecycleStageBreakdown } from './lifecycleStageBreakdown';
import { leadToMqlConversion } from './leadToMqlConversion';
import { closedWonByMonth } from './closedWonByMonth';
import { pipelineByStage } from './pipelineByStage';
import { lastKeyActionDistribution } from './lastKeyActionDistribution';
import { missingSourceContacts } from './missingSourceContacts';

export const MARKETING_TEMPLATES = [
  contactsBySource,
  contactsCreatedByMonth,
  mqlByMonth,
  mqlBySource,
  lifecycleStageBreakdown,
  leadToMqlConversion,
  closedWonByMonth,
  pipelineByStage,
  lastKeyActionDistribution,
  missingSourceContacts,
];

export {
  contactsBySource,
  contactsCreatedByMonth,
  mqlByMonth,
  mqlBySource,
  lifecycleStageBreakdown,
  leadToMqlConversion,
  closedWonByMonth,
  pipelineByStage,
  lastKeyActionDistribution,
  missingSourceContacts,
};
