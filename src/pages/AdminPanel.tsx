import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, UserPlus, Users, Activity } from "lucide-react";
import { KPICard } from "@/components/KPICard";

const mockUsers = [
  { id: "1", name: "Kwame Asante", email: "k.asante@npa.gov.gh", role: "Collector", department: "Field Operations", status: "Active", lastLogin: "2026-03-11" },
  { id: "2", name: "Ama Mensah", email: "a.mensah@npa.gov.gh", role: "Analyst", department: "Safety & Compliance", status: "Active", lastLogin: "2026-03-10" },
  { id: "3", name: "Kofi Owusu", email: "k.owusu@npa.gov.gh", role: "Collector", department: "Field Operations", status: "Active", lastLogin: "2026-03-09" },
  { id: "4", name: "Grace Appiah", email: "g.appiah@npa.gov.gh", role: "Analyst", department: "Transport Safety", status: "Inactive", lastLogin: "2026-02-28" },
  { id: "5", name: "Ibrahim Yakubu", email: "i.yakubu@npa.gov.gh", role: "Collector", department: "Field Operations", status: "Pending", lastLogin: "—" },
];

const roleClass: Record<string, string> = {
  Admin: "bg-destructive/15 text-destructive",
  Analyst: "bg-chart-purple/15 text-chart-purple",
  Collector: "bg-info/15 text-info",
};

const statusClass: Record<string, string> = {
  Active: "bg-success/15 text-success",
  Inactive: "bg-secondary text-muted-foreground",
  Pending: "bg-warning/15 text-warning",
};

export default function AdminPanel() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="meta-text mt-1">User management, roles, and system oversight.</p>
        </div>
        <Button variant="default">
          <UserPlus className="h-4 w-4 mr-1" />
          Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Users" value={42} icon={Users} iconColor="bg-chart-purple/15" />
        <KPICard title="Active Sessions" value={18} icon={Activity} iconColor="bg-chart-green/15" />
        <KPICard title="Pending Approvals" value={3} icon={Shield} iconColor="bg-chart-yellow/15" />
      </div>

      <div className="dash-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="section-title">User Accounts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30">
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-3 px-4">Name</th>
                <th className="data-table-header text-left py-3 px-4">Email</th>
                <th className="data-table-header text-left py-3 px-4">Role</th>
                <th className="data-table-header text-left py-3 px-4">Department</th>
                <th className="data-table-header text-left py-3 px-4">Status</th>
                <th className="data-table-header text-left py-3 px-4">Last Login</th>
                <th className="data-table-header text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{user.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                  <td className="py-3 px-4">
                    <Badge className={roleClass[user.role] || ""} variant="secondary">{user.role}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{user.department}</td>
                  <td className="py-3 px-4">
                    <Badge className={statusClass[user.status] || ""} variant="secondary">{user.status}</Badge>
                  </td>
                  <td className="py-3 px-4 tabular-nums text-muted-foreground">{user.lastLogin}</td>
                  <td className="py-3 px-4">
                    <Select>
                      <SelectTrigger className="h-8 w-28 text-xs bg-secondary border-border rounded-lg">
                        <SelectValue placeholder="Actions" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="edit">Edit User</SelectItem>
                        <SelectItem value="role">Change Role</SelectItem>
                        <SelectItem value="deactivate">Deactivate</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
