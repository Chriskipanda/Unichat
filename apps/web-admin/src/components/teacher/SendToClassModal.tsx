"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const ACCENT = "var(--color-auth-teacher)";
const MAX_BYTES = 25 * 1024 * 1024;

export function SendToClassModal({
  roomId,
  roomName,
  onClose,
  onSent,
}: {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<"notice" | "assignment">("notice");

  // Notice
  const [content, setContent] = useState("");

  // Assignment
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("Attachment must be under 25 MB.");
      return;
    }
    setError("");
    setFile(f);
  }

  async function sendNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/teacher/rooms/${roomId}/notice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send notice.");
      return;
    }
    onSent();
    onClose();
  }

  async function sendAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSending(true);
    setError("");
    const form = new FormData();
    form.append("title", title.trim());
    if (instructions.trim()) form.append("instructions", instructions.trim());
    if (dueDate) form.append("dueDate", dueDate);
    if (file) form.append("file", file);
    const res = await fetch(`/api/teacher/rooms/${roomId}/assignment`, { method: "POST", body: form });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to post assignment.");
      return;
    }
    if (data.attachmentError) {
      setError(`Assignment posted, but the attachment failed: ${data.attachmentError}`);
      setTimeout(() => {
        onSent();
        onClose();
      }, 2500);
      return;
    }
    onSent();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Send to {roomName}</DialogTitle>
          <DialogDescription>Posts straight into this class&apos;s chat room.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => v && setMode(v as "notice" | "assignment")}>
          <TabsList className="w-full">
            <TabsTrigger value="notice" className="flex-1">
              Notice
            </TabsTrigger>
            <TabsTrigger value="assignment" className="flex-1">
              Assignment
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "notice" ? (
          <form onSubmit={sendNotice} className="space-y-4">
            <div>
              <Label className="mb-1.5">Message</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="e.g. Class moved to Room 12 this week."
                rows={4}
                className="resize-none"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={sending} className="flex-1" style={{ backgroundColor: ACCENT }}>
                {sending && <Loader2 className="animate-spin" />}
                {sending ? "Sending…" : "Send Notice"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={sendAssignment} className="space-y-4">
            <div>
              <Label className="mb-1.5">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Assignment 3 — ER Diagrams" required autoFocus />
            </div>
            <div>
              <Label className="mb-1.5">Instructions</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="What should students do?"
                rows={3}
                className="resize-none"
              />
            </div>
            <div>
              <Label className="mb-1.5">Due date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Attachment (optional)</Label>
              {file ? (
                <div className="flex items-center justify-between border border-input rounded-lg px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive shrink-0 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-3.5 h-3.5" />
                  Attach a file
                </Button>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={sending} className="flex-1" style={{ backgroundColor: ACCENT }}>
                {sending && <Loader2 className="animate-spin" />}
                {sending ? "Posting…" : "Post Assignment"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
