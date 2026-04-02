type MenuEntry = { weight: number };

export const sortMenuEntries = (entries: MenuEntry[]): MenuEntry[] => {
  return [...entries].sort((a: MenuEntry, b: MenuEntry) => a.weight - b.weight);
};
