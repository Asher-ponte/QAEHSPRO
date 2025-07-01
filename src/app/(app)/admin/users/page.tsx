
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Construction } from "lucide-react"

export default function ManageUsersPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Manage Users</h1>
          <p className="text-muted-foreground">
            This feature is under construction.
          </p>
        </div>
      </div>
      <Card className="flex-grow">
        <CardContent className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <Construction className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Coming Soon!</h2>
            <p className="text-muted-foreground max-w-sm">
                The ability to manage users, including onboarding and role assignments, is being developed and will be available in a future update.
            </p>
        </CardContent>
      </Card>
    </div>
  )
}
