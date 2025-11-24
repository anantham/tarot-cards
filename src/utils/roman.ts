export function toRoman(num: number): string {
  if (num <= 0) return '0';
  const numerals: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [8, 'VIII'],
    [7, 'VII'],
    [6, 'VI'],
    [5, 'V'],
    [4, 'IV'],
    [3, 'III'],
    [2, 'II'],
    [1, 'I'],
  ];
  let n = num;
  let res = '';
  for (const [value, sym] of numerals) {
    while (n >= value) {
      res += sym;
      n -= value;
    }
  }
  return res;
}
