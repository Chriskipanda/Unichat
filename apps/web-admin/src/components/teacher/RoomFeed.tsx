"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone, ClipboardList, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ACCENT = "var(--color-auth-teacher)";

interface FeedMessage {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  senderName: string;
  timestamp: string;
  deleted: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Independent, room-scoped feed of either 'assignment' or 'notice' messages
 * — pulled via ?type= so it never mixes with the room's general chat. */
export function RoomFeed({ roomId, type, refreshKey }: { roomId: string; type: "assignment" | "notice"; refreshKey: number }) {
  const [messages, setMessages] = useState<FeedMessage[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setMessages(null);
    fetch(`/api/teacher/rooms/${roomId}/messages?type=${type}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setMessages((d.messages ?? []).filter((m: FeedMessage) => !m.deleted).reverse());
      })
      .catch(() => setError("Failed to load."));
  }, [roomId, type, refreshKey]);

  if (error) return <p className="text-sm text-destructive text-center py-8">{error}</p>;
  if (!messages) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
        {type === "assignment" ? <ClipboardList className="w-6 h-6 text-muted-foreground/50" /> : <Megaphone className="w-6 h-6 text-muted-foreground/50" />}
        No {type === "assignment" ? "assignments" : "notices"} sent to this room yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div key={m.id} className="border border-border rounded-lg p-3">
          {type === "assignment" && m.metadata?.title ? (
            <>
              <p className="text-sm font-semibold text-foreground">{String(m.metadata.title)}</p>
              {typeof m.metadata.instructions === "string" && m.metadata.instructions && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.metadata.instructions}</p>
              )}
              {typeof m.metadata.dueDate === "string" && m.metadata.dueDate && (
                <Badge className="mt-2 bg-[var(--warning)]/10 text-[var(--warning)]">
                  <CalendarClock className="w-3 h-3" />
                  Due {m.metadata.dueDate}
                </Badge>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap">{m.content}</p>
          )}
          <p className="text-metadata mt-2" style={{ color: ACCENT }}>
            {m.senderName} · {formatDate(m.timestamp)}
          </p>
        </div>
      ))}
    </div>
  );
}
