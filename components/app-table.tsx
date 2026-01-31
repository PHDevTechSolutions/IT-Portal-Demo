"use client"

import React, { useEffect, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AppCommandModal } from "./app-command-modal"
import {
  IconGripVertical,
  IconStar,
  IconStarFilled,
  IconFilter,
} from "@tabler/icons-react"

interface AppTableProps {
  items: { id: number; title: string; description: string; status?: string }[]
}

// 🔹 Drag handle for each row
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:bg-muted/10 cursor-grab"
    >
      <IconGripVertical className="size-4" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

// 🔹 Draggable TableRow
function DraggableRow({
  item,
  children,
}: {
  item: AppTableProps["items"][number]
  children: React.ReactNode
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <TableRow
      ref={setNodeRef}
      data-dragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 hover:bg-muted/5"
    >
      {children}
    </TableRow>
  )
}

export const AppTable: React.FC<AppTableProps> = ({ items }) => {
  const [mounted, setMounted] = useState(false) // 🩹 fix hydration warning
  const [tableData, setTableData] = useState(items)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [favorites, setFavorites] = useState<number[]>([])
  const [showFavorites, setShowFavorites] = useState(false)

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  )

  // 🧠 Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // 🧠 Load from localStorage
  useEffect(() => {
    if (!mounted) return

    const savedFavs = localStorage.getItem("appTable_favorites")
    const savedOrder = localStorage.getItem("appTable_order")
    const savedFilter = localStorage.getItem("appTable_showFavorites")

    let updated = [...items]
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder)
        const validOrder = parsedOrder.filter((p: any) =>
          items.some((i) => i.id === p.id)
        )
        updated = validOrder.length ? validOrder : items
      } catch {
        updated = items
      }
    }

    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs))
      } catch {
        setFavorites([])
      }
    }

    if (savedFilter === "true") setShowFavorites(true)

    setTableData(updated)
  }, [mounted, items])

  // 💾 Save favorites, order, and filter
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("appTable_favorites", JSON.stringify(favorites))
  }, [favorites, mounted])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("appTable_order", JSON.stringify(tableData))
  }, [tableData, mounted])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("appTable_showFavorites", showFavorites.toString())
  }, [showFavorites, mounted])

  // 🧠 Handle drag reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = tableData.findIndex((i) => i.id === active.id)
      const newIndex = tableData.findIndex((i) => i.id === over?.id)
      setTableData(arrayMove(tableData, oldIndex, newIndex))
    }
  }

  // 🧩 Selection logic
  const toggleRow = (id: number) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  const allSelected = tableData.length > 0 && selectedRows.length === tableData.length
  const someSelected = selectedRows.length > 0 && !allSelected

  // ⭐ Add selected items to favorites
  const addToFavorites = () => {
    const updated = Array.from(new Set([...favorites, ...selectedRows]))

    // Move favorites to top
    const sorted = [...tableData].sort((a, b) => {
      const aFav = updated.includes(a.id)
      const bFav = updated.includes(b.id)
      return aFav === bFav ? 0 : aFav ? -1 : 1
    })

    setFavorites(updated)
    setTableData(sorted)
    setSelectedRows([])
  }

  // ⭐ Toggle favorite per item
  const toggleFavorite = (id: number) => {
    let updated: number[]
    if (favorites.includes(id)) {
      updated = favorites.filter((f) => f !== id)
    } else {
      updated = [...favorites, id]
    }

    // Move favorites to top
    const sorted = [...tableData].sort((a, b) => {
      const aFav = updated.includes(a.id)
      const bFav = updated.includes(b.id)
      return aFav === bFav ? 0 : aFav ? -1 : 1
    })

    setFavorites(updated)
    setTableData(sorted)
  }

  // 🔍 Filter logic
  const visibleData = showFavorites
    ? tableData.filter((i) => favorites.includes(i.id))
    : tableData

  if (!mounted) return null // 🩹 Prevent SSR hydration mismatch

  return (
    <div className="overflow-auto rounded-lg border border-border shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={() => {
              if (allSelected) setSelectedRows([])
              else setSelectedRows(tableData.map((i) => i.id))
            }}
          />
          <span className="text-sm text-muted-foreground">Select All</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedRows.length === 0}
            onClick={addToFavorites}
          >
            <IconStarFilled className="mr-1 size-4" />
            Add to Favorites
          </Button>

          <Button
            size="sm"
            variant={showFavorites ? "default" : "outline"}
            onClick={() => setShowFavorites((v) => !v)}
          >
            <IconFilter className="mr-1 size-4" />
            {showFavorites ? "Show All" : "Show Favorites"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-10 text-center bg-muted"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <SortableContext
              items={visibleData.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleData.map((item) => {
                const appName = item.title.split(" -")[0]
                const isFav = favorites.includes(item.id)
                return (
                  <DraggableRow key={item.id} item={item}>
                    <TableCell>
                      <DragHandle id={item.id} />
                    </TableCell>

                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedRows.includes(item.id)}
                        onCheckedChange={() => toggleRow(item.id)}
                      />
                    </TableCell>

                    <TableCell className="font-medium flex items-center gap-2">
                      {item.title}
                      {isFav && (
                        <IconStarFilled className="size-4 text-yellow-500" />
                      )}
                    </TableCell>

                    <TableCell>{item.description}</TableCell>

                    <TableCell className="text-right flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleFavorite(item.id)}
                        title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {isFav ? (
                          <IconStarFilled className="size-4 text-yellow-500" />
                        ) : (
                          <IconStar className="size-4" />
                        )}
                      </Button>

                      <AppCommandModal
                        appName={appName}
                        trigger={
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        }
                      />
                    </TableCell>
                  </DraggableRow>
                )
              })}
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>
    </div>
  )
}
