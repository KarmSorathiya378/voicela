export interface DemoContact {
  id: string;
  name: string;
  email: string;
}
export interface DemoCalendarEvent {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  attendees: string[];
}
export const demoContacts: DemoContact[] = [
  { id: "maya", name: "Maya Rao", email: "maya@example.com" },
  { id: "jules", name: "Jules Chen", email: "jules@example.com" },
];
export const demoCalendar: DemoCalendarEvent[] = [
  {
    id: "standup",
    title: "Team check-in",
    date: "2026-11-12",
    start: "09:30",
    end: "10:00",
    attendees: ["jules@example.com"],
  },
  {
    id: "conflict",
    title: "Research review",
    date: "2026-11-12",
    start: "14:00",
    end: "14:30",
    attendees: ["jules@example.com"],
  },
];
export const seededConflict = demoCalendar[1];
export const proposedMeeting: DemoCalendarEvent = {
  id: "website-review",
  title: "Website review with Maya",
  date: "2026-11-12",
  start: "14:30",
  end: "15:00",
  attendees: ["maya@example.com"],
};
export const calendarContext = {
  timezone: "Asia/Kolkata",
  dateLabel: "Thursday, 12 November",
  requestedStart: "14:00",
  alternativeStart: "14:30",
  simulation: true,
} as const;
export const mockCalendar = demoCalendar;
export const mockContacts = demoContacts;
