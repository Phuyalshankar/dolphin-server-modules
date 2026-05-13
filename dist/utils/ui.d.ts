export declare class CLIUI {
    private static spinnerFrames;
    private static spinnerIndex;
    private static spinnerTimer;
    static startSpinner(text: string): void;
    static stopSpinner(success?: boolean, text?: string): void;
    static heading(text: string): void;
    static error(text: string): void;
    static success(text: string): void;
}
