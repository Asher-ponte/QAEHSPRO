
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookOpen, Users, BarChart, Settings, PlusCircle, Ribbon, Library, DollarSign, CreditCard } from "lucide-react"
import Link from "next/link"
import { getCurrentSession } from "@/lib/session"
import { getDb } from "@/lib/db"
import { SITES } from "@/lib/sites"


const adminActions = [
  {
    title: "Manage Courses",
    description: "Create, edit, and delete training courses.",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    href: "/admin/courses",
    disabled: false,
  },
  {
    title: "Manage Users",
    description: "Onboard new employees and manage user roles.",
    icon: <Users className="h-8 w-8 text-primary" />,
    href: "/admin/users",
    disabled: false,
  },
  {
    title: "View Analytics",
    description: "Track course completion and user engagement.",
    icon: <BarChart className="h-8 w-8 text-primary" />,
    href: "/admin/analytics",
    disabled: false,
  },
  {
    title: "Manage Certificates",
    description: "Configure signatories for certificates.",
    icon: <Ribbon className="h-8 w-8 text-primary" />,
    href: "/admin/certificates",
    disabled: false,
  },
  {
    title: "Platform Settings",
    description: "Configure global platform settings like company name.",
    icon: <Settings className="h-8 w-8 text-primary" />,
    href: "/admin/settings",
    disabled: false,
  },
  {
    title: "Payment Management",
    description: "View transactions and manage gateways.",
    icon: <CreditCard className="h-8 w-8 text-primary" />,
    href: "/admin/payments",
    disabled: false,
  },
]


export default async function AdminPage() {
    const { user, siteId } = await getCurrentSession();
    if (!user || !siteId) {
        return <p className="p-4">Session not found. Please log in.</p>;
    }
    
    const db = await getDb(siteId);

    const totalUsersResult = await db.get('SELECT COUNT(*) as count FROM users');
    const totalCoursesResult = await db.get('SELECT COUNT(*) as count FROM courses');
    
    const statsData = {
        totalUsers: totalUsersResult?.count ?? 0,
        totalCourses: totalCoursesResult?.count ?? 0,
        totalBranches: SITES.length,
        totalRevenue: 0, // Placeholder
    };
    
    const statCards = [
        { title: "Total Users", value: statsData.totalUsers, icon: <Users className="h-4 w-4 text-muted-foreground" />, description: "Users in this branch." },
        { title: "Total Courses", value: statsData.totalCourses, icon: <BookOpen className="h-4 w-4 text-muted-foreground" />, description: "Courses in this branch." },
        { title: "Total Branches", value: statsData.totalBranches, icon: <Library className="h-4 w-4 text-muted-foreground" />, description: "All company branches." },
        { title: "Total Revenue", value: `$${statsData.totalRevenue.toFixed(2)}`, icon: <DollarSign className="h-4 w-4 text-muted-foreground" />, description: "From external users." },
    ];
    
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your organization's learning and development platform.
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
        <h2 className="text-2xl font-bold font-headline mb-4">Branch Overview</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(card => (
               <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        {card.icon}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                        <p className="text-xs text-muted-foreground">
                            {card.description}
                        </p>
                    </CardContent>
                </Card>
           ))}
        </div>
      </div>

       <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Management Actions</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {adminActions.map((action) => {
            const card = (
              <Card className={`h-full transition-colors ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'}`}>
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
            );

            if (action.disabled) {
                return <div key={action.title}>{card}</div>;
            }

            return (
                <Link href={action.href} key={action.title}>
                    {card}
                </Link>
            );
          })}
        </div>
      </div>
    </div>
  )
}
