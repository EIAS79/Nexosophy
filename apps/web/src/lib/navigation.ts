export const publicNavigation = [
  { href: "/features", label: "Product" },
  { href: "/students", label: "Use cases" },
  { href: "/templates", label: "Templates" },
  { href: "/security", label: "Security" },
  { href: "/pricing", label: "Pricing" },
] as const;

export const appNavigation = [
  { href: "/app", label: "Home", glyph: "H" },
  { href: "/app/workspace", label: "Workspace", glyph: "W" },
  { href: "/app/files", label: "Files", glyph: "F" },
  { href: "/app/notes", label: "Notes", glyph: "N" },
  { href: "/app/tasks", label: "Tasks", glyph: "T" },
  { href: "/app/calendar", label: "Calendar", glyph: "C" },
  { href: "/app/search", label: "Search", glyph: "S" },
  { href: "/app/inbox", label: "Inbox", glyph: "I" },
] as const;

export const mobileNavigation = appNavigation.slice(0, 5);
