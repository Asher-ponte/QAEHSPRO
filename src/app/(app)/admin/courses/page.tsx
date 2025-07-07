
"use client"

import { useEffect, useState, useMemo, type ReactNode } from "react"
import Link from "next/link"
import { PlusCircle, Edit, Trash2, MoreHorizontal, ArrowLeft, Loader2, Users, BarChart, CheckCircle, RefreshCcw, DollarSign, Library, Building } from "lucide-react"

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
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useSession } from "@/hooks/use-session"
import type { Site } from "@/lib/sites"

interface CourseAdminView {
  id: number;
  title: string;
  category: string;
  enrolledCount: number;
  completionRate: number;
  startDate: string | null;
  endDate: string | null;
  is_internal: boolean;
  is_public: boolean;
  price: number | null;
  siteId?: string;
  siteName?: string;
}

interface User {
  id: number;
  username: string;
  department: string | null;
}

function SyncDialog({ course, allCourses, open, onOpenChange, onSyncSuccess }: { course: CourseAdminView | null; allCourses: CourseAdminView[]; open: boolean; onOpenChange: (open: boolean) => void; onSyncSuccess: () => void; }) {
    const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();

    const publishedBranches = useMemo(() => {
        if (!course || !allCourses) return [];
        return allCourses.filter(c => c.title === course.title && c.siteId !== 'main');
    }, [course, allCourses]);

    useEffect(() => {
        if (open) {
            setIsSyncing(false);
            setSelectedBranchIds(new Set());
        }
    }, [open]);

    const handleSync = async () => {
        if (!course || selectedBranchIds.size === 0 || isSyncing) return;
        setIsSyncing(true);

        try {
            const res = await fetch(`/api/admin/courses/${course.id}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetSiteIds: Array.from(selectedBranchIds) }),
            });
            const data = await res.json();
            if (!res.ok) {
                const message = data.details ? `${data.error} Details: ${JSON.stringify(data.details, null, 2)}` : data.error;
                throw new Error(message || "Sync operation failed.");
            }
            
            toast({
                title: res.status === 207 ? "Partial Sync Success" : "Sync Successful",
                description: data.message,
                duration: 8000,
            });
            onSyncSuccess();
            onOpenChange(false);
        } catch (error) {
           toast({
                variant: "destructive",
                title: "Error During Sync",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
                duration: 8000,
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const toggleBranchSelection = (branchId: string) => {
        setSelectedBranchIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(branchId)) {
                newSet.delete(branchId);
            } else {
                newSet.add(branchId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedBranchIds(new Set(publishedBranches.map(b => b.siteId!)));
        } else {
            setSelectedBranchIds(new Set());
        }
    };

    const allAreSelected = publishedBranches.length > 0 && selectedBranchIds.size === publishedBranches.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sync Course Content</DialogTitle>
                    <DialogDescription>
                        Push the latest content from the master course <strong className="font-semibold text-foreground">"{course?.title}"</strong> to its copies in other branches. This will overwrite the modules and lessons in the selected branches.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {publishedBranches.length > 0 ? (
                        <>
                            <div className="flex items-center space-x-3 rounded-md border p-3">
                                <Checkbox
                                    id="select-all-branches"
                                    checked={allAreSelected}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedBranchIds(new Set(publishedBranches.map(b => b.siteId!)));
                                        } else {
                                            setSelectedBranchIds(new Set());
                                        }
                                    }}
                                />
                                <Label htmlFor="select-all-branches" className="text-sm font-medium leading-none">
                                    Select All Branches ({selectedBranchIds.size}/{publishedBranches.length})
                                </Label>
                            </div>
                            <ScrollArea className="h-48">
                                <div className="space-y-2 pr-4">
                                {publishedBranches.map(branch => (
                                    <div key={branch.siteId} className="flex items-center space-x-3">
                                        <Checkbox
                                            id={`branch-${branch.siteId}`}
                                            checked={selectedBranchIds.has(branch.siteId!)}
                                            onCheckedChange={() => toggleBranchSelection(branch.siteId!)}
                                        />
                                        <Label htmlFor={`branch-${branch.siteId}`} className="flex-grow font-normal cursor-pointer">
                                            {branch.siteName}
                                        </Label>
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                        </>
                    ) : (
                        <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                            <p>This course has not been published to any other branches.</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSync} disabled={isSyncing || selectedBranchIds.size === 0}>
                        {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sync to {selectedBranchIds.size} {selectedBranchIds.size === 1 ? 'Branch' : 'Branches'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ManageEnrollmentsDialog({ course, open, onOpenChange }: { course: CourseAdminView | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [enrolledUserIds, setEnrolledUserIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState<number | null>(null);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const { toast } = useToast();
    const { site: currentSite } = useSession();

    useEffect(() => {
        if (open && course) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const targetSiteId = course.siteId || currentSite?.id;
                    if (!targetSiteId) {
                        throw new Error("Could not determine the branch for fetching users.");
                    }
                    
                    const [usersRes, enrollmentsRes] = await Promise.all([
                        fetch(`/api/admin/users?siteId=${targetSiteId}`),
                        fetch(`/api/admin/courses/${course.id}/enrollments?siteId=${targetSiteId}`)
                    ]);

                    if (!usersRes.ok || !enrollmentsRes.ok) {
                        throw new Error('Failed to load enrollment data.');
                    }

                    const usersData = await usersRes.json();
                    const enrolledIdsData = await enrollmentsRes.json();

                    setAllUsers(usersData);
                    setEnrolledUserIds(new Set(enrolledIdsData));

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
    }, [open, course, toast, currentSite]);

    const handleEnrollmentChange = async (userId: number, enroll: boolean) => {
        if (!course) return;
        setIsUpdating(userId);
        
        const url = '/api/admin/enrollments';
        const method = enroll ? 'POST' : 'DELETE';
        const targetSiteId = course.siteId || currentSite?.id;
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: userId, 
                    courseId: course.id,
                    siteId: targetSiteId,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to ${enroll ? 'enroll' : 'un-enroll'} user.`);
            }
            
            setEnrolledUserIds(prev => {
                const newSet = new Set(prev);
                if (enroll) {
                    newSet.add(userId);
                } else {
                    newSet.delete(userId);
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
    
    const handleBulkEnrollment = async (enrollAll: boolean) => {
        if (!course || isBulkUpdating || allUsers.length === 0) return;
        setIsBulkUpdating(true);
        const targetSiteId = course.siteId || currentSite?.id;

        const allUserIds = allUsers.map(u => u.id);

        try {
            const response = await fetch('/api/admin/enrollments/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: course.id,
                    userIds: allUserIds,
                    action: enrollAll ? 'enroll' : 'unenroll',
                    siteId: targetSiteId,
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Failed to ${enrollAll ? 'enroll' : 'un-enroll'} all users.`);
            }

            if (enrollAll) {
                setEnrolledUserIds(new Set(allUserIds));
            } else {
                setEnrolledUserIds(new Set());
            }

            toast({
                title: 'Success',
                description: `All users have been ${enrollAll ? 'enrolled in' : 'un-enrolled from'} the course.`
            });

        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'An unknown error occurred.'
            });
        } finally {
            setIsBulkUpdating(false);
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Course Enrollments</DialogTitle>
                    <DialogDescription>
                        Enroll or un-enroll users from "{course?.title}". Changes are saved automatically.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleBulkEnrollment(true)}
                        disabled={isBulkUpdating || isLoading || allUsers.length === 0}
                    >
                        {isBulkUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enroll All
                    </Button>
                    <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleBulkEnrollment(false)}
                        disabled={isBulkUpdating || isLoading || allUsers.length === 0}
                    >
                        {isBulkUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Un-enroll All
                    </Button>
                </div>
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
                            {allUsers.length > 0 ? allUsers.map(user => (
                                <div key={user.id} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`user-${user.id}`}
                                        checked={enrolledUserIds.has(user.id)}
                                        onCheckedChange={(checked) => handleEnrollmentChange(user.id, !!checked)}
                                        disabled={isUpdating === user.id}
                                    />
                                    <Label htmlFor={`user-${user.id}`} className="flex-grow font-normal cursor-pointer">
                                        {user.username} <span className="text-xs text-muted-foreground">{user.department}</span>
                                    </Label>
                                    {isUpdating === user.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center">No users available to enroll.</p>}
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

interface UserProgress {
    id: number;
    username: string;
    fullName: string;
    department: string;
    progress: number;
}

function RetrainingDialog({ course, siteId, siteName, open, onOpenChange, onInitiate }: { course: CourseAdminView | null; siteId: string; siteName: string; open: boolean; onOpenChange: (open: boolean) => void; onInitiate: () => void; }) {
    const [isRetraining, setIsRetraining] = useState(false);
    const { toast } = useToast();

    const handleRetraining = async () => {
        if (!course || !siteId) return;
        setIsRetraining(true);
        try {
            const payload = { targetSiteId: siteId, courseTitle: course.title };

            const res = await fetch(`/api/admin/courses/${course.id}/retraining`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to start re-training.");
            }

            toast({
                title: "Re-Training Initiated",
                description: data.message || `Progress for completed users of "${course.title}" in "${siteName}" has been reset.`,
            });
            onInitiate();
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsRetraining(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Initiate Re-Training for "{course?.title}"</DialogTitle>
                     <DialogDescription>
                        This will reset the progress for all users who have 100% completed this course <strong className="font-semibold text-foreground">in the "{siteName}" branch</strong>. Their existing certificates will be kept, but they will be required to complete the course again. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <AlertDialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleRetraining} disabled={isRetraining}>
                        {isRetraining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Initiate for "{siteName}"
                    </Button>
                </AlertDialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ViewProgressDialog({ course, open, onOpenChange }: { course: CourseAdminView | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { isSuperAdmin, site: currentSite } = useSession();
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState(course?.siteId || currentSite?.id);
    const [progressData, setProgressData] = useState<UserProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showNotCompleted, setShowNotCompleted] = useState(false);
    const [showRetrainingDialog, setShowRetrainingDialog] = useState(false);
    const { toast } = useToast();

    // Reset local state when dialog closes or course changes
    useEffect(() => {
        if (open) {
            setSelectedSiteId(course?.siteId || currentSite?.id);
        } else {
            setFilter('');
            setProgressData([]);
            setShowNotCompleted(false);
            setIsLoading(true);
        }
    }, [open, course, currentSite]);

    // Fetch sites for super admin dropdown
    useEffect(() => {
        if (open && isSuperAdmin) {
            const fetchSites = async () => {
                try {
                    const res = await fetch('/api/sites');
                    if (!res.ok) throw new Error("Failed to fetch sites");
                    setSites(await res.json());
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load branches.' });
                }
            };
            fetchSites();
        }
    }, [open, isSuperAdmin, toast]);
    
    const fetchProgress = async () => {
        if (!course || !selectedSiteId) return;

        setIsLoading(true);
        try {
            const url = new URL(`/api/admin/courses/${course.id}/progress`, window.location.origin);
            url.searchParams.append('targetSiteId', selectedSiteId);
            url.searchParams.append('courseTitle', course.title);
            
            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('Failed to load user progress.');
            
            const data = await res.json();
            setProgressData(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Could not load data.'
            });
            setProgressData([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open && course && selectedSiteId) {
            fetchProgress();
        }
    }, [open, course, selectedSiteId, toast]);


    const { completedCount, notCompletedCount } = useMemo(() => {
        if (!progressData.length) return { completedCount: 0, notCompletedCount: 0 };
        const completed = progressData.filter(p => p.progress === 100).length;
        const notCompleted = progressData.length - completed;
        return { completedCount: completed, notCompletedCount: notCompleted };
    }, [progressData]);

    const filteredAndSortedData = useMemo(() => {
        const sortedData = [...progressData].sort((a, b) => {
            if (a.progress < b.progress) return 1;
            if (a.progress > b.progress) return -1;
            return (a.fullName || a.username).localeCompare(b.fullName || b.username);
        });

        let data = sortedData;
        if (showNotCompleted) {
            data = data.filter(user => user.progress < 100);
        }
        
        if (!filter) return data;

        const lowercasedFilter = filter.toLowerCase();
        return data.filter(user =>
            (user.fullName?.toLowerCase() || '').includes(lowercasedFilter) ||
            user.username.toLowerCase().includes(lowercasedFilter) ||
            (user.department?.toLowerCase() || '').includes(lowercasedFilter)
        );
    }, [progressData, filter, showNotCompleted]);

    const selectedSiteName = sites.find(s => s.id === selectedSiteId)?.name || course?.siteName || currentSite?.name || '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>User Progress for "{course?.title}"</DialogTitle>
                     <DialogDescription>
                        {isSuperAdmin 
                            ? `Viewing data for branch: ${selectedSiteName}`
                            : 'Track the completion progress of all enrolled users for this course.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                     {isSuperAdmin && (
                        <div className="space-y-2">
                             <Label htmlFor="branch-select">View Progress in Branch</Label>
                             <Select value={selectedSiteId} onValueChange={setSelectedSiteId} name="branch-select">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a branch..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sites.map(site => (
                                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                     <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{completedCount}</div>
                                <p className="text-xs text-muted-foreground">
                                    {progressData.length > 0 ? `${Math.round((completedCount / progressData.length) * 100)}% of enrolled` : '0 enrolled'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{notCompletedCount}</div>
                                 <p className="text-xs text-muted-foreground">
                                    {progressData.length > 0 ? `${Math.round((notCompletedCount / progressData.length) * 100)}% of enrolled` : ''}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                     <div className="flex flex-col sm:flex-row items-center gap-4">
                        <Input
                            placeholder="Filter by name, username, or department..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full"
                        />
                        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-shrink-0">
                            <Switch id="show-not-completed" checked={showNotCompleted} onCheckedChange={setShowNotCompleted} />
                            <Label htmlFor="show-not-completed" className="whitespace-nowrap">In-Progress Only</Label>
                        </div>
                     </div>
                     
                    {isLoading ? (
                        <div className="space-y-4 pt-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-2">
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="h-4 w-1/3" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ScrollArea className="h-96">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Full Name</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead className="w-[180px]">Progress</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedData.length > 0 ? filteredAndSortedData.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="font-medium">{user.fullName}</div>
                                                <div className="text-xs text-muted-foreground">{user.username}</div>
                                            </TableCell>
                                            <TableCell>{user.department}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={user.progress} className="h-2" />
                                                    <span className="text-xs font-medium text-muted-foreground">{user.progress}%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                       <TableRow>
                                           <TableCell colSpan={3} className="h-24 text-center">
                                                {progressData.length === 0 ? 'No users are enrolled in this course.' : 'No users match the current filter.'}
                                           </TableCell>
                                       </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>
                <DialogFooter className="sm:justify-between">
                    <div>
                        {isSuperAdmin && (
                            <Button variant="destructive" onClick={() => setShowRetrainingDialog(true)}>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Initiate Re-Training
                            </Button>
                        )}
                    </div>
                    <Button type="button" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
                
                 {isSuperAdmin && selectedSiteId && (
                    <RetrainingDialog
                        course={course}
                        siteId={selectedSiteId}
                        siteName={selectedSiteName}
                        open={showRetrainingDialog}
                        onOpenChange={setShowRetrainingDialog}
                        onInitiate={fetchProgress}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

export default function ManageCoursesPage() {
  const [courses, setCourses] = useState<CourseAdminView[]>([])
  const [allSites, setAllSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<CourseAdminView | null>(null)
  const [courseToEnroll, setCourseToEnroll] = useState<CourseAdminView | null>(null)
  const [courseForProgress, setCourseForProgress] = useState<CourseAdminView | null>(null);
  const [courseToSync, setCourseToSync] = useState<CourseAdminView | null>(null);
  const [isDialogDeleting, setIsDialogDeleting] = useState(false);
  const { toast } = useToast()
  const { isSuperAdmin, site } = useSession();
  const [categories, setCategories] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({ title: '', category: 'all', siteId: 'all' });

  useEffect(() => {
    try {
        const savedFilters = localStorage.getItem('courseAdminFilters');
        if (savedFilters) {
            setFilters(JSON.parse(savedFilters));
        }
    } catch (error) {
        console.error("Failed to parse filters from localStorage", error);
        setFilters({ title: '', category: 'all', siteId: 'all' });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('courseAdminFilters', JSON.stringify(filters));
  }, [filters]);

  const fetchCoursesAndSites = async () => {
    setIsLoading(true);
    try {
      const fetchPromises = [
        fetch("/api/admin/courses"),
        fetch("/api/admin/categories"),
      ];
      if (isSuperAdmin) {
        fetchPromises.push(fetch('/api/sites'));
      }
      const [coursesRes, categoriesRes, sitesRes] = await Promise.all(fetchPromises);

      if (!coursesRes.ok) throw new Error("Failed to fetch courses");
      setCourses(await coursesRes.json());

      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json());
      }
      
      if (isSuperAdmin && sitesRes?.ok) {
        setAllSites(await sitesRes.json());
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Could not load courses.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoursesAndSites();
  }, [site, isSuperAdmin]); // Refetch when site context (for regular admins) or super admin status changes

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;

    setIsDialogDeleting(true);
    setIsDeleting(courseToDelete.id);
    try {
      const res = await fetch(`/api/admin/courses/${courseToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        const message = errorData.details
          ? `${errorData.error} Details: ${errorData.details}`
          : errorData.error || "Failed to delete course";
        throw new Error(message);
      }
      toast({
        title: "Success",
        description: `Course "${courseToDelete.title}" deleted successfully.`,
      });
      await fetchCoursesAndSites();
      setShowDeleteDialog(false);
      setCourseToDelete(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Deleting Course",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsDeleting(null);
      setIsDialogDeleting(false);
    }
  };
  
  const handleFilterChange = (key: 'title' | 'category' | 'siteId', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ title: '', category: 'all', siteId: 'all' });
  };
  
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const titleMatch = course.title.toLowerCase().includes(filters.title.toLowerCase());
      const categoryMatch = filters.category === 'all' || course.category === filters.category;
      const siteMatch = !isSuperAdmin || filters.siteId === 'all' || course.siteId === filters.siteId;
      return titleMatch && categoryMatch && siteMatch;
    });
  }, [courses, filters, isSuperAdmin]);

  const openDeleteDialog = (course: CourseAdminView) => {
    setCourseToDelete(course);
    setShowDeleteDialog(true);
  };
  
  const openEnrollmentDialog = (course: CourseAdminView) => {
    setCourseToEnroll(course);
  };

  const openProgressDialog = (course: CourseAdminView) => {
    setCourseForProgress(course);
  };
  
  const openSyncDialog = (course: CourseAdminView) => {
    setCourseToSync(course);
  };

  const filtersAreActive = filters.title !== '' || filters.category !== 'all' || (isSuperAdmin && filters.siteId !== 'all');
  const publishedTo = (course: CourseAdminView) => {
    if (!isSuperAdmin || course.siteId !== 'main') return null;
    const copies = courses.filter(c => c.title === course.title && c.siteId !== 'main');
    if (copies.length === 0) return <span className="text-muted-foreground">-</span>
    return (
        <div className="flex flex-col gap-1">
            {copies.map(c => <Badge key={c.siteId} variant="outline" className="font-normal">{c.siteName}</Badge>)}
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold font-headline">Manage Courses</h1>
                <p className="text-muted-foreground">
                    View, edit, or delete existing courses.
                </p>
            </div>
        </div>
        <Link href="/admin/courses/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Course
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Existing Courses</CardTitle>
          <CardDescription>
            A list of all courses in the platform. Use the filters below to refine your search.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 pt-4">
              <Input
                  placeholder="Filter by course title..."
                  value={filters.title}
                  onChange={(e) => handleFilterChange('title', e.target.value)}
                  className="max-w-sm"
              />
              <Select
                  value={filters.category}
                  onValueChange={(value) => handleFilterChange('category', value)}
              >
                  <SelectTrigger className="w-full sm:w-[240px]">
                      <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
               {isSuperAdmin && (
                <Select
                    value={filters.siteId}
                    onValueChange={(value) => handleFilterChange('siteId', value)}
                >
                    <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue placeholder="Filter by branch" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {allSites.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={clearFilters} disabled={!filtersAreActive}>Clear Filters</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                {isSuperAdmin && <TableHead>Branch</TableHead>}
                {isSuperAdmin && <TableHead>Published To</TableHead>}
                <TableHead>Category</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-center">Enrolled</TableHead>
                <TableHead className="w-[180px]">Completion Rate</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    {isSuperAdmin && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    {isSuperAdmin && <TableCell><Skeleton className="h-5 w-32" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCourses.length > 0 ? (
                filteredCourses.map((course) => {
                  return (
                    <TableRow key={`${course.id}-${course.siteId || ''}`}>
                        <TableCell className="font-medium">{course.title}</TableCell>
                        {isSuperAdmin && <TableCell><Badge variant={course.siteId === 'main' ? 'default' : 'outline'} className="font-normal">{course.siteName}</Badge></TableCell>}
                        {isSuperAdmin && <TableCell>{publishedTo(course)}</TableCell>}
                        <TableCell>{course.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5 items-start">
                            {course.is_internal && <Badge variant="secondary">Internal</Badge>}
                            {course.is_public && <Badge variant="outline">Public</Badge>}
                          </div>
                        </TableCell>
                         <TableCell>
                          {course.is_public ? (
                            <span className="font-semibold">
                              {course.price && course.price > 0 ? `₱${course.price.toFixed(2)}` : 'Free'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{course.enrolledCount}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Progress value={course.completionRate} className="h-2" />
                                <span className="text-xs font-medium text-muted-foreground">{course.completionRate}%</span>
                            </div>
                        </TableCell>
                        <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting === course.id}>
                                {isDeleting === course.id ? (
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
                            <Link href={`/admin/courses/edit/${course.id}`}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                                </DropdownMenuItem>
                            </Link>
                                <DropdownMenuItem onSelect={() => openEnrollmentDialog(course)}>
                                <Users className="mr-2 h-4 w-4" />
                                <span>Enroll Users</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => openProgressDialog(course)}>
                                    <BarChart className="mr-2 h-4 w-4" />
                                    <span>View Progress</span>
                                </DropdownMenuItem>
                                {isSuperAdmin && course.siteId === 'main' && (
                                     <DropdownMenuItem onSelect={() => openSyncDialog(course)}>
                                        <RefreshCcw className="mr-2 h-4 w-4" />
                                        <span>Sync Content</span>
                                    </DropdownMenuItem>
                                )}
                            <DropdownMenuItem onSelect={() => openDeleteDialog(course)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  )}
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 9 : 7} className="h-24 text-center">
                    No courses found{filtersAreActive ? ' matching your filters' : ''}.
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
              This action cannot be undone. This will permanently delete the course "{courseToDelete?.title}" and all of its associated modules, lessons, and user progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCourse} disabled={isDialogDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDialogDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManageEnrollmentsDialog 
        course={courseToEnroll}
        open={!!courseToEnroll}
        onOpenChange={(open) => {
            if (!open) {
                setCourseToEnroll(null)
                fetchCoursesAndSites()
            }
        }}
       />

       <ViewProgressDialog
        course={courseForProgress}
        open={!!courseForProgress}
        onOpenChange={(open) => {
            if (!open) {
                setCourseForProgress(null)
            }
        }}
       />
       
       {isSuperAdmin && (
          <SyncDialog
            course={courseToSync}
            allCourses={courses}
            open={!!courseToSync}
            onOpenChange={() => setCourseToSync(null)}
            onSyncSuccess={fetchCoursesAndSites}
           />
       )}
    </div>
  )
}
