import { Worker } from 'bullmq';
import { bullConnectionOpts } from '../config/redis';
import { QUEUE_CAMPAIGN, CampaignJobData } from './index';
import { dispatchCampaign, sendCampaignToSubscriber } from '../services/campaign.service';
import Logger from '../utils/logger';

/** Worker for marketing campaign fan-out: one dispatch job → many per-recipient sends. */
export function startCampaignWorker(): Worker {
    const worker = new Worker<CampaignJobData>(
        QUEUE_CAMPAIGN,
        async (job) => {
            const d = job.data;
            if (d.kind === 'dispatch') await dispatchCampaign(d.campaignId);
            else await sendCampaignToSubscriber(d.campaignId, d.subscriberId);
        },
        { connection: bullConnectionOpts(), concurrency: 10 },
    );

    worker.on('failed', (job, err) =>
        Logger.error('campaign job failed', { jobId: job?.id, attempts: job?.attemptsMade, message: err.message }),
    );

    Logger.info('campaign worker started');
    return worker;
}
