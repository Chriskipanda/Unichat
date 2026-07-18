"use client";

import { useEffect, useState } from "react";
import { Plus, Upload, Building2, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Department {
  id: string;
  name: string;
}

interface Faculty {
  id: string;
  name: string;
  departments: Department[];
}

interface AddFacultyModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddFacultyModal({ onClose, onCreated }: AddFacultyModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "faculty", name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Faculty / School</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Faculty name" required />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AddDeptModalProps {
  facultyId: string;
  facultyName: string;
  onClose: () => void;
  onCreated: () => void;
}

function AddDeptModal({ facultyId, facultyName, onClose, onCreated }: AddDeptModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "department", facultyId, name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Department</DialogTitle>
          <DialogDescription>Under {facultyName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department name" required />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BulkImportResult {
  facultiesCreated: number;
  departmentsCreated: number;
  programmesCreated: number;
  programmesSkipped: number;
  errors: string[];
}

function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkImportResult | null>(null);

  async function handleImport() {
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [faculty, department, programmes] = line.split("|").map((p) => p?.trim() ?? "");
        return { faculty, department, programmes };
      });

    if (rows.length === 0) {
      setError("Paste at least one row first.");
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed.");
      return;
    }
    setResult(data);
    onImported();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import</DialogTitle>
          <DialogDescription>
            One row per line:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">Faculty | Department | Programme 1; Programme 2</code>.
            Existing faculties/departments/programmes are matched by name and skipped — safe to paste the same list twice.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={
            "Faculty of Computing and Information Technology | Department of Computer Science | Ordinary Diploma in Computer Science; Bachelor Degree in Computer Science\nFaculty of Computing and Information Technology | Department of Information Technology | Ordinary Diploma in Information Technology; Bachelor Degree in Information Technology"
          }
          className="font-mono text-xs"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        {result && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 text-sm space-y-1">
            <p className="font-medium text-foreground">Import complete</p>
            <p className="text-muted-foreground">Faculties created: {result.facultiesCreated}</p>
            <p className="text-muted-foreground">Departments created: {result.departmentsCreated}</p>
            <p className="text-muted-foreground">
              Programmes created: {result.programmesCreated} (skipped {result.programmesSkipped} already present)
            </p>
            {result.errors.length > 0 && (
              <div className="pt-2">
                <p className="text-destructive font-medium">{result.errors.length} row(s) had problems:</p>
                <ul className="list-disc list-inside text-destructive/80 text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button type="button" onClick={handleImport} disabled={saving} className="flex-1">
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Importing…" : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentsPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [addDeptFor, setAddDeptFor] = useState<Faculty | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/departments");
    const data = await res.json();
    setFaculties(data.faculties ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteFaculty(id: string) {
    if (!confirm("Delete this faculty and all its departments?")) return;
    await fetch(`/api/institution/faculties/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteDept(id: string) {
    if (!confirm("Delete this department?")) return;
    await fetch(`/api/institution/departments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-heading">Departments</h2>
          <p className="text-subtitle">Manage faculties and departments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            <Upload />
            Bulk Import
          </Button>
          <Button onClick={() => setShowAddFaculty(true)}>
            <Plus />
            Add Faculty
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : faculties.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm">
          No faculties yet. Add your first faculty to get started.
        </Card>
      ) : (
        <div className="space-y-4">
          {faculties.map((faculty) => (
            <Card key={faculty.id} className="p-0 overflow-hidden gap-0">
              <div className="flex items-center justify-between px-5 py-4 bg-muted/40 border-b border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground text-sm">{faculty.name}</span>
                  <span className="text-metadata ml-1">
                    {faculty.departments.length} dept{faculty.departments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setAddDeptFor(faculty)}>
                    <Plus className="w-3.5 h-3.5" />
                    Department
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteFaculty(faculty.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {faculty.departments.length === 0 ? (
                <p className="text-sm text-muted-foreground px-5 py-4">No departments yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {faculty.departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                        <span className="text-sm text-foreground">{dept.name}</span>
                      </div>
                      <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteDept(dept.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showAddFaculty && <AddFacultyModal onClose={() => setShowAddFaculty(false)} onCreated={load} />}
      {addDeptFor && (
        <AddDeptModal facultyId={addDeptFor.id} facultyName={addDeptFor.name} onClose={() => setAddDeptFor(null)} onCreated={load} />
      )}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onImported={load} />}
    </div>
  );
}
