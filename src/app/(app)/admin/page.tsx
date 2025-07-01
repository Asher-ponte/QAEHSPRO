import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookOpen, Users, BarChart, Settings, PlusCircle } from "lucide-react"
import Link from "next/link"

const adminActions = [
  {
    title: "Manage Courses",
    description: "Create, edit, and publish training courses.",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    href: "#",
  },
  {
    title: "Manage Users",
    description: "Onboard new employees and manage user roles.",
    icon: <Users className="h-8 w-8 text-primary" />,
    href: "#",
  },
  {
    title: "View Analytics",
    description: "Track course completion and user engagement.",
    icon: <BarChart className="h-8 w-8 text-primary" />,
    href: "#",
  },
  {
    title: "Platform Settings",
    description: "Configure integrations and system settings.",
    icon: <Settings className="h-8 w-8 text-primary" />,
    href: "#",
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
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Course
        </Button>
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
