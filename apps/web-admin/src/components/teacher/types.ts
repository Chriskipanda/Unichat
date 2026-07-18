export interface RosterMember {
  id: string;
  fullName: string;
  studentId?: string | null;
  staffId?: string | null;
  role: string;
  avatarUrl?: string | null;
  roomRole: string;
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
