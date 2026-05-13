export class CLIUI {
    static spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    static spinnerIndex = 0;
    static spinnerTimer = null;
    static startSpinner(text) {
        process.stdout.write('\x1B[?25l'); // Hide cursor
        this.spinnerTimer = setInterval(() => {
            process.stdout.write(`\r\x1b[36m${this.spinnerFrames[this.spinnerIndex]}\x1b[0m ${text}...`);
            this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
        }, 80);
    }
    static stopSpinner(success = true, text) {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = null;
        }
        process.stdout.write('\r');
        if (success) {
            console.log(`\x1b[32m✔\x1b[0m ${text || 'Done'}`);
        }
        else {
            console.log(`\x1b[31m✘\x1b[0m ${text || 'Failed'}`);
        }
        process.stdout.write('\x1B[?25h'); // Show cursor
    }
    static heading(text) {
        console.log(`\n\x1b[1m\x1b[35m🐬 ${text}\x1b[0m\n`);
    }
    static error(text) {
        console.error(`\x1b[31m❌ Error: ${text}\x1b[0m`);
    }
    static success(text) {
        console.log(`\x1b[32m✅ ${text}\x1b[0m`);
    }
}
//# sourceMappingURL=ui.js.map