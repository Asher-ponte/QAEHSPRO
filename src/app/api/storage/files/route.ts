
import { NextResponse, type NextRequest } from 'next/server';
import { storage } from '@/lib/firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { getCurrentSession } from '@/lib/session';

export async function GET(request: NextRequest) {
    const { user } = await getCurrentSession();
    if (!user || user.role !== 'Admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const listRef = ref(storage, 'Upload/');
        const res = await listAll(listRef);

        const files = await Promise.all(
            res.items.map(async (itemRef) => {
                const downloadURL = await getDownloadURL(itemRef);
                return {
                    name: itemRef.name,
                    url: downloadURL,
                };
            })
        );
        
        return NextResponse.json(files);

    } catch (error) {
        console.error("Firebase storage listing error:", error);
        return NextResponse.json({ error: 'Failed to list files from storage.' }, { status: 500 });
    }
}
