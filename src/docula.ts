import { DoculaOptions } from "./doculaOptions";
import * as fs from "fs-extra";

export class Docula {
    private _sitePath: string = "site";
    private _outputPath: string = "dist";

    constructor(options?: DoculaOptions) {
        if(options) {
            this.loadOptions(options);
        }
    }

    get sitePath() {
        return this._sitePath;
    }

    get outputPath() {
        return this._outputPath;
    }

    private loadOptions(options: DoculaOptions) {
        if(options.sitePath) {
            this._sitePath = options.sitePath;
        }

        if(options.outputPath) {
            this._outputPath = options.outputPath;
        }
    }
}