"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CsvExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  columns: { key: keyof T; header: string }[];
  filename?: string;
  disabled?: boolean;
}

function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function CsvExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename = "export.csv",
  disabled = false,
}: CsvExportButtonProps<T>) {
  function handleExport() {
    if (!data.length) return;

    const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
    const rows = data.map((row) =>
      columns.map((c) => escapeCsvCell(row[c.key])).join(",")
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled || !data.length}
              onClick={handleExport}
            />
          }
        >
          <Download className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Export CSV</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
