import { genkit } from 'genkit';
import { googleAI } from 'genkit/plugins/google-ai';
import { defineDotprompt } from 'genkit/plugins/dotprompt';

let configured = false;

export function configureGenkit() {
    if (configured) return;
    
    genkit({
        plugins: [
            googleAI(),
        ],
        // Log to the console in development, and disable logging in production.
        logLevel: process.env.NODE_ENV === 'production' ? 'silent' : 'debug',
        // Omit OpenTelemetry configuration for simplicity.
        enableTracing: false,
    });

    configured = true;
}

const ai = genkit();

export { ai };
