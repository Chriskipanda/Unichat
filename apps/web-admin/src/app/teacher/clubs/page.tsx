"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, PartyPopper, Crown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SendToClassModal } from "@/components/teacher/SendToClassModal";
import { RoomDetailTabs } from "@/components/teacher/RoomDetailTabs";

const ACCENT = "var(--color-auth-teacher)";

interface Club {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isJoined: boolean;
  isOwner: boolean;
}

function AddClubModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/teacher/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create club.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Club</DialogTitle>
          <DialogDescription>You&apos;re automatically the owner and first member.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Debate Club" required autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this club about?"
              rows={3}
              className="resize-none"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1" style={{ backgroundColor: ACCENT }}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [showAddClub, setShowAddClub] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  async function loadClubs(preserveSelection = true) {
    setClubsLoading(true);
    const res = await fetch("/api/teacher/clubs");
    const data = await res.json();
    const list: Club[] = data.clubs ?? [];
    setClubs(list);
    setClubsLoading(false);
    if (!preserveSelection || !list.some((c) => c.id === selectedId)) {
      setSelectedId(list[0]?.id ?? "");
    }
  }

  useEffect(() => {
    loadClubs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteClub(id: string) {
    if (!confirm("Delete this club? This removes it for every member.")) return;
    await fetch(`/api/teacher/clubs/${id}`, { method: "DELETE" });
    loadClubs(false);
  }

  const selected = clubs.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-title">Clubs</h2>
            <p className="text-subtitle mt-0.5">
              Every club in your institution. Pick one below to see its members and what&apos;s been sent to it, independently of every
              other club.
            </p>
          </div>
          <Button onClick={() => setShowAddClub(true)} className="shrink-0" style={{ backgroundColor: ACCENT }}>
            <Plus />
            Create
          </Button>
        </div>

        {clubsLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No clubs yet. Create the first one for your institution.</div>
        ) : (
          <Select value={selectedId} onValueChange={(v) => v && setSelectedId(v)}>
            <SelectTrigger className="w-full sm:w-96">
              <SelectValue placeholder="Select a club…" />
            </SelectTrigger>
            <SelectContent>
              {clubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.isOwner ? "(yours)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Card>

      {selected && (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2 min-w-0">
              <PartyPopper className="w-5 h-5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{selected.name}</p>
                  {selected.isOwner && (
                    <Badge className="bg-[var(--warning)]/10 text-[var(--warning)]">
                      <Crown className="w-3 h-3" />
                      Yours
                    </Badge>
                  )}
                </div>
                {selected.description && <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>}
                <p className="text-metadata mt-1">
                  {selected.memberCount} member{selected.memberCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setSending(true)}>
                <Send className="w-3.5 h-3.5" />
                Send
              </Button>
              {selected.isOwner && (
                <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteClub(selected.id)} title="Delete club">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <RoomDetailTabs roomId={selected.id} refreshKey={refreshKey} />
          </div>
        </Card>
      )}

      {showAddClub && <AddClubModal onClose={() => setShowAddClub(false)} onCreated={() => loadClubs(false)} />}
      {sending && selected && (
        <SendToClassModal
          roomId={selected.id}
          roomName={selected.name}
          onClose={() => setSending(false)}
          onSent={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
