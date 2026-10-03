// The "blank page" the app has learned: where things are on the Buku KIA growth table (0-24 months),
// written down once as data, so the reader does not look for handwriting anywhere else.
// A different form would get a different template (one reader, many forms).
export const TEMPLATE = {
  id: 'buku-kia-growth-0-24',
  title: 'Tabel Pertumbuhan Anak Usia 0-2 Tahun',
  // printed words used as position markers
  headerWords: { actual: 'aktual', ideal: 'ideal', month: 'bulan' },
  // the four handwriting ("Aktual") columns, left to right
  columns: ['L-weight', 'L-length', 'P-weight', 'P-length'],
  sexBlocks: { L: ['L-weight', 'L-length'], P: ['P-weight', 'P-length'] },
  months: [0, 24],
  kinds: {
    weight: { unit: 'kg', range: [1, 25], label: 'Berat badan' },     // UPDATE ME: same limits as the calculator
    length: { unit: 'cm', range: [40, 100], label: 'Panjang badan' },
  },
  // size of the area read inside a cell, as a share of the page's own measurements
  cell: { widthOfPairGap: 0.7, heightOfRowSpacing: 0.8 },
};
export const kindOfColumn = (column) => (column.endsWith('weight') ? 'weight' : 'length');
