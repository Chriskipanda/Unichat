"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, PartyPopper, Crown, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RoomMembersDialog } from "@/components/teacher/RoomMembersDialog";
import { SendToClassModal } from "@/components/teacher/SendToClassModal";

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
  const [rosterTarget, setRosterTarget] = useState<{ id: string; name: string } | null>(null);
  const [sendTarget, setSendTarget] = useState<{ id: string; name: string } | null>(null);

  async function loadClubs() {
    setClubsLoading(true);
    const res = await fetch("/api/teacher/clubs");
    const data = await res.json();
    setClubs(data.clubs ?? []);
    setClubsLoading(false);
  }

  useEffect(() => {
    loadClubs();
  }, []);

  async function deleteClub(id: string) {
    if (!confirm("Delete this club? This removes it for every member.")) return;
    await fetch(`/api/teacher/clubs/${id}`, { method: "DELETE" });
    loadClubs();
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-title">Clubs</h2>
            <p className="text-subtitle mt-0.5">Every club in your institution. Create one to open its chat room instantly.</p>
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
          <div className="grid sm:grid-cols-2 gap-3">
            {clubs.map((c) => (
              <div key={c.id} className="border border-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PartyPopper className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                    <p className="font-semibold text-foreground text-sm truncate">{c.name}</p>
                  </div>
                  {c.isOwner && (
                    <Badge className="bg-[var(--warning)]/10 text-[var(--warning)] shrink-0">
                      <Crown className="w-3 h-3" />
                      Yours
                    </Badge>
                  )}
                </div>
                {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                <div className="flex items-center justify-between mt-auto pt-2 flex-wrap gap-1">
                  <p className="text-metadata">
                    {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setSendTarget({ id: c.id, name: c.name })}>
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRosterTarget({ id: c.id, name: c.name })}>
                      <Eye className="w-3.5 h-3.5" />
                      Members
                    </Button>
                    {c.isOwner && (
                      <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteClub(c.id)} title="Delete club">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddClub && <AddClubModal onClose={() => setShowAddClub(false)} onCreated={loadClubs} />}
      {rosterTarget && (
        <RoomMembersDialog roomId={rosterTarget.id} roomName={rosterTarget.name} onClose={() => setRosterTarget(null)} />
      )}
      {sendTarget && (
        <SendToClassModal roomId={sendTarget.id} roomName={sendTarget.name} onClose={() => setSendTarget(null)} onSent={() => {}} />
      )}
    </div>
  );
}
