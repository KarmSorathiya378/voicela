export interface DemoMail {
  id: string;
  from: string;
  email: string;
  subject: string;
  body: string;
  time: string;
  unread: boolean;
}
export const demoMail: DemoMail[] = [
  {
    id: "maya",
    from: "Maya Rao",
    email: "maya@example.com",
    subject: "Website review on Thursday?",
    body: "Hi Alex, can we review the updated website on Thursday? Please send the project brief beforehand. Thanks, Maya",
    time: "09:41",
    unread: true,
  },
  {
    id: "jules",
    from: "Jules Chen",
    email: "jules@example.com",
    subject: "Research notes are ready",
    body: "The interview notes are in the Research folder. The permission flow was a recurring theme.",
    time: "08:20",
    unread: false,
  },
  {
    id: "acme",
    from: "Acme Studio",
    email: "billing@example.com",
    subject: "October invoice",
    body: "Your October invoice is attached. Payment is due on 15 November.",
    time: "Yesterday",
    unread: false,
  },
];
export const demoDraft = {
  to: "maya@example.com",
  subject: "Re: Website review on Thursday?",
  body: "Hi Maya,\n\nThursday works well. I’ll share the website project brief ahead of our review. Would 2:30 pm suit you?\n\nThanks,\nAlex",
  status: "draft" as const,
};
export const mockInbox = demoMail;
export const mockDraft = demoDraft;
