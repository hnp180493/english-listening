export declare const AUDIO_MANIFEST_ELEMENT_ID: string;
export declare const AUDIO_LEDGER_FILE: string;
export declare function normalizeAudioManifest(json: unknown): Record<string, string>;
export declare function inlineAudioManifest(html: string, clips: Record<string, string>): string;
export interface AudioSyncResult {
  copied: number;
  kept: number;
  removed: number;
  missing: string[];
  files: number;
  bytes: number;
}
export declare function syncAudioFolder(srcDir: string, outAudioDir: string, files: Iterable<string>): Promise<AudioSyncResult>;
export declare const ART_LEDGER_FILE: string;
export declare function syncArtFolder(srcDir: string, outArtDir: string, files: Iterable<string>): Promise<AudioSyncResult>;
