
"use client"

import { useEffect, useState, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

function PurchaseSuccessContent() {
    const params = useParams<{ id: string }>()
    const courseId = params.id
    const searchParams = useSearchParams()
    const router = useRouter()
    const { toast } = useToast()

    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    const handleVerifyPayment = async () => {
        setStatus('verifying');
        const sessionId = searchParams.get('session_id')
        
        if (!sessionId || sessionId === '{CHECKOUT_SESSION_ID}') {
            setStatus('failed');
            setErrorMessage("Invalid payment session ID in URL. Your payment may not have been processed correctly. Please contact support if you were charged.");
            return;
        }

        try {
            const response = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkoutSessionId: sessionId }),
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || "Verification failed.")
            }

            setStatus('success');
            toast({
                title: "Payment Successful!",
                description: "You are now enrolled in the course. Redirecting...",
            });
            setTimeout(() => {
                 router.push(`/courses/${courseId}`);
            }, 3000);

        } catch (error) {
            const msg = error instanceof Error ? error.message : "An unknown error occurred during verification."
            setStatus('failed');
            setErrorMessage(msg);
            toast({
                variant: "destructive",
                title: "Payment Verification Failed",
                description: msg,
            });
        }
    }

    const renderContent = () => {
        switch (status) {
            case 'verifying':
                return (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <Loader2 className="h-16 w-16 animate-spin text-primary" />
                        <p className="text-muted-foreground">Verifying your payment...</p>
                    </div>
                );
            case 'success':
                 return (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                         <p className="text-muted-foreground">You are now enrolled. Redirecting you to the course...</p>
                    </div>
                );
            case 'failed':
                return (
                    <div className="text-center space-y-4 py-8">
                        <XCircle className="h-16 w-16 text-destructive mx-auto" />
                        <p className="text-destructive font-medium">Verification Failed</p>
                        <p className="text-sm text-muted-foreground">{errorMessage}</p>
                    </div>
                );
            case 'idle':
            default:
                return (
                     <div className="text-center space-y-4 py-8">
                        <p className="text-muted-foreground">Thank you for your purchase. Please click the button below to complete your enrollment.</p>
                    </div>
                );
        }
    };
    
     const renderFooter = () => {
        switch (status) {
            case 'verifying':
                return <Button className="w-full" disabled>Verifying...</Button>;
            case 'success':
                return (
                    <Button className="w-full" disabled>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Success! Redirecting...
                    </Button>
                );
            case 'failed':
                 return (
                    <Button className="w-full" asChild>
                        <Link href={`/courses/${courseId}`}>
                            Return to Course Page <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                );
            case 'idle':
            default:
                return (
                     <Button className="w-full" onClick={handleVerifyPayment}>
                        Verify Payment and Access Course
                    </Button>
                );
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">Payment Confirmation</CardTitle>
                <CardDescription>
                    Final step to access your course.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
            <CardFooter>
                 {renderFooter()}
            </CardFooter>
        </Card>
    )
}

export default function PurchaseSuccessPage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Suspense fallback={<Loader2 className="h-16 w-16 animate-spin text-primary" />}>
                <PurchaseSuccessContent />
            </Suspense>
        </div>
    )
}
