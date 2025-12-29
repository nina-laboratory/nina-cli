
export interface VersionUpdate {
    filePath: string;
    currentVersion: string;
    newVersion: string;
}

export interface CommitAction {
    repoName: string;
    repoPath: string; // Absolute path
    changes: {
        files: {
            modified: number;
            created: number;
            deleted: number;
        };
        lines: {
            added: number;
            deleted: number;
        };
    };
    commitMessage: string;
    versionUpdates: VersionUpdate[];
}

export interface ShipperPlan {
    createdAt: string;
    actions: CommitAction[];
}
