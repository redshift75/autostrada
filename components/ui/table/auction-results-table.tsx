"use client"

import Image from "next/image"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable, createSortableHeader } from "./data-table"
import { formatPrice } from "@/lib/utils/index"

// Define the type for auction results
export type AuctionResult = {
  title: string
  sold_price: string
  bid_amount: string
  end_date: string
  status: string
  url: string
  image_url?: string
  make?: string
  model?: string
  mileage?: number
  bidders?: number
  watchers?: number
  comments?: number
  transmission?: string
  price?: number
  [key: string]: any
}

interface AuctionResultsTableProps {
  results: AuctionResult[]
  className?: string
}

export function AuctionResultsTable({ results, className }: AuctionResultsTableProps) {
  // Define columns for the auction results
  const columns: ColumnDef<AuctionResult>[] = [
    {
      accessorKey: "image",
      header: "Image",
      cell: ({ row }) => {
        const result = row.original
        return (
          <div className="relative w-16 h-16 bg-gray-200 rounded-md overflow-hidden">
            {result.image_url && (
              <Image
                src={result.image_url}
                alt={result.title || "Auction item"}
                fill
                sizes="64px"
                className="object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "/placeholder-car.jpg"
                }}
              />
            )}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: createSortableHeader("Title"),
      cell: ({ row }) => {
        const result = row.original
        return (
          <div className="max-w-[200px] wrap">
            {result.url ? (
              <a 
                href={result.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {result.title}
              </a>
            ) : (
              result.title
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "price",
      header: createSortableHeader("Price"),
      cell: ({ row }) => {
        const result = row.original
        const price = result.sold_price || result.bid_amount || (result.price ? `$${result.price.toLocaleString()}` : "-")
        return (
          <span className={result.status === "sold" ? "text-green-600 font-medium" : ""}>
            {formatPrice(price.toString())}
          </span>
        )
      },
      sortingFn: (rowA, rowB) => {
        // Extract price values for comparison
        const getPrice = (row: any): number => {
          const result = row.original
          if (result.price) return result.price
          
          const soldPrice = parseFloat(result.sold_price?.replace(/[^0-9.]/g, '') || '0')
          const bidAmount = parseFloat(result.bid_amount?.replace(/[^0-9.]/g, '') || '0')
          return soldPrice || bidAmount || 0
        }
        
        return getPrice(rowA) - getPrice(rowB)
      },
    },
    {
      accessorKey: "end_date",
      header: createSortableHeader("Date"),
      cell: ({ row }) => {
        const result = row.original
        return result.end_date ? 
          new Date(result.end_date).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          }) : "-"
      },
    },
    {
      accessorKey: "mileage",
      header: createSortableHeader("Mileage"),
      cell: ({ row }) => {
        const mileage = row.original.mileage
        return mileage ? `${mileage.toLocaleString()} mi` : "-"
      },
    },
    {
      accessorKey: "status",
      header: createSortableHeader("Status"),
      cell: ({ row }) => {
        const status = row.original.status || (row.original.sold_price ? "sold" : "not sold")
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
            status === "sold" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }`}>
            {status === "sold" ? "Sold" : "Not Sold"}
          </span>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={results}
      className={className}
    />
  )
} 