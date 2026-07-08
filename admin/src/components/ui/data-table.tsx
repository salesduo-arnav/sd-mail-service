import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    PaginationState,
    OnChangeFn,
    Column,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Inbox, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"

// ============================================================================
// EXPORTED HELPER COMPONENTS - Use these to build your columns easily
// ============================================================================

/**
 * Sortable column header component
 * Use this in your column definition's header prop for sortable columns
 * 
 * @example
 * header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />
 */
interface DataTableColumnHeaderProps<TData, TValue> {
    column: Column<TData, TValue>
    title: string
    className?: string
}

export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    if (!column.getCanSort()) {
        return <span className={cn("text-xs font-semibold uppercase tracking-wide", className)}>{title}</span>
    }

    const sorted = column.getIsSorted()

    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(sorted === "asc")}
            className={cn("-ml-4 h-8 text-xs font-semibold uppercase tracking-wide hover:bg-transparent hover:text-muted-foreground group flex items-center", className)}
        >
            {title}
            <span className="opacity-50 group-hover:opacity-100">
                {sorted === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                ) : sorted === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                ) : (
                    <ArrowUpDown className="h-3.5 w-3.5" />
                )}
            </span>
        </Button>
    )
}

/**
 * Non-sortable column header component
 * Use this for columns that don't need sorting
 * 
 * @example
 * header: () => <DataTableStaticHeader title="Status" />
 */
interface DataTableStaticHeaderProps {
    title: string
    className?: string
    srOnly?: boolean
}

export function DataTableStaticHeader({ title, className, srOnly = false }: DataTableStaticHeaderProps) {
    if (srOnly) {
        return <span className="sr-only">{title}</span>
    }
    return <span className={cn("text-xs font-semibold uppercase tracking-wide hover:text-muted-foreground", className)}>{title}</span>
}

// ============================================================================
// MAIN DATA TABLE COMPONENT
// ============================================================================

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    pageCount: number
    pagination: PaginationState
    onPaginationChange: OnChangeFn<PaginationState>
    sorting: SortingState
    onSortingChange: OnChangeFn<SortingState>
    searchQuery: string
    onSearchChange: (value: string) => void
    placeholder?: string
    isLoading?: boolean
}

// Skeleton row component for loading state
function TableRowSkeleton({ columns }: { columns: number }) {
    return (
        <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, i) => (
                <TableCell key={i} className="first:pl-4 last:pr-4">
                    <div className="h-4 w-full max-w-[180px] animate-pulse rounded bg-muted/70" />
                </TableCell>
            ))}
        </TableRow>
    )
}

export function DataTable<TData, TValue>({
    columns,
    data,
    pageCount,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    searchQuery,
    onSearchChange,
    placeholder = "Search...",
    isLoading = false,
}: DataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        pageCount,
        state: {
            pagination,
            sorting,
        },
        onPaginationChange,
        onSortingChange,
        manualPagination: true,
        manualSorting: true,
        getCoreRowModel: getCoreRowModel(),
    })

    const [localQuery, setLocalQuery] = React.useState(searchQuery)
    const debouncedLocalQuery = useDebounce(localQuery)

    React.useEffect(() => {
        setLocalQuery(searchQuery)
    }, [searchQuery])

    React.useEffect(() => {
        if (debouncedLocalQuery !== searchQuery) {
            onSearchChange(debouncedLocalQuery)
        }
    }, [debouncedLocalQuery, onSearchChange, searchQuery])

    return (
        <div className="w-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 border-b bg-muted/30 px-4 py-3">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                    <Input
                        placeholder={placeholder}
                        value={localQuery}
                        onChange={(event) => setLocalQuery(event.target.value)}
                        className="pl-9 h-9 bg-background border-muted-foreground/20 focus:border-primary/50 transition-colors"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="hidden sm:inline">Rows per page:</span>
                    <Select
                        value={`${pagination.pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value))
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px] bg-background">
                            <SelectValue placeholder={pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="end">
                            {[10, 20, 30, 40, 50, 100, 500, 1000].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table with loading overlay */}
            <div className="relative min-h-[300px]">
                {/* Loading Overlay */}
                <div
                    className={cn(
                        "absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] transition-all duration-300",
                        isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                >
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                            <Loader2 className="h-8 w-8 text-primary animate-spin relative" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
                    </div>
                </div>

                {/* Table Content */}
                <div className={cn(
                    "transition-opacity duration-200",
                    isLoading && data.length === 0 ? "opacity-50" : "opacity-100"
                )}>
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40 border-b-0">
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 first:pl-4 last:pr-4"
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoading && data.length === 0 ? (
                                // Initial loading skeleton when no data yet
                                Array.from({ length: Math.min(pagination.pageSize, 5) }).map((_, i) => (
                                    <TableRowSkeleton key={i} columns={columns.length} />
                                ))
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row, index) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={cn(
                                            "transition-all duration-150 border-b border-muted/50",
                                            index % 2 === 0 ? "bg-background" : "bg-muted/10",
                                            "hover:bg-primary/5"
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="first:pl-4 last:pr-4 py-3">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-40"
                                    >
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="rounded-full bg-muted/50 p-4 mb-3">
                                                <Inbox className="h-8 w-8 text-muted-foreground/50" />
                                            </div>
                                            <p className="text-muted-foreground font-medium">No results found</p>
                                            <p className="text-sm text-muted-foreground/70 mt-1">
                                                Try adjusting your search or filters
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                    {!isLoading && data.length > 0 && (
                        <>
                            Showing{" "}
                            <span className="font-medium text-foreground">
                                {pagination.pageIndex * pagination.pageSize + 1}
                            </span>
                            {" "}-{" "}
                            <span className="font-medium text-foreground">
                                {Math.min((pagination.pageIndex + 1) * pagination.pageSize, pagination.pageIndex * pagination.pageSize + data.length)}
                            </span>
                            {" "}results
                        </>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hidden lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage() || isLoading}
                    >
                        <span className="sr-only">Go to first page</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage() || isLoading}
                    >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page indicator */}
                    <div className="flex items-center gap-1 mx-2">
                        <span className="inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-md bg-primary/10 text-primary text-sm font-medium">
                            {table.getState().pagination.pageIndex + 1}
                        </span>
                        <span className="text-muted-foreground text-sm">/</span>
                        <span className="text-sm text-muted-foreground">
                            {table.getPageCount() || 1}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage() || isLoading}
                    >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hidden lg:flex"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage() || isLoading}
                    >
                        <span className="sr-only">Go to last page</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
