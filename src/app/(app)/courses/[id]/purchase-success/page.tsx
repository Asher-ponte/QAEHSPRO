
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

    const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')
    const [message, setMessage] = useState('Verifying your payment, please wait...')

    useEffect(() => {
        const verifyPayment = async () => {
            const sessionId = searchParams.get('session_id')
            
            if (!sessionId || sessionId === '{CHECKOUT_SESSION_ID}') {
                setStatus('failed');
                setMessage("Invalid payment session ID in URL. Your payment may not have been processed correctly. Please contact support if you were charged.");
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
                setMessage("You are now enrolled. Redirecting you to the course...");
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
                setMessage(msg);
                toast({
                    variant: "destructive",
                    title: "Payment Verification Failed",
                    description: msg,
                    duration: 8000
                });
            }
        }
        
        verifyPayment();
    }, [searchParams, courseId, router, toast]);

    const renderContent = () => {
        switch (status) {
            case 'verifying':
                return (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <Loader2 className="h-16 w-16 animate-spin text-primary" />
                        <p className="text-muted-foreground">{message}</p>
                    </div>
                );
            case 'success':
                 return (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                         <p className="text-muted-foreground">{message}</p>
                    </div>
                );
            case 'failed':
                return (
                    <div className="text-center space-y-4 py-8">
                        <XCircle className="h-16 w-16 text-destructive mx-auto" />
                        <p className="text-destructive font-medium">Verification Failed</p>
                        <p className="text-sm text-muted-foreground">{message}</p>
                    </div>
                );
        }
    };
    
     const renderFooter = () => {
        if (status === 'verifying') {
            return <Button className="w-full" disabled>Verifying...</Button>;
        }
        if (status === 'success') {
            return (
                <Button className="w-full" disabled>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Success! Redirecting...
                </Button>
            );
        }
         return (
            <Button className="w-full" asChild>
                <Link href={`/courses/${courseId}`}>
                    Return to Course Page <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        );
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">Payment Confirmation</CardTitle>
                <CardDescription>
                    Finalizing your enrollment...
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
            <Suspense fallback={<Loader2 className="h-16 w-16 animate-spin text-primary