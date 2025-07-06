
export interface Site {
    id: string;
    name: string;
}

// NOTE: The 'id' must be a valid filename character set.
export const SITES: Site[] = [
    { id: 'main', name: 'QAEHS Main Site' },
    { id: 'branch-one', name: 'Branch One' },
    { id: 'branch-two', name: 'Branch Two' },
    { id: 'external', name: 'External Users' },
];

export function getSiteById(id: string): Site | undefined {
    return SITES.find(site => site.id === id);
}
