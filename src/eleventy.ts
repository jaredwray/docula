// @ts-ignore
import {Eleventy as Elev} from '@11ty/eleventy';
import {Config} from "./config.js";

export class Eleventy {

    private _config = new Config();

    constructor(config: any) {
        this._config = config;
    }

    get config() {
        return this._config;
    }

    public build() {
        new Elev('site', '_dist', {
            quietMode: true,

            config: function(eleventyConfig: any) {

            },
        });
    }

}