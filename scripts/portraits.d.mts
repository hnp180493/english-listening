export declare const SHEET_LAYOUT: readonly string[];
export declare const RESIDENTS: Readonly<Record<string, string>>;
export type ParsedName = { id: string; kind: 'auto' | 'grid' } | { id: string; kind: 'cell'; mood: string };
export declare function parseName(file: string): ParsedName | null;
export declare function panelSpans(gap: readonly boolean[]): [number, number][] | null;
export declare function openBrowser(): Promise<{ run(expression: string): Promise<unknown>; close(): Promise<void> }>;
