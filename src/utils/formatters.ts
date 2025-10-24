export const formatNumber = (num: string | number): string => {
  if (typeof num === 'string') return num;

  if (num >= 1000 && num < 1000000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US').format(num);
};
