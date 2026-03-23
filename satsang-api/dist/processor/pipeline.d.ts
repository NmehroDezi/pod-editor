export declare function processAudioCleanup(jobId: string, jobDir: string, inputFiles: string[]): Promise<void>;
export declare function processAudioMixing(jobId: string, jobDir: string, musicPath?: string): Promise<void>;
export declare function processFadeOut(jobId: string, jobDir: string): Promise<void>;
export declare function generateThumbnail(jobId: string, jobDir: string, thumbnailPrompt: string): Promise<void>;
export declare function processPodcast(jobId: string, jobDir: string, inputFiles: string[], thumbnailPrompt: string): Promise<void>;
//# sourceMappingURL=pipeline.d.ts.map