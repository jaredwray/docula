import { DoculaOptions } from "./doculaOptions";

export class Docula {
    private _options: DoculaOptions = { sitePath: "site", outputPath: "dist" };

    constructor(options?: DoculaOptions) {
        this._options = {...this._options, ...options};
    }

    get options(): DoculaOptions {
        return this._options;
    }
}