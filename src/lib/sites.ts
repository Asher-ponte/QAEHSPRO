
import { getDb } from './db';

export interface Site {
    id: string;
    name: string;
}

// This remains the source for the core, un-deletable sites.
export const CORE_SITES: Site[] = [
    { id: 'main', name: 'QAEHS Main Site' },
    { id: 'branch-one', name: 'Branch One' },
    { id: 'branch-two', name: 'Branch Two' },
    { id: 'external', name: 'External Users' },
];

export async function getAllSites(): Promise<Site[]> {
    const db = await getDb('main');
    // The table might not exist on first run, so handle errors gracefully.
    const customSites = await db.all<Site[]>('SELECT * FROM custom_sites ORDER BY name').catch(() => []);
    
    const allSitesMap = new Map<string, Site>();

    // Add core sites first
    for (const site of CORE_SITES) {
        allSitesMap.set(site.id, site);
    }
    // Add custom sites, overwriting if an ID somehow conflicts (though this shouldn't happen with validation)
    for (const customSite of customSites) {
        allSitesMap.set(customSite.id, customSite);
    }
    
    return Array.from(allSitesMap.values());
}

export async function getSiteById(id: string): Promise<Site | undefined> {
    const sites = await getAllSites();
    return sites.find(site => site.id === id);
}
