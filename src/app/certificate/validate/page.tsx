
"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Certificate } from "@/components/certificate"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { Logo } from "@/components/logo"

interface CertificateData {
  id: number;
  completion_date: string;
  certificateNumber: string | null;
  companyName: string;
  companyAddress: string | null;
  companyLogoPath: string | null;
  companyLogo2Path: string | null;
  user: { username: string };
  course: { title: string; venue: string | null };
  signatories: { name: string; position: string | null; signatureImagePath: string }[];
}

function CertificateValidator() {
  const searchParams = useSearchParams()
  const certificateNumber = searchParams.get('number')
  
  const [data, setData] = useState<CertificateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certificateNumber) {
        setError("No certificate number provided.");
        setIsLoading(false);
        return;
    }

    const fetchCertificate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/certificate/validate?number=${certificateNumber}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to validate certificate.");
            }
            const certData = await res.json();
            setData(certData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    fetchCertificate();
  }, [certificateNumber]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex justify-center mb-4">
            <Logo />
        </div>
        
        {isLoading && (
             <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-64" />
                    <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                     <Skeleton className="w-full aspect-[297/210]" />
                </CardContent>
            </Card>
        )}
        
        {!isLoading && data && (
            <>
            <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                        <div>
                            <CardTitle className="text-green-800 dark:text-green-300">Certificate Valid</CardTitle>
                            <CardDescription className="text-green-700 dark:text-green-400">
                                This certificate has been successfully verified.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
            <div className="w-full overflow-x-auto">
                <Certificate data={data} />
            </div>
            </>
        )}
        
        {!isLoading && error && (
            <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <CardHeader>
                     <div className="flex items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                        <div>
                            <CardTitle className="text-red-800 dark:text-red-300">Certificate Invalid</CardTitle>
                            <CardDescription className="text-red-700 dark:text-red-400">
                                Could not validate this certificate. Reason: {error}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        )}
    </div>
  )
}


export default function ValidateCertificatePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CertificateValidator />
        </Suspense>
    )
}
