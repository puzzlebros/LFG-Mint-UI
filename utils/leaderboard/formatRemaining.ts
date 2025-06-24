// utils/formatRemaining.ts
export function formatRemaining(ms: number): string {
  const MS_PER_DAY  = 24 * 60 * 60 * 1000;
  if (ms >= MS_PER_DAY) {
    const days = Math.ceil(ms / MS_PER_DAY);
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else {
    const hrs  = Math.floor(ms / (60 * 60 * 1000));
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return hrs > 0
      ? `${hrs}h ${mins}m`
      : `${mins}m`;
  }
}
