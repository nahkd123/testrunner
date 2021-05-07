export interface TestCaseEntry {
    name: string;
    success: number;
    total: number;
    children?: TestCaseEntry;
    parent?: TestCaseEntry;
}
export type AssertFunction = (a: any, b: any) => void;
export type FailFunction = (reason?: any) => void;
export type TestCase = (assert: AssertFunction, fail: FailFunction) => void;

export class AssertError extends Error {
    constructor(public va: any, public vb: any) {
        super("Assert failed: " + va + " !== " + vb);
    }
}
class ChildCaseError extends Error {
    constructor(public childError: any) {
        super("Children error");
    }
}

const STACKTRACE_REGEX = /((.+)\(((.+):(\d+):(\d+))\)|(.+):(\d+):(\d+))/;

export class TestRunner {
    private _runningCase: TestCaseEntry = null;
    get runningCaseName() {
        let $case = this._runningCase;
        let name = $case.name;
        while ($case.children) {
            $case = $case.children;
            name += "/" + $case.name;
        }
        return name;
    }
    get lastCase() {return this.getLastCase();}
    private _lastFailed = false;
    ignorePaths: string[] = ["testrunner\\build\\index.js"];

    constructor(name: string) {
        this._runningCase = {
            name,
            success: 0, total: 0
        };
        this._printCaseName();
    }

    private _printCaseName() {
        process.stdout.write("\r\x1b[90m > \x1b[90m" + this.runningCaseName + "\x1b[0m");
    }
    private _caseSuccess() {
        process.stdout.write("\r\x1b[90m > \x1b[90m" + this.runningCaseName + " \x1b[92mPASSED\x1b[0m\n");
    }
    private _caseFailed(reason: any) {
        process.stdout.write("\r\x1b[90m > \x1b[91m" + this.runningCaseName + " \x1b[1mFAILED ");
        if (reason instanceof Error) {
            if (reason instanceof AssertError) process.stdout.write("\x1b[0;91m(Assert Failed: " + reason.va + " != " + reason.vb + ")\x1b[0m\n");
            else {
                process.stdout.write("\x1b[0;91m(Error thrown)\x1b[0m\n");
                process.stdout.write("\x1b[97m   Message: \x1b[1m" + reason.message + "\x1b[0m\n");
            }
            process.stdout.write("\n\x1b[90m   Stack trace:\n");

            let stack = reason.stack.split("\n").splice(1).map(v => v.trim().substr(3).match(STACKTRACE_REGEX));
            let windowSize = process.stdout.getWindowSize();
            const sourceLength = windowSize[0] - 32 - 16;

            stack.forEach(stacktrace => {
                const caller = (stacktrace[2] || "").padStart(32, " ");
                let source = (stacktrace[4] || stacktrace[7]);
                const line = (stacktrace[5] || stacktrace[8]);
                const col = (stacktrace[6] || stacktrace[9]);
                if (
                    source.startsWith("node:internal") ||
                    this.ignorePaths.find(v => source.endsWith(v)) !== undefined
                ) return;
                if (source.length > sourceLength) source = "..." + source.substr(source.length - sourceLength, sourceLength - 3);
                else source = source.padEnd(sourceLength, " ");

                process.stdout.write(`\x1b[95m${caller} \x1b[97m${source} \x1b[0;90m[\x1b[0;97mL\x1b[0;96m${line}, \x1b[0;97mC\x1b[0;96m${col}\x1b[0;90m]\n`);
            });
            process.stdout.write("\x1b[0m");
            return;
        }
        process.stdout.write("\x1b[0m\n");
    }

    getLastCase() {
        let $case = this._runningCase;
        while ($case.children) $case = $case.children;
        return $case;
    }

    enterCase(name: string) {
        let parent = this.lastCase;
        this.lastCase.children = {
            name,
            success: 0,
            total: 0,
            parent
        };
        return this.lastCase;
    }
    leaveCase() {
        this.lastCase.parent.children = undefined;
    }

    caseOf(name: string, testCase: TestCase) {
        let $case = this.enterCase(name);

        let fail: FailFunction = (reason) => {
            throw reason;
        };
        let assert: AssertFunction = (a, b) => {
            $case.total++;
            if (a !== b) fail(new AssertError(a, b));
            $case.success++;
        };
        try {
            this._printCaseName();
            testCase(assert, fail);
            if (!this._lastFailed) this._caseSuccess();
        } catch (e) {
            if (e instanceof ChildCaseError) return;
            this._caseFailed(e);
            this.leaveCase();
            process.exit(1);
            //throw new ChildCaseError(e);
        }
        this.leaveCase();
    }
}

let runningCase: TestRunner;
export function initTestRunner(name: string) {
    return runningCase = new TestRunner(name);
}
export function caseOf(name: string, testCase: TestCase) {
    if (!runningCase) initTestRunner("test");
    runningCase.caseOf(name, testCase);
}