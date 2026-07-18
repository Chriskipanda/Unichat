"use client";

import { useEffect, useState } from "react";
import { Search, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Teacher {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

interface Cr {
  id: string;
  fullName: string;
  studentId?: string;
  phone?: string;
}

interface Assignment {
  id: string;
  ntaLevel: string;
  moduleName: string | null; // null only for rows created before this field existed
  teacher: Teacher;
  course: { id: string; name: string; department: { id: string; name: string } };
  cr: Cr | null;
  group: { id: string; name: string; _count: { members: number } } | null;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/assignments");
    const data = await res.json();
    setAssignments(data.assignments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeCr(id: string) {
    if (!confirm("Remove the Class Representative for this assignment?")) return;
    await fetch(`/api/institution/assignments/${id}/cr`, { method: "DELETE" });
    load();
  }

  async function removeAssignment(id: string) {
    if (
      !confirm(
        "Remove this teaching assignment? The teacher will need to re-add it, and its Class Rep (if any) loses that role unless they hold another assignment."
      )
    )
      return;
    await fetch(`/api/institution/assignments/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = assignments.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.teacher.fullName.toLowerCase().includes(q) ||
      a.moduleName?.toLowerCase().includes(q) ||
      a.course.name.toLowerCase().includes(q) ||
      a.course.department.name.toLowerCase().includes(q) ||
      a.ntaLevel.toLowerCase().includes(q) ||
      a.cr?.fullName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-heading">Teaching Assignments</h2>
        <p className="text-subtitle">Every teacher&apos;s registered course + NTA level, and who&apos;s Class Rep for it</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teacher, course, department, level, or CR…"
          className="pl-8"
        />
      </div>

      <Card className="p-0 overflow-hidden gap-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {assignments.length === 0
              ? "No teaching assignments yet — teachers register these from the Teacher Portal after logging in."
              : "No assignments match your search."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-table-header px-4">Teacher</TableHead>
                <TableHead className="text-table-header px-4">Module</TableHead>
                <TableHead className="text-table-header px-4 hidden lg:table-cell">Programme</TableHead>
                <TableHead className="text-table-header px-4 hidden md:table-cell">NTA Level</TableHead>
                <TableHead className="text-table-header px-4">Class Rep</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="align-top">
                  <TableCell className="px-4 py-3 whitespace-normal">
                    <p className="font-medium text-foreground text-sm">{a.teacher.fullName}</p>
                    <p className="text-metadata">{a.teacher.email || a.teacher.phone || "—"}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-normal">
                    <p className="text-foreground font-medium text-sm">
                      {a.moduleName ?? <span className="italic text-muted-foreground font-normal">Untitled module</span>}
                    </p>
                    <p className="text-metadata lg:hidden">{a.course.name}</p>
                    {a.group && <p className="text-xs mt-0.5" style={{ color: "var(--success)" }}>{a.group._count.members} in room</p>}
                    <p className="text-metadata md:hidden mt-0.5">{a.ntaLevel}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden lg:table-cell whitespace-normal">
                    <p className="text-foreground text-sm">{a.course.name}</p>
                    <p className="text-metadata">{a.course.department.name}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-table-cell hidden md:table-cell">{a.ntaLevel}</TableCell>
                  <TableCell className="px-4 py-3">
                    {a.cr ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[var(--warning)]/10 text-[var(--warning)]">{a.cr.fullName}</Badge>
                        <button onClick={() => removeCr(a.id)} className="text-xs text-muted-foreground hover:text-destructive" title="Remove Class Rep">
                          remove
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => removeAssignment(a.id)} title="Remove assignment">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
