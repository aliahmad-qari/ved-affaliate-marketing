export const monthlyLeaderboardTableLayout = {
  table: 'w-full table-fixed text-left text-[11px] leading-4 sm:text-sm',
  columnWidths: ['w-[9%]', 'w-[36%]', 'w-[25%]', 'w-[30%]'] as const,
  cell: 'break-words px-1.5 py-2 sm:px-3 sm:py-3',
  partnerCell: '[overflow-wrap:anywhere] px-1.5 py-2 sm:px-3 sm:py-3',
  header: 'break-words px-1.5 py-2 sm:px-3 sm:py-3',
} as const;
