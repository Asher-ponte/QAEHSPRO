
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookOpen, Users, BarChart, Settings, PlusCircle, Ribbon } from "lucide-react"
import Link from "next/link"

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
]

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
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
  )
}
