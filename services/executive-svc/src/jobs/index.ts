/**
 * Executive Service Background Jobs
 */

export { default as vettingRemindersJob, runVettingReminders } from './vetting-reminders.job';
export {
  default as linkedinReverificationJob,
  runLinkedInReverification,
} from './linkedin-reverification.job';

// Job registry for scheduler
export const jobs = [
  {
    name: 'vetting-reminders',
    schedule: '0 9 * * *',
    handler: () => import('./vetting-reminders.job').then((m) => m.runVettingReminders()),
  },
  {
    name: 'linkedin-reverification',
    schedule: '0 2 * * 0',
    handler: () =>
      import('./linkedin-reverification.job').then((m) => m.runLinkedInReverification()),
  },
];
