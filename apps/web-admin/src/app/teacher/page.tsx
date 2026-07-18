"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, BookOpen, PartyPopper, Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/components/teacher/types";

const ACCENT = "var(--color-auth-teacher)";

interface Teacher {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  avatarUrl?: string | null;
  department?: { id: string; name: string } | null;
}

interface Assignment {
  id: string;
  group: { id: string; _count: { members: number } } | null;
}

interface Club {
  id: string;
  isOwner: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <Card className="p-4 gap-1">
      <div className="flex items-center justify-between">
        <p className="text-metadata font-medium">{label}</p>
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${ACCENT}1a` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground mt-1">{value}</p>
    </Card>
  );
}

export default function TeacherOverviewPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/teacher/me").then((r) => r.json()),
      fetch("/api/teacher/clubs").then((r) => r.json()),
    ]).then(([meData, clubsData]) => {
      setTeacher(meData.teacher ?? null);
      setAssignments(meData.assignments ?? []);
      setClubs(clubsData.clubs ?? []);
      setLoading(false);
    });
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("Only PNG, JPEG or WebP images accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Photo must be under 2 MB.");
      return;
    }
    setAvatarError("");
    setUploadingAvatar(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/teacher/avatar", { method: "POST", body: form });
    const data = await res.json();
    setUploadingAvatar(false);
    if (res.ok && data.teacher) {
      setTeacher(data.teacher);
    } else {
      setAvatarError(data.error ?? "Upload failed.");
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  const studentsReached = assignments.reduce((sum, a) => sum + (a.group?._count.members ?? 0), 0);
  const myClubs = clubs.filter((c) => c.isOwner).length;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-title mb-4">My Profile</h2>
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <Avatar className="size-16">
              {teacher?.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt={teacher.fullName} />}
              <AvatarFallback className="text-lg font-semibold">{teacher ? initialsOf(teacher.fullName) : ""}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-background"
              style={{ backgroundColor: ACCENT }}
              title="Change photo"
            >
              {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex-1 min-w-0">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-metadata">Full Name</dt>
                <dd className="text-foreground font-medium">{teacher?.fullName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata">Email</dt>
                <dd className="text-foreground font-medium">{teacher?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata">Phone</dt>
                <dd className="text-foreground font-medium">{teacher?.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata">Department</dt>
                <dd className="text-foreground font-medium">{teacher?.department?.name ?? "Not assigned yet"}</dd>
              </div>
            </dl>
            {avatarError && <p className="text-destructive text-xs mt-2">{avatarError}</p>}
            <p className="text-metadata mt-3">Contact your institution admin to update your name, email, phone, or department.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Classes I Teach" value={assignments.length} icon={BookOpen} />
        <StatCard label="Students Reached" value={studentsReached} icon={Users} />
        <StatCard label="Clubs I Run" value={myClubs} icon={PartyPopper} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <a href="/teacher/academics">
          <Card className="p-4 gap-1 hover:shadow-soft-sm transition-all group" style={{ boxShadow: "none" }}>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ACCENT}1a` }}>
                <BookOpen className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="font-semibold text-foreground text-sm mt-2">Academics</p>
            <p className="text-metadata">Register modules, track rosters, send notices and assignments</p>
          </Card>
        </a>
        <a href="/teacher/clubs">
          <Card className="p-4 gap-1 hover:shadow-soft-sm transition-all group" style={{ boxShadow: "none" }}>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ACCENT}1a` }}>
                <PartyPopper className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="font-semibold text-foreground text-sm mt-2">Clubs</p>
            <p className="text-metadata">Create, monitor and manage student clubs</p>
          </Card>
        </a>
      </div>
    </div>
  );
}
