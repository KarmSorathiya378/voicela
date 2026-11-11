export interface DemoFile {
  id: string;
  name: string;
  path: string;
  type: "pdf" | "doc" | "sheet";
  modified: string;
  size: string;
  content: string;
  tags: string[];
}
export const demoFiles: DemoFile[] = [
  {
    id: "invoice",
    name: "Acme — October invoice.pdf",
    path: "Documents/Finance/2026",
    type: "pdf",
    modified: "2026-11-02",
    size: "148 KB",
    content:
      "ACME STUDIO\nInvoice INV-2026-104\nOctober design services\nTotal: ₹24,000\nPayment due: 15 November 2026",
    tags: ["invoice", "october", "acme", "finance"],
  },
  {
    id: "brief",
    name: "Website project brief.pdf",
    path: "Documents/Projects/Website",
    type: "pdf",
    modified: "2026-11-05",
    size: "286 KB",
    content:
      "Website refresh\nGoal: make the product easier to understand.\nDeliverables: homepage, demo, accessibility review.\nNext step: approve the content outline.",
    tags: ["brief", "website", "project", "pdf"],
  },
  {
    id: "notes",
    name: "Research notes.docx",
    path: "Documents/Research",
    type: "doc",
    modified: "2026-11-06",
    size: "32 KB",
    content:
      "Interview findings\nParticipants want clear permissions and an easy way to undo actions.\nNext session: test the calendar approval flow.",
    tags: ["research", "notes", "interview"],
  },
  {
    id: "budget",
    name: "Launch budget.xlsx",
    path: "Documents/Finance/2026",
    type: "sheet",
    modified: "2026-11-04",
    size: "54 KB",
    content:
      "Illustrative budget\nDesign: ₹24,000\nResearch: ₹12,000\nHosting: ₹4,000\nTotal: ₹40,000",
    tags: ["budget", "launch", "finance"],
  },
];
export const fileIntents = [
  "Find my October invoice",
  "Open the website project brief",
  "Find my research notes",
] as const;
export const fileErrors = {
  notFound: "No matching file in this demo. Try ‘October invoice’.",
  permissionDenied:
    "This folder is outside the demo's approved scope. Choose a sample document.",
};
export const mockFiles = demoFiles;
