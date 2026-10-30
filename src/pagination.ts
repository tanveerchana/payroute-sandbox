/** Produces the visible rows and their display range for a zero-based table page. */
export function paginate<T>(items: T[], requestedPage: number, pageSize: number) {
  const lastPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
  const page = Math.max(0, Math.min(requestedPage, lastPage));
  const rows = items.slice(page * pageSize, (page + 1) * pageSize);
  return {
    page,
    rows,
    start: rows.length ? page * pageSize + 1 : 0,
    end: Math.min((page + 1) * pageSize, items.length),
  };
}
