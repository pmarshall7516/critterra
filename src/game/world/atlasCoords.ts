/**
 * Single source of truth for converting between atlas index and (column, row)
 * so the map editor and game runtime sample the same tile from a tileset image.
 * Convention: row-major layout. Index 0 = (0,0), index 1 = (1,0), ...
 * So: column = index % columns, row = floor(index / columns).
 */
export function atlasIndexToColumnRow(
  atlasIndex: number,
  columns: number,
): { column: number; row: number } {
  if (columns <= 0) {
    return { column: 0, row: 0 };
  }
  const column = atlasIndex % columns;
  const row = Math.floor(atlasIndex / columns);
  return { column, row };
}

export function columnRowToAtlasIndex(column: number, row: number, columns: number): number {
  if (columns <= 0) {
    return 0;
  }
  return row * columns + column;
}
