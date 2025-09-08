
"use client"

import { useEffect, useState, useMemo, type ReactNode } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PlusCircle, Edit, Trash2, MoreHorizontal, ArrowLeft, Loader2, UserPlus, Mail, Phone } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Site } from "@/lib/sites"
import { useSession } from "@/hooks/use-session"
import { PasswordInput } from "@/components/password-input"

interface User {
  id: number;
  username: string;
  fullName: string | null;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  role: 'Employee' | 'Admin';
  type: 'Employee' | 'External';
  siteId?: string;
  siteName?: string;
}

const createUserFormSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters."}),
  department: z.string().min(2, { message: "Department must be at least 2 characters." }),
  position: z.string().min(2, { message: "Position must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(["Employee", "Admin"], { required_error: "Role is required."}),
  type: z.enum(["Employee", "External"], { required_error: "User type is required."}),
  siteId: z.string({ required_error: "Branch is required." }),
})

type CreateUserFormValues = z.infer<typeof createUserFormSchema>

const updateUserFormSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')),
  department: z.string().min(2, { message: "Department must be at least 2 characters." }),
  position: z.string().min(2, { message: "Position must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(["Employee", "Admin"], { required_error: "Role is required."}),
  type: z.enum(["Employee", "External"], { required_error: "User type is required."}),
})

type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>

