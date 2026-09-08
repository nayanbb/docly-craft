// Mock data only. Replace with real backend data in a later stage.

export const mockUser = {
  name: "Nayan",
  plan: "Free",
  email: "nayan@docly.app",
};

export const mockRecentTools = [
  { id: "merge-pdf", usedAt: "2 hours ago" },
  { id: "compress-pdf", usedAt: "Yesterday" },
  { id: "pdf-to-word", usedAt: "2 days ago" },
  { id: "image-resizer", usedAt: "Last week" },
];

export const mockFavoriteTools = ["merge-pdf", "pdf-to-jpg", "passport-photo", "image-compressor"];

export const mockRecentFiles = [
  { id: "f1", name: "Quarterly-Report.pdf", size: "2.4 MB", tool: "Compress PDF", date: "Today" },
  { id: "f2", name: "Contract-Signed.pdf", size: "812 KB", tool: "Merge PDF", date: "Today" },
  { id: "f3", name: "Invoice-2026-04.pdf", size: "146 KB", tool: "PDF to Word", date: "Yesterday" },
  { id: "f4", name: "team-photo.jpg", size: "3.1 MB", tool: "Compress Image", date: "3 days ago" },
];

export const mockUsage = [
  { label: "Files processed", value: "128", detail: "this month" },
  { label: "Storage saved", value: "1.9 GB", detail: "through compression" },
  { label: "AI operations", value: "12 / 20", detail: "free plan limit" },
  { label: "Average time", value: "3.4s", detail: "per operation" },
];

export const mockWeeklyActivity = [
  { day: "Mon", count: 6 },
  { day: "Tue", count: 11 },
  { day: "Wed", count: 4 },
  { day: "Thu", count: 14 },
  { day: "Fri", count: 9 },
  { day: "Sat", count: 2 },
  { day: "Sun", count: 5 },
];
