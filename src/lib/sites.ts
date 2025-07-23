
'use server';

import { getDb } from './db';
import type { RowDataPacket } from 'mysql2';

export interface Site {
    id: string;
    name: string;
}

// Since sites are now stored in the database, this becomes a function to query them.
export async function getAllSites(): Promise<Site[]> {
    try {
        const db = await getDb();
        const [rows] = await db.query<RowDataPacket[]>('SELECT id, name FROM sites ORDER BY name');
        return rows as Site[];
    } catch (error) {
        console.error("Failed to fetch sites from database. Returning empty array.", error);
        // In case of DB connection error, prevent the app from crashing.
        return [];
    }
}

export async function getSiteById(id: string): Promise<Site | undefined> {
    try {
        const db = await getDb();
        const [rows] = await db.query<RowDataPacket[]>('SELECT id, name FROM sites WHERE id = ?', [id]);
        return rows[0] as Site | undefined;
    } catch (error) {
        console.error(`Failed to fetch site by ID ${id}.`, error);
        return undefined;
    }
}
