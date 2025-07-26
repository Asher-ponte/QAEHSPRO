

import { Suspense } from "react"
import { Certificate } from "@/components/certificate"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { Logo } from "@/components/logo"
import { getAllSites } from "@/lib/sites";

interface CertificateData {
  id: number;
  completion_date: string;
  certificateNumber: string | null;
  type: 'completion' | 'recognition';
  reason: string | null;
  companyName: string;
  companyAddress: string | null;
  companyLogoPath: string | null;
  companyLogo2Path: string | null;
  siteId: string;
  user: { username: string; fullName: string | null };
  course: { title: string; venue: string | null } | null;
  signatories: { name: string; position: string | null; signatureImagePath: string }[];
}

async function fetchCertificateData(number: string, siteId: string): Promise<{ data: CertificateData | null; error: string | null }> {
    try {
        const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/certificate/validate?number=${number}&siteId=${siteId}`;
        const res = await fetch(url, { cache: 'no-store' });
        
        const responseData = await res.json();
        
        if (!res.ok) {
            return { data: null, error: responseData.error || `Failed to fetch data, status: ${res.status}` };
        }

        return { data: responseData, error: null };

    } catch (error) {
        console.error("Failed to validate certificate:", error);
        return { data: null, error: 'Failed to retrieve certificate data due to a network or server error.' };
    }
}


async function CertificateValidator({ certificateNumber, siteId }: { certificateNumber?: string | string[], siteId?: string | string[] }) {
    const allSites = await getAllSites();

    if (!certificateNumber || typeof certificateNumber !== 'string' || !siteId || typeof siteId !== 'string') {
        return (
            <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <CardHeader>
                        <div className="flex items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                        <div>
                            <CardTitle className="text-red-800 dark:text-red-300">Validation Error</CardTitle>
                            <CardDescription className="text-red-700 dark:text-red-400">
                                Certificate number and Site ID must be provided in the URL.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        )
    }
    
    if (!allSites.some(s => s.id === siteId)) {
        return (
            <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <CardHeader>
                        <div className="flex items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                        <div>
                            <CardTitle className="text-red-800 dark:text-red-300">Validation Error</CardTitle>
                            <CardDescription className="text-red-700 dark:text-red-400">
                                The specified site is invalid.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        )
    }

    const { data, error } = await fetchCertificateData(certificateNumber, siteId);

    if (error) {
         return (
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
        )
    }
    
    if (data) {
        return (
            <>
                <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                            <div>
                                <CardTitle className="text-green-800 dark:text-green-300">Certificate Valid</CardTitle>
                                <CardDescription className="text-green-700 dark:text-green-400">
                                    This certificate has been successfully verified for site: {allSites.find(s => s.id === siteId)?.name}.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
                <div className="w-full overflow-x-auto">
                    <Certificate data={data} />
                </div>
            </>
        )
    }

    return null;
}

export default function ValidateCertificatePage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex justify-center mb-4">
                <Logo />
            </div>
            <Suspense fallback={<div className="text-center p-8">Validating certificate...</div>}>
                <CertificateValidator certificateNumber={searchParams.number} siteId={searchParams.siteId} />
            </Suspense>
        </div>
    )
}
