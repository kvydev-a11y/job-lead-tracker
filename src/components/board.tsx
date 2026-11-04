"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Users, Clock } from "lucide-react";
import {
  PIPELINE_STAGES,
  CLOSED_STAGES,
  STAGE_META,
  ROLE_TYPE_LABEL,
  type Stage,
  type RoleType,
} from "@/lib/enums";
import { updateStage } from "@/app/actions/applications";
import { cn } from "@/lib/utils";

export type AppCard = {
  id: string;
  company: string;
  role: string;
  roleType: RoleType;
  stage: Stage;
  appliedAt: string;
  contactCount: number;
  followUpDue: boolean;
};

function Card({ app, dragging }: { app: AppCard; dragging?: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
    data: { stage: app.stage },
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...listeners}
      {...attributes}
      onClick={() => router.push(`/applications/${app.id}`)}
      className={cn(
        "group cursor-grab touch-none rounded-xl border border-border bg-card p-3 shadow-sm transition active:cursor-grabbing",
        (isDragging || dragging) && "opacity-50",
        "hover:border-slate-300 dark:hover:border-slate-600",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">{app.company}</p>
        {app.followUpDue && (
          <span title="Follow-up due" className="flex items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
            <Clock className="h-3 w-3" />
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{app.role}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {ROLE_TYPE_LABEL[app.roleType]}
        </span>
        {app.contactCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <Users className="h-3 w-3" />
            {app.contactCount}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  stage,
  cards,
  activeStage,
}: {
  stage: Stage;
  cards: AppCard[];
  activeStage: Stage | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];
  const highlight = isOver && activeStage !== stage;

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{meta.label}</h3>
        <span className="text-xs text-slate-400">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 flex-1 flex-col gap-2 rounded-2xl border border-dashed p-2 transition-colors",
          highlight
            ? "border-slate-400 bg-slate-100/60 dark:border-slate-500 dark:bg-slate-800/40"
            : "border-border bg-slate-50/50 dark:bg-slate-900/30",
        )}
      >
        {cards.map((app) => (
          <Card key={app.id} app={app} />
        ))}
        {cards.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">Drop here</p>
        )}
      </div>
    </div>
  );
}

export function Board({ initial }: { initial: AppCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState<AppCard[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep local state in sync when server data changes (after router.refresh).
  const [snapshot, setSnapshot] = useState(initial);
  if (snapshot !== initial) {
    setSnapshot(initial);
    setCards(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeCard = cards.find((c) => c.id === activeId) ?? null;
  const activeStage = activeCard?.stage ?? null;

  function byStage(stage: Stage) {
    return cards.filter((c) => c.stage === stage);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const target = String(over.id) as Stage;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === target) return;

    // Optimistic move.
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: target } : c)));
    startTransition(async () => {
      const res = await updateStage(id, target);
      if (!res.ok) {
        // Roll back on failure.
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: card.stage } : c)));
      }
      router.refresh();
    });
  }

  const closedCards = CLOSED_STAGES.flatMap(byStage);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="board-scroll flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <Column key={stage} stage={stage} cards={byStage(stage)} activeStage={activeStage} />
        ))}
      </div>

      {closedCards.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Closed</h3>
          <div className="board-scroll flex gap-3 overflow-x-auto pb-2">
            {CLOSED_STAGES.map((stage) => (
              <Column key={stage} stage={stage} cards={byStage(stage)} activeStage={activeStage} />
            ))}
          </div>
        </div>
      )}

      <DragOverlay>{activeCard ? <Card app={activeCard} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
