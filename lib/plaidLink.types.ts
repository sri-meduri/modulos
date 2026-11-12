export interface PlaidInstitution { id?: string; name?: string }

export interface PlaidLauncherOptions {
    /** Link token; null until created. */
    token: string | null;
    /** Web only: the page was reloaded after a bank's OAuth login. */
    oauthResume: boolean;
    onSuccess: (publicToken: string, institution: PlaidInstitution) => void;
    /** `null` = user closed Link without an error. */
    onExit: (errorMessage: string | null) => void;
}
