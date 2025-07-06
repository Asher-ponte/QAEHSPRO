
import { Suspense } from "react"
import { Certificate } from "@/components/certificate"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { Logo } from "@/components/logo"
import { getDb } from '@/lib/db';
import { SITES } from "@/lib/sites";

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
  user: { username: string; fullName: string | null };
  course: { title: string; venue: string | null } | null;
  signatories: { name: string; position: string | null; signatureImagePath: string }[];
}

async function fetchCertificateData(number: string, siteId: string): Promise<{ data: CertificateData | null; error: string | null }> {
    try {
        const db = await getDb(siteId);
        
        const certificate = await db.get(
            `SELECT * FROM certificates WHERE certificate_number = ?`,
            [number]
        );

        if (!certificate) {
            return { data: null, error: 'Certificate not found.' };
        }
        
        const user = await db.get('SELECT username, fullName FROM users WHERE id = ?', certificate.user_id);
        
        let course = null;
        if (certificate.course_id) {
            course = await db.get('SELECT title, venue FROM courses WHERE id = ?', certificate.course_id);
        }

        const signatories = await db.all(`
            SELECT s.name, s.position, s.signatureImagePath
            FROM signatories s
            JOIN certificate_signatories cs ON s.id = cs.signatory_id
            WHERE cs.certificate_id = ?
        `, certificate.id);
        
        const settings = await db.all("SELECT key, value FROM app_settings WHERE key IN ('company_name', 'company_logo_path', 'company_logo_2_path', 'company_address')");
        
        const companyName = settings.find(s => s.key === 'company_name')?.value || 'Your Company Name';
        const companyLogoPath = settings.find(s => s.key === 'company_logo_path')?.value || null;
        const companyLogo2Path = settings.find(s => s.key === 'company_logo_2_path')?.value || null;
        const companyAddress = settings.find(s => s.key === 'company_address')?.value || null;

        const responseData = {
            id: certificate.id,
            completion_date: certificate.completion_date,
            certificateNumber: certificate.certificate_number,
            type: certificate.type,
            reason: certificate.reason,
            companyName: companyName,
            companyAddress: companyAddress,
            companyLogoPath: companyLogoPath,
            companyLogo2Path: companyLogo2Path,
            user: {
                username: user?.username || 'Unknown User',
                fullName: user?.fullName || null,
            },
            course: course,
            signatories: signatories,
        };

        return { data: responseData, error: null };

    } catch (error) {
        console.error("Failed to validate certificate:", error);
        return { data: null, error: 'Failed to retrieve certificate data due to a server error.' };
    }
}


async function CertificateValidator({ certificateNumber, siteId }: { certificateNumber?: string | string[], siteId?: string | string[] }) {
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
    
    if (!SITES.some(s => s.id === siteId)) {
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
                                    This certificate has been successfully verified for site: {SITES.find(s => s.id === siteId)?.name}.
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
