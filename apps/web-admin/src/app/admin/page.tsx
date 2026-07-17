"use client";

import { useEffect, useState } from "react";

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
  color: string;
}

function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div className={`rounded-xl p-5 text-white ${color}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

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
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{institutionName}</h2>
        <p className="text-gray-500 text-sm mt-1">Institution overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} color="bg-gradient-to-br from-indigo-600 to-indigo-950" />
        <StatCard label="Students" value={stats.students} color="bg-gradient-to-br from-blue-500 to-blue-900" />
        <StatCard label="Teachers" value={stats.teachers} color="bg-gradient-to-br from-violet-500 to-violet-900" />
        <StatCard label="Admins" value={stats.admins} color="bg-gradient-to-br from-indigo-400 to-indigo-800" />
        <StatCard label="Class Reps" value={stats.classReps} sub="students promoted via a teaching assignment" color="bg-gradient-to-br from-amber-500 to-amber-800" />
        <StatCard label="Teaching Assignments" value={stats.totalAssignments} sub="course + NTA level pairs" color="bg-gradient-to-br from-emerald-500 to-emerald-900" />
        <StatCard label="Programmes" value={stats.totalProgrammes} color="bg-gradient-to-br from-teal-500 to-teal-900" />
        <StatCard label="Departments" value={stats.totalDepartments} color="bg-gradient-to-br from-slate-600 to-slate-900" />
        <StatCard label="Clubs" value={stats.totalClubs} color="bg-gradient-to-br from-purple-500 to-purple-900" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/admin/users", label: "Manage Users", desc: "Add students, teachers & assign departments" },
          { href: "/admin/departments", label: "Departments", desc: "Faculties & departments" },
          { href: "/admin/courses", label: "Courses", desc: "Programme catalog" },
          { href: "/admin/assignments", label: "Assignments", desc: "Who teaches what, and Class Reps" },
          { href: "/admin/clubs", label: "Clubs", desc: "Student organizations" },
          { href: "/admin/branding", label: "Branding", desc: "Colours, logo, fonts" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="bg-white border border-indigo-100 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <p className="font-semibold text-gray-900 group-hover:text-indigo-700 text-sm">{link.label}</p>
            <p className="text-gray-400 text-xs mt-0.5">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
