
"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PlusCircle, Edit, Trash2, MoreHorizontal, ArrowLeft, Loader2, UserPlus, BookCopy } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

interface User {
  id: number;
  username: string;
}

const userFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
})

type UserFormValues = z.infer<typeof userFormSchema>

function UserForm({ onFormSubmit, children }: { onFormSubmit: () => void, children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userFormSchema),
        defaultValues: { username: "" },
    });

    async function onSubmit(values: UserFormValues) {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create user.");
            }
            toast({
                title: "User Created",
                description: `User "${values.username}" has been created successfully.`,
            });
            onFormSubmit();
            setOpen(false);
            form.reset();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                        Add a new user to the platform. They will be able to log in immediately.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., janesmith" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create User
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

interface CourseAdminView {
  id: number;
  title: string;
}

function ManageEnrollmentsDialog({ user, open, onOpenChange }: { user: User | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [allCourses, setAllCourses] = useState<CourseAdminView[]>([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<number | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (open && user) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const [coursesRes, enrollmentsRes] = await Promise.all([
                        fetch('/api/admin/courses'),
                        fetch(`/api/admin/enrollments/${user.id}`)
                    ]);

                    if (!coursesRes.ok || !enrollmentsRes.ok) {
                        throw new Error('Failed to load enrollment data.');
                    }

                    const coursesData = await coursesRes.json();
                    const enrolledIdsData = await enrollmentsRes.json();

                    setAllCourses(coursesData);
                    setEnrolledCourseIds(new Set(enrolledIdsData));

                } catch (error) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: error instanceof Error ? error.message : 'Could not load data.'
                    });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [open, user, toast]);

    const handleEnrollmentChange = async (courseId: number, enroll: boolean) => {
        if (!user) return;
        setIsUpdating(courseId);
        
        const url = '/api/admin/enrollments';
        const method = enroll ? 'POST' : 'DELETE';
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, courseId: courseId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to ${enroll ? 'enroll' : 'un-enroll'} user.`);
            }
            
            setEnrolledCourseIds(prev => {
                const newSet = new Set(prev);
                if (enroll) {
                    newSet.add(courseId);
                } else {
                    newSet.delete(courseId);
                }
                return newSet;
            });

            toast({
                title: 'Success',
                description: `User ${enroll ? 'enrolled in' : 'un-enrolled from'} course successfully.`
            });

        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unknown error occurred.'
            });
        } finally {
            setIsUpdating(null);
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Manage Enrollments</DialogTitle>
                    <DialogDescription>
                        Enroll or un-enroll {user?.username} from courses. Changes are saved automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center space-x-2">
                                    <Skeleton className="h-4 w-4" />
                                    <Skeleton className="h-4 w-[250px]" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ScrollArea className="h-72">
                            <div className="space-y-4 pr-6">
                            {allCourses.length > 0 ? allCourses.map(course => (
                                <div key={course.id} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`course-${course.id}`}
                                        checked={enrolledCourseIds.has(course.id)}
                                        onCheckedChange={(checked) => handleEnrollmentChange(course.id, !!checked)}
                                        disabled={isUpdating === course.id}
                                    />
                                    <Label htmlFor={`course-${course.id}`} className="flex-grow font-normal cursor-pointer">
                                        {course.title}
                                    </Label>
                                    {isUpdating === course.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center">No courses available to enroll.</p>}
                            </div>
                        </ScrollArea>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEnroll, setUserToEnroll] = useState<User | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load users.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(userToDelete.id);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete user");
      }
      toast({
        title: "Success",
        description: `User "${userToDelete.username}" deleted successfully.`,
      });
      await fetchUsers(); // Refresh the list
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete user.",
      });
    } finally {
      setIsDeleting(null);
      setShowDeleteDialog(false);
      setUserToDelete(null);
    }
  };

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };
  
  const openEnrollmentDialog = (user: User) => {
    setUserToEnroll(user);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold font-headline">Manage Users</h1>
                <p className="text-muted-foreground">
                    Onboard new employees and manage user roles.
                </p>
            </div>
        </div>
        <UserForm onFormSubmit={fetchUsers}>
            <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
            </Button>
        </UserForm>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Platform Users</CardTitle>
          <CardDescription>A list of all users with access to the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">User ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-muted-foreground">{user.id}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting === user.id}>
                            {isDeleting === user.id ? (
                               <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                 <span className="sr-only">Open menu</span>
                                 <MoreHorizontal className="h-4 w-4" />
                                </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem onSelect={() => openEnrollmentDialog(user)}>
                             <BookCopy className="mr-2 h-4 w-4" />
                             <span>Manage Enrollments</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem disabled>
                             <Edit className="mr-2 h-4 w-4" />
                             <span>Edit (Soon)</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem 
                            onSelect={() => openDeleteDialog(user)} 
                            className="text-destructive"
                            disabled={user.id === 1}
                           >
                             <Trash2 className="mr-2 h-4 w-4" />
                             <span>Delete</span>
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user "{userToDelete?.username}" and all of their associated data, including course progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Delete User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManageEnrollmentsDialog 
        user={userToEnroll}
        open={!!userToEnroll}
        onOpenChange={(open) => {
            if (!open) {
                setUserToEnroll(null)
            }
        }}
       />
    </div>
  )
}