function UserForm({ onFormSubmit, children }: { onFormSubmit: () => void, children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sites, setSites] = useState<Site[]>([]);
    const { toast } = useToast();
    const { user, site, isSuperAdmin } = useSession();

    useEffect(() => {
        async function fetchSites() {
            if (!open) return;
            try {
                const res = await fetch('/api/sites');
                if (!res.ok) throw new Error("Failed to fetch sites");
                setSites(await res.json());
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load branches.' });
            }
        }
        fetchSites();
    }, [open, toast]);

    const form = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserFormSchema),
        defaultValues: { username: "", fullName: "", password: "", department: "", position: "", email: "", phone: "", role: "Employee", type: "Employee", siteId: site?.id },
    });
    
    // Reset form default when site context changes or dialog opens/closes
    useEffect(() => {
        if (site) {
             form.reset({ username: "", fullName: "", password: "", department: "", position: "", email: "", phone: "", role: "Employee", type: "Employee", siteId: site.id });
        }
    }, [site, open, form]);

    async function onSubmit(values: CreateUserFormValues) {
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                            name="siteId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!isSuperAdmin}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a branch for this user" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {sites.length > 0 ? sites.map(site => (
                                                <SelectItem key={site.id} value={site.id}>
                                                    {site.name}
                                                </SelectItem>
                                            )) : <SelectItem value="loading" disabled>Loading branches...</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                     <FormDescription>
                                        {isSuperAdmin ? "The branch where the user will be created." : "Client admins can only create users in their own branch."}
                                     </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name (for certificates)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Jane Smith" {...field} autoComplete="name" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username (for login)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., janesmith" {...field} autoComplete="username" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <PasswordInput placeholder="••••••••" {...field} autoComplete="new-password" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="Email Address" {...field} autoComplete="email" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Phone Number" {...field} autoComplete="tel" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="department"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Engineering" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="position"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Position</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Software Engineer" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Employee">Employee</SelectItem>
                                                <SelectItem value="Admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Employee">Employee</SelectItem>
                                                <SelectItem value="External">External</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
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

function EditUserForm({ user, onFormSubmit, open, onOpenChange }: { user: User | null; onFormSubmit: () => void; open: boolean; onOpenChange: (open: boolean) => void; }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { isSuperAdmin } = useSession();

    const form = useForm<UpdateUserFormValues>({
        resolver: zodResolver(updateUserFormSchema),
    });

    useEffect(() => {
        if (user) {
            form.reset({
                ...user,
                password: "",
                fullName: user.fullName || user.username,
                email: user.email || "",
                phone: user.phone || ""
            });
        }
    }, [user, open, form]);

    async function onSubmit(values: UpdateUserFormValues) {
        if (!user) return;
        setIsSubmitting(true);
        
        let url = `/api/admin/users/${user.id}`;
        if (isSuperAdmin && user.siteId) {
            url += `?siteId=${user.siteId}`;
        }

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to update user.");
            }
            toast({
                title: "User Updated",
                description: `User "${values.username}" has been updated successfully.`,
            });
            onFormSubmit();
            onOpenChange(false);
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                        Update the user's details below. Branch cannot be changed after creation.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name (for certificates)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Jane Smith" {...field} autoComplete="name" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username (for login)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., janesmith" {...field} autoComplete="username" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                        <PasswordInput {...field} autoComplete="new-password" />
                                    </FormControl>
                                    <FormDescription>
                                        Leave blank to keep the current password.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="Email Address" {...field} value={field.value ?? ""} autoComplete="email" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Phone Number" {...field} value={field.value ?? ""} autoComplete="tel" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="department"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Engineering" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="position"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Position</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Software Engineer" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Employee">Employee</SelectItem>
                                                <SelectItem value="Admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Employee">Employee</SelectItem>
                                                <SelectItem value="External">External</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isDialogDeleting, setIsDialogDeleting] = useState(false);
  const { toast } = useToast();
  const { isSuperAdmin, site } = useSession();

  const [filters, setFilters] = useState({
      fullName: '',
      username: '',
      siteName: 'all',
      department: '',
      position: '',
      role: 'all',
      type: 'all',
    });

  useEffect(() => {
    if (!isSuperAdmin) return;
    try {
        const savedFilters = localStorage.getItem('userAdminFilters');
        if (savedFilters) {
            setFilters(JSON.parse(savedFilters));
        }
    } catch (error) {
        console.error("Failed to parse filters from localStorage", error);
        // Reset to default if parsing fails
        setFilters({ fullName: '', username: '', siteName: 'all', department: '', position: '', role: 'all', type: 'all' });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    localStorage.setItem('userAdminFilters', JSON.stringify(filters));
  }, [filters, isSuperAdmin]);

  const fetchUsersAndSites = async () => {
    setIsLoading(true);
    try {
      const usersRes = await fetch("/api/admin/users");
      if (!usersRes.ok) throw new Error("Failed to fetch users");
      setUsers(await usersRes.json());
      
      if (isSuperAdmin) {
          const sitesRes = await fetch('/api/sites');
          if (!sitesRes.ok) throw new Error("Failed to fetch sites");
          // Filter out main site from the filter options
          const allSitesData = await sitesRes.json();
          setAllSites(allSitesData.filter((s: Site) => s.id !== 'main'));
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load page data.",
      });
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchUsersAndSites();
  }, [site, isSuperAdmin]); // Refetch users when the site context changes

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDialogDeleting(true);
    setIsDeleting(userToDelete.id);
    
    let url = `/api/admin/users/${userToDelete.id}`;
    if (isSuperAdmin && userToDelete.siteId) {
        url += `?siteId=${userToDelete.siteId}`;
    }

    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete user");
      }
      toast({
        title: "Success",
        description: `User "${userToDelete.username}" deleted successfully.`,
      });
      await fetchUsersAndSites(); // Refresh the list
      setShowDeleteDialog(false);
      setUserToDelete(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete user.",
      });
    } finally {
      setIsDeleting(null);
      setIsDialogDeleting(false);
    }
  };
  
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ fullName: '', username: '', siteName: 'all', department: '', position: '', role: 'all', type: 'all' });
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
        const fullNameMatch = user.fullName ? user.fullName.toLowerCase().includes(filters.fullName.toLowerCase()) : filters.fullName === '';
        const usernameMatch = user.username.toLowerCase().includes(filters.username.toLowerCase());
        const siteMatch = !isSuperAdmin || filters.siteName === 'all' || user.siteName === filters.siteName;
        const departmentMatch = user.department ? user.department.toLowerCase().includes(filters.department.toLowerCase()) : filters.department === '';
        const positionMatch = user.position ? user.position.toLowerCase().includes(filters.position.toLowerCase()) : filters.position === '';
        const roleMatch = filters.role === 'all' || user.role === filters.role;
        const typeMatch = filters.type === 'all' || user.type === filters.type;

        if (isSuperAdmin) {
            return fullNameMatch && usernameMatch && siteMatch && departmentMatch && positionMatch && roleMatch && typeMatch;
        }
        
        // For non-super-admins, implicitly filter by their site
        return user.siteId === site?.id;
    });
  }, [users, filters, isSuperAdmin, site]);

  const filtersAreActive = useMemo(() => {
    return (
      filters.fullName !== '' ||
      filters.username !== '' ||
      filters.siteName !== 'all' ||
      filters.department !== '' ||
      filters.position !== '' ||
      filters.role !== 'all' ||
      filters.type !== 'all'
    );
  }, [filters]);


  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };
  
  const openEditDialog = (user: User) => {
    setUserToEdit(user);
  };

  const pageTitle = isSuperAdmin ? "Manage All Users" : "Manage Users";
  const pageDescription = isSuperAdmin
    ? "View, create, and manage users across all client branches."
    : `Onboard new employees and manage user roles for the ${site?.name || 'current'} branch.`;


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold font-headline">{pageTitle}</h1>
                <p className="text-muted-foreground">{pageDescription}</p>
            </div>
        </div>
        <UserForm onFormSubmit={fetchUsersAndSites}>
            <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
            </Button>
        </UserForm>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Platform Users</CardTitle>
          <CardDescription>
            {isSuperAdmin 
              ? "A list of all users across all client branches." 
              : "A list of all users with access to your branch."
            }
          </CardDescription>
           {isSuperAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t mt-4">
                  <Input placeholder="Filter by Full Name..." value={filters.fullName} onChange={(e) => handleFilterChange('fullName', e.target.value)} />
                  <Input placeholder="Filter by Username..." value={filters.username} onChange={(e) => handleFilterChange('username', e.target.value)} />
                  <Input placeholder="Filter by Department..." value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)} />
                  <Input placeholder="Filter by Position..." value={filters.position} onChange={(e) => handleFilterChange('position', e.target.value)} />
                  
                  <Select value={filters.siteName} onValueChange={(value) => handleFilterChange('siteName', value)}>
                    <SelectTrigger><SelectValue placeholder="Filter by Branch" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {allSites.map(site => <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value)}>
                    <SelectTrigger><SelectValue placeholder="Filter by Role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                    <SelectTrigger><SelectValue placeholder="Filter by Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Employee">Employee</SelectItem>
                      <SelectItem value="External">External</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" onClick={clearFilters} disabled={!filtersAreActive}>
                    Clear Filters
                  </Button>
              </div>
           )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Username</TableHead>
                {isSuperAdmin && <TableHead>Branch</TableHead>}
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    {isSuperAdmin && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={`${user.id}-${user.siteId || ''}`}>
                    <TableCell className="font-medium">{user.fullName || user.username}</TableCell>
                    <TableCell className="text-muted-foreground">{user.username}</TableCell>
                    {isSuperAdmin && <TableCell>{user.siteName}</TableCell>}
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>{user.position}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.type === 'External' ? 'outline' : 'secondary'}>
                        {user.type}
                      </Badge>
                    </TableCell>
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
                           <DropdownMenuItem onSelect={() => openEditDialog(user)} disabled={user.username === 'florante'}>
                             <Edit className="mr-2 h-4 w-4" />
                             <span>Edit</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem 
                            onSelect={() => openDeleteDialog(user)} 
                            className="text-destructive"
                            disabled={user.username === 'florante'}
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
                  <TableCell colSpan={isSuperAdmin ? 10 : 9} className="h-24 text-center">
                    No users found{isSuperAdmin && filtersAreActive ? ' matching your filters' : ''}.
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
            <AlertDialogAction onClick={handleDeleteUser} disabled={isDialogDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDialogDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditUserForm
        user={userToEdit}
        onFormSubmit={fetchUsersAndSites}
        open={!!userToEdit}
        onOpenChange={(open) => {
            if (!open) {
                setUserToEdit(null);
            }
        }}
      />
    </div>
  )
}
