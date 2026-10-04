import type { ReactNode } from "react";

export type TableColumn<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "start" | "center" | "end";
};

export type DataTableProps<Row> = {
  caption: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  empty?: ReactNode;
};

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  empty = "No items.",
}: DataTableProps<Row>) {
  if (rows.length === 0) return <div className="nx-table-empty">{empty}</div>;

  return (
    <div className="nx-table-wrap">
      <table className="nx-table">
        <caption className="nx-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" data-align={column.align ?? "start"}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.id} data-align={column.align ?? "start"}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
