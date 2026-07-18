"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RosterMember, initialsOf } from "./types";

export function RoomRoster({ roomId }: { roomId: string }) {
  const [members, setMembers] = useState<RosterMember[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setMembers(null);
    fetch(`/api/teacher/rooms/${roomId}/members`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setMembers(d.members ?? []);
      })
      .catch(() => setError("Failed to load members."));
  }, [roomId]);

  if (error) return <p className="text-sm text-destructive text-center py-8">{error}</p>;
  if (!members) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>;
  }

  return (
    <div className="space-y-0.5">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar className="size-8">
            {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.fullName} />}
            <AvatarFallback className="text-xs font-semibold">{initialsOf(m.fullName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{m.fullName}</p>
            <p className="text-metadata">{m.studentId ?? m.staffId ?? "—"}</p>
          </div>
          {(m.roomRole === "owner" || m.role === "class_rep") && (
            <Badge className="bg-[var(--warning)]/10 text-[var(--warning)] shrink-0">
              {m.roomRole === "owner" ? "Owner" : "Class Rep"}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}
