"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RoomRoster } from "./RoomRoster";
import { RoomFeed } from "./RoomFeed";

/** The independent Roster/Assignments/Notices view for one room — each tab
 * pulls its own data scoped to that room, never mixed with any other class
 * or club. Shared by the Academics and Clubs detail panels. */
export function RoomDetailTabs({ roomId, refreshKey }: { roomId: string; refreshKey: number }) {
  const [tab, setTab] = useState("roster");

  return (
    <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
      <TabsList>
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="assignments">Assignments</TabsTrigger>
        <TabsTrigger value="notices">Notices</TabsTrigger>
      </TabsList>
      <TabsContent value="roster" className="pt-3">
        <RoomRoster roomId={roomId} />
      </TabsContent>
      <TabsContent value="assignments" className="pt-3">
        <RoomFeed roomId={roomId} type="assignment" refreshKey={refreshKey} />
      </TabsContent>
      <TabsContent value="notices" className="pt-3">
        <RoomFeed roomId={roomId} type="notice" refreshKey={refreshKey} />
      </TabsContent>
    </Tabs>
  );
}
