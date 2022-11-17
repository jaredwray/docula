import { DoculaOptions } from "./doculaOptions";

export class Docula {
    private _options: DoculaOptions = new DoculaOptions();

    constructor(options?: DoculaOptions) {
        if(options) {
            this._options = options;
        }
    }

    get options(): DoculaOptions {
        return this._options;
    }
}