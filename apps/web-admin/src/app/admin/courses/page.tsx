"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Department {
  id: string;
  name: string;
}

interface Faculty {
  id: string;
  name: string;
  departments: Department[];
}

interface Course {
  id: string;
  name: string;
  department: Department;
}

function AddCourseModal({
  departments,
  onClose,
  onCreated,
}: {
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, departmentId }),
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
          <DialogTitle>Add Course</DialogTitle>
        </DialogHeader>
        {departments.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">Add a department first — courses belong to a department.</p>
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Course name, e.g. Bachelor Degree in Computer Science"
              required
            />
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department…" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !departmentId} className="flex-1">
                {saving && <Loader2 className="animate-spin" />}
                {saving ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const [coursesRes, deptRes] = await Promise.all([fetch("/api/institution/courses"), fetch("/api/institution/departments")]);
    const coursesData = await coursesRes.json();
    const deptData = await deptRes.json();
    setCourses(coursesData.courses ?? []);
    const flatDepartments = ((deptData.faculties ?? []) as Faculty[]).flatMap((f) => f.departments);
    setDepartments(flatDepartments);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteCourse(id: string) {
    if (!confirm("Delete this course? Teachers with an assignment for it will keep it, but new assignments can't reference it.")) return;
    await fetch(`/api/institution/courses/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading">Courses</h2>
          <p className="text-subtitle">Catalog teachers pick from when registering what they teach</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus />
          Add Course
        </Button>
      </div>

      <Card className="p-0 overflow-hidden gap-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No courses yet. Add your first course to get started.</div>
        ) : (
          <div className="divide-y divide-border">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-metadata">{c.department.name}</p>
                </div>
                <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteCourse(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAdd && <AddCourseModal departments={departments} onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  );
}
