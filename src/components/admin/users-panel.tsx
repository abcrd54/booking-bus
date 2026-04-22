import type { ApiProfile } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "./empty-state";

export function UsersPanel({ users }: { users: ApiProfile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data user</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {users.length === 0 ? <EmptyState text="Belum ada user." /> : null}
        {users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{user.id.slice(0, 8)}</Badge>
                <Badge variant={user.role === "admin" ? "warning" : "default"}>{user.role}</Badge>
              </div>
              <h3 className="mt-2 font-bold">{user.name || "-"}</h3>
              <p className="text-sm text-slate-600">{user.email} - {user.phone || "-"}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
