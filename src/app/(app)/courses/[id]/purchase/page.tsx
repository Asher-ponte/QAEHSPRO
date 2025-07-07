
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ImageUpload } from "@/components/image-upload"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

interface Course {
  id: string;
  title: string;
  price: number;
}

interface QrCode {
    label: string;
    path: string;
}

const purchaseFormSchema = z.object({
  referenceNumber: z.string().min(1, { message: "Reference number is required." }),
  proofImagePath: z.string().min(1, { message: "Proof of payment image is required." }),
})

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>

export default function PurchasePage() {
    const params = useParams<{ id: string }>()
    const courseId = params.id;
    const router = useRouter();
    const { toast } = useToast();
    const [course, setCourse] = useState<Course | null>(null);
    const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PurchaseFormValues>({
        resolver: zodResolver(purchaseFormSchema),
        defaultValues: { referenceNumber: "", proofImagePath: "" },
    })

    useEffect(() => {
        async function fetchPurchaseData() {
            if (!courseId) return;
            setIsLoading(true);
            try {
                const [courseRes, qrRes] = await Promise.all([
                    fetch(`/api/courses/${courseId}`),
                    fetch(`/api/settings/public`)
                ]);

                if (!courseRes.ok) throw new Error("Could not fetch course information.");
                const courseData = await courseRes.json();
                if (!courseData.is_public || !courseData.price) {
                     throw new Error("This course is not available for purchase.");
                }
                setCourse(courseData);

                if (qrRes.ok) {
                    setQrCodes(await qrRes.json());
                } else {
                    console.error("Could not fetch QR codes");
                }

            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error instanceof Error ? error.message : "An unknown error occurred.",
                });
                router.push(`/courses/${courseId}`);
            } finally {
                setIsLoading(false);
            }
        }
        fetchPurchaseData();
    }, [courseId, router, toast]);

    async function onSubmit(values: PurchaseFormValues) {
        if (!course) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/courses/${course.id}/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
             const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to submit payment proof.");
            }
            toast({
                title: "Payment Submitted",
                description: "Thank you for your payment. We will validate it shortly and grant you access to the course.",
            });
            router.push(`/courses/${courseId}`);
            router.refresh();

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Submission Failed",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        )
    }

    if (!course) {
        return <p>Course not found or not available for purchase.</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/courses/${course.id}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline">Complete Your Purchase</h1>
                    <p className="text-muted-foreground">
                        Pay for "{course.title}" and upload your proof of payment.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Make Payment</CardTitle>
                        <CardDescription>
                            Scan one of the QR codes below to pay the course fee of <span className="font-bold text-primary">₱{course.price.toFixed(2)}</span>. Please take a screenshot of the successful transaction.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-x-8 gap-y-6 justify-items-center">
                         {qrCodes.filter(qr => qr.path && qr.label).map((qr, index) => (
                             <div key={index} className="text-center space-y-2">
                                <h3 className="font-semibold">{qr.label}</h3>
                                <Image src={qr.path} width={200} height={200} alt={`${qr.label} QR Code`} data-ai-hint="QR code" />
                            </div>
                         ))}
                         {qrCodes.length === 0 && (
                            <p className="col-span-2 text-muted-foreground text-center">No payment methods are configured. Please contact an administrator.</p>
                         )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Submit Proof</CardTitle>
                        <CardDescription>
                            Upload your payment screenshot and enter the transaction reference number.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reference Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter the transaction reference" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="proofImagePath"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Proof of Payment</FormLabel>
                                            <FormControl>
                                                <ImageUpload
                                                    onUploadComplete={(path) => field.onChange(path)}
                                                    initialPath={field.value}
                                                    onRemove={() => field.onChange("")}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Submit for Validation
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
