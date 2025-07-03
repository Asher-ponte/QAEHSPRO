
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookOpen, Users, BarChart, Settings, PlusCircle, Ribbon, Database } from "lucide-react"
import Link from "next/link"
import fs from "fs"
import path from "path"

const adminActions = [
  {
    title: "Manage Courses",
    description: "Create, edit, and delete training courses.",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    href: "/admin/courses",
  },
  {
    title: "Manage Users",
    description: "Onboard new employees and manage user roles.",
    icon: <Users className="h-8 w-8 text-primary" />,
    href: "/admin/users",
  },
  {
    title: "View Analytics",
    description: "Track course completion and user engagement.",
    icon: <BarChart className="h-8 w-8 text-primary" />,
    href: "/admin/analytics",
  },
  {
    title: "Manage Certificates",
    description: "Configure signatories for certificates.",
    icon: <Ribbon className="h-8 w-8 text-primary" />,
    href: "/admin/certificates",
  },
  {
    title: "Platform Settings",
    description: "Configure global platform settings like company name.",
    icon: <Settings className="h-8 w-8 text-primary" />,
    href: "/admin/settings",
  },
]

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


export default function AdminPage() {
    let dbSize = 'N/A';
    try {
        const dbPath = path.join(process.cwd(), 'db.sqlite');
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            dbSize = formatBytes(stats.size);
        }
    } catch (error) {
        console.error("Could not read database size:", error);
    }
    
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your organization's learning platform.
          </p>
        </div>
        <Link href="/admin/courses/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Course
          </Button>
        </Link>
      </div>

       <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Platform Stats</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Database Size</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{dbSize}</div>
                    <p className="text-xs text-muted-foreground">
                        Current size of the SQLite database file.
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>

       <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Management Actions</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {adminActions.map((action) => (
            <Link href={action.href} key={action.title}>
                <Card className="h-full hover:bg-muted/50 transition-colors">
                <CardHeader>
                    {action.icon}
                </CardHeader>
                <CardContent>
                    <CardTitle className="text-lg font-headline">{action.title}</CardTitle>
                    <CardDescription className="mt-2 text-sm">
                    {action.description}
                    </CardDescription>
                </CardContent>
                </Card>
            </Link>
            ))}
        </div>
      </div>
    </div>
  )
}
