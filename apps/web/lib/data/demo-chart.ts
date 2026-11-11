export interface DemoChartPoint {
  month: string;
  value: number;
}
export const demoChart: DemoChartPoint[] = [
  { month: "Jun", value: 24 },
  { month: "Jul", value: 29 },
  { month: "Aug", value: 27 },
  { month: "Sep", value: 36 },
  { month: "Oct", value: 42 },
];
export const screenContext = {
  title: "Completed projects",
  unit: "projects",
  source: "Illustrative team report",
  scope: "Selected chart only",
  selectedText:
    "The team completed 42 projects in October, compared with 36 in September.",
  summary:
    "Completed projects increased from 36 in September to 42 in October: 6 more projects, a 16.7% increase. August was the only month with a decline in this sample.",
  disclosure:
    "Seeded demo data. No real screen capture or product performance metrics.",
} as const;
export const mockChart = demoChart;
export const demoChartData = demoChart;
