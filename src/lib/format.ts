export const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};
