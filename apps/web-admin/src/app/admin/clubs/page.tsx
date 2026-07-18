"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Club {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  memberCount?: number;
}

interface ClubModalProps {
  club?: Club;
  onClose: () => void;
  onSaved: () => void;
}

function ClubModal({ club, onClose, onSaved }: ClubModalProps) {
  const isEdit = !!club;
  const [form, setForm] = useState({
    name: club?.name ?? "",
    description: club?.description ?? "",
    category: club?.category ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = isEdit
      ? await fetch(`/api/institution/clubs/${club!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/institution/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Club" : "Add Club"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <Label className="mb-1.5">Category</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Academic, Sports, Culture"
            />
          </div>
          <div>
            <Label className="mb-1.5">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="resize-none"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : isEdit ? "Save" : "Add Club"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_CLASS: Record<string, string> = {
  Academic: "bg-[var(--info)]/10 text-[var(--info)]",
  Sports: "bg-[var(--success)]/10 text-[var(--success)]",
  Culture: "bg-[var(--warning)]/10 text-[var(--warning)]",
  Technology: "bg-primary/10 text-primary",
  Arts: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
};

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Club | undefined>(undefined);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/clubs");
    const data = await res.json();
    setClubs(data.clubs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(club: Club) {
    await fetch(`/api/institution/clubs/${club.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !club.isActive }),
    });
    load();
  }

  async function deleteClub(id: string) {
    if (!confirm("Delete this club?")) return;
    await fetch(`/api/institution/clubs/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading">Clubs</h2>
          <p className="text-subtitle">{clubs.length} registered</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setShowModal(true);
          }}
        >
          <Plus />
          Add Club
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : clubs.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm">No clubs yet. Create your first student club.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <Card key={club.id} className={`p-5 gap-3 transition-all ${!club.isActive && "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground leading-tight">{club.name}</h3>
                {club.category && (
                  <Badge className={`shrink-0 ${CATEGORY_CLASS[club.category] ?? "bg-primary/10 text-primary"}`}>{club.category}</Badge>
                )}
              </div>
              {club.description && <p className="text-sm text-muted-foreground line-clamp-2">{club.description}</p>}
              <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border">
                <button onClick={() => toggleActive(club)}>
                  <Badge
                    className={club.isActive ? "bg-[var(--success)]/10 text-[var(--success)] cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                  >
                    {club.isActive ? "Active" : "Inactive"}
                  </Badge>
                </button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setEditing(club);
                    setShowModal(true);
                  }}
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteClub(club.id)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <ClubModal
          club={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(undefined);
          }}
          onSaved={load}
        />
      )}
    </div>
  );
}
