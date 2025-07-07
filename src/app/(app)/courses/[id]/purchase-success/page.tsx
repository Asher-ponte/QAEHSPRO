
"use client"

import { useEffect, useState, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

function PurchaseSuccessContent() {
    const params = useParams<{ id: string }>()
    const courseId = params.id
    const searchParams = useSearchParams()
    const router = useRouter()
    const { toast } = useToast()

    const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        const sessionId = searchParams.get('session_id')
        if (!sessionId) {
            setStatus('failed')
            setErrorMessage("Payment session ID not found. Your transaction may not have been processed.")
            return
        }

        async function verifyPayment() {
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

                setStatus('success')
                toast({
                    title: "Payment Successful!",
                    description: "You are now enrolled in the course.",
                })

                setTimeout(() => {
                    router.push(`/courses/${courseId}`)
                }, 3000)

            } catch (error) {
                const msg = error instanceof Error ? error.message : "An unknown error occurred."
                setStatus('failed')
                setErrorMessage(msg)
                toast({
                    variant: "destructive",
                    title: "Payment Verification Failed",
                    description: msg,
                })
            }
        }

        verifyPayment()
    }, [searchParams, toast, router, courseId])

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">
                    {status === 'verifying' && 'Verifying Your Payment...'}
                    {status === 'success' && 'Payment Successful!'}
                    {status === 'failed' && 'Payment Verification Failed'}
                </CardTitle>
                <CardDescription>
                    {status === 'verifying' && 'Please wait while we confirm your transaction.'}
                    {status === 'success' && 'You have been enrolled in the course. Redirecting...'}
                    {status === 'failed' && 'There was an issue with your payment.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
                {status === 'verifying' && <Loader2 className="h-16 w-16 animate-spin text-primary" />}
                {status === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
                {status === 'failed' && (
                    <div className="text-center space-y-4">
                        <XCircle className="h-16 w-16 text-destructive mx-auto" />
                        <p className="text-destructive">{errorMessage}</p>
                        <Button asChild>
                            <Link href={`/courses/${courseId}`}>Return to Course</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
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
