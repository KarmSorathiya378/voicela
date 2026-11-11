// Normalize the shared contract into the demo's read-only presentation model.
import { demoFiles } from '@/lib/data/demo-files';
import { demoMail, demoDraft } from '@/lib/data/demo-mail';
import { seededConflict, proposedMeeting, calendarContext } from '@/lib/data/demo-calendar';
import { demoChart } from '@/lib/data/demo-chart';
export const files = demoFiles.map(file => ({ ...file, name: file.name.replace('Acme', 'Northstar'), content: file.content.replace('ACME STUDIO', 'NORTHSTAR STUDIO'), folder: file.path, keywords: file.tags }));
export const mail = { from: demoMail[0].from, address: demoMail[0].email, subject: demoMail[0].subject, body: demoMail[0].body, draft: demoDraft.body };
export const calendar = { date: `${calendarContext.dateLabel} 2026`, zone: calendarContext.timezone, conflict: seededConflict.title, blocked: `${seededConflict.start}–${seededConflict.end}`, available: `${proposedMeeting.start}–${proposedMeeting.end}`, title: proposedMeeting.title };
export const chart = demoChart.slice(-4);
// Bonus dictation and selected paragraph are demo-specific supplements.
export const originalNote = 'Um, we should, you know, review the prototype on Friday. Basically, Maya will share feedback.';
export const cleanNote = 'Review the prototype on Friday. Maya will share feedback.';
