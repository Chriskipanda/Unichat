"use client";

import { useEffect, useState } from "react";
import {
  Users,
  GraduationCap,
  Presentation,
  ShieldCheck,
  Award,
  ClipboardList,
  BookOpen,
  Building2,
  PartyPopper,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface Stats {
  totalUsers: number;
  students: number;
  teachers: number;
  classReps: number;
  admins: number;
  totalClubs: number;
  totalDepartments: number;
  totalProgrammes: number;
  totalAssignments: number;
}

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}

function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="p-4 gap-1">
      <div className="flex items-center justify-between">
        <p className="text-metadata font-medium">{label}</p>
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}1a` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground mt-1">{value}</p>
      {sub && <p className="text-metadata mt-0.5">{sub}</p>}
    </Card>
  );
}

const quickLinks = [
  { href: "/admin/users", label: "Manage Users", desc: "Add students, teachers & assign departments", icon: Users },
  { href: "/admin/departments", label: "Departments", desc: "Faculties & departments", icon: Building2 },
  { href: "/admin/courses", label: "Courses", desc: "Programme catalog", icon: BookOpen },
  { href: "/admin/assignments", label: "Assignments", desc: "Who teaches what, and Class Reps", icon: ClipboardList },
  { href: "/admin/clubs", label: "Clubs", desc: "Student organizations", icon: PartyPopper },
  { href: "/admin/branding", label: "Branding", desc: "Colours, logo, fonts", icon: GraduationCap },
];

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [institutionName, setInstitutionName] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/institution/me").then((r) => r.json()),
      fetch("/api/institution/users").then((r) => r.json()),
      fetch("/api/institution/clubs").then((r) => r.json()),
      fetch("/api/institution/departments").then((r) => r.json()),
      fetch("/api/institution/courses").then((r) => r.json()),
      fetch("/api/institution/assignments").then((r) => r.json()),
    ]).then(([meData, usersData, clubsData, deptsData, coursesData, assignmentsData]) => {
      if (meData.institution?.name) setInstitutionName(meData.institution.name);
      const users: { role: string }[] = usersData.users ?? [];
      const deptCount = (deptsData.faculties ?? []).reduce(
        (acc: number, f: { departments: unknown[] }) => acc + (f.departments?.length ?? 0),
        0
      );
      setStats({
        totalUsers: users.length,
        students: users.filter((u) => u.role === "student").length,
        teachers: users.filter((u) => u.role === "teacher" || u.role === "staff").length,
        classReps: users.filter((u) => u.role === "class_rep").length,
        admins: users.filter((u) => u.role === "admin").length,
        totalClubs: clubsData.clubs?.length ?? 0,
        totalDepartments: deptCount,
        totalProgrammes: coursesData.courses?.length ?? 0,
        totalAssignments: assignmentsData.assignments?.length ?? 0,
      });
    });
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading">{institutionName}</h2>
        <p className="text-subtitle mt-1">Institution overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="var(--chart-1)" />
        <StatCard label="Students" value={stats.students} icon={GraduationCap} color="var(--chart-2)" />
        <StatCard label="Teachers" value={stats.teachers} icon={Presentation} color="var(--chart-3)" />
        <StatCard label="Admins" value={stats.admins} icon={ShieldCheck} color="var(--chart-1)" />
        <StatCard
          label="Class Reps"
          value={stats.classReps}
          sub="students promoted via a teaching assignment"
          icon={Award}
          color="var(--chart-4)"
        />
        <StatCard
          label="Teaching Assignments"
          value={stats.totalAssignments}
          sub="course + NTA level pairs"
          icon={ClipboardList}
          color="var(--chart-3)"
        />
        <StatCard label="Programmes" value={stats.totalProgrammes} icon={BookOpen} color="var(--chart-2)" />
        <StatCard label="Departments" value={stats.totalDepartments} icon={Building2} color="var(--muted-foreground)" />
        <StatCard label="Clubs" value={stats.totalClubs} icon={PartyPopper} color="var(--chart-5)" />
      </div>

      <div>
        <h3 className="text-title mb-3">Quick links</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a key={link.href} href={link.href}>
                <Card className="p-4 gap-1 hover:ring-primary/30 hover:shadow-soft-sm transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="font-semibold text-foreground text-sm mt-2">{link.label}</p>
                  <p className="text-metadata">{link.desc}</p>
                </Card>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
