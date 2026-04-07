import * as React from "react"

import { cn } from "@/lib/utils"
import { getTableTheme, type TableDensity } from "@/components/ui/table-theme"

const TableDensityContext = React.createContext<TableDensity>("default")
const useTableDensity = (): TableDensity => React.useContext(TableDensityContext)

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  density?: TableDensity
}

const Table = React.forwardRef<
  HTMLTableElement,
  TableProps
>(({ className, density = "default", ...props }, ref) => {
  const theme = getTableTheme(density)

  return (
    <TableDensityContext.Provider value={density}>
      <div className={cn("relative w-full", theme.scroll)}>
        <table
          ref={ref}
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </TableDensityContext.Provider>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const theme = getTableTheme(useTableDensity())

  return (
    <thead
      ref={ref}
      className={cn(theme.head, "[&_tr]:border-b [&_tr]:border-slate-200", className)}
      {...props}
    />
  )
})
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => {
  const theme = getTableTheme(useTableDensity())

  return (
    <tr
      ref={ref}
      className={cn(
        `${theme.row} transition-colors ${theme.rowHover} data-[state=selected]:bg-brand-50`,
        className
      )}
      {...props}
    />
  )
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope, ...props }, ref) => {
  const theme = getTableTheme(useTableDensity())

  return (
    <th
      ref={ref}
      scope={scope ?? "col"}
      className={cn(
        `${theme.headCell} align-middle [&:has([role=checkbox])]:pr-0`,
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const theme = getTableTheme(useTableDensity())

  return (
    <td
      ref={ref}
      className={cn(`${theme.cell} align-middle [&:has([role=checkbox])]:pr-0`, className)}
      {...props}
    />
  )
})
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
