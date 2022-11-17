import { Docula } from '../src/docula';
import { DoculaOptions } from '../src/doculaOptions';

describe('Docula', () => {
    it('Docula - init', () => {
        const docula = new Docula();
        expect(docula).toBeDefined();
    });

    it('Docula - default outputPath to dist', () => {
        const docula = new Docula();
        expect(docula.outputPath).toBe("dist");
    });

    it('Docula - default sitePath to site', () => {
        const docula = new Docula();
        expect(docula.sitePath).toBe("site");
    });

    it('Docula - init with options', () => {
        const options: DoculaOptions = { sitePath: "site" };
        const docula = new Docula(options);
        expect(docula.sitePath).toBe("site");
    });

    it('Docula - init with options', () => {
        const options: DoculaOptions = { outputPath: "test" };
        const docula = new Docula(options);
        expect(docula.outputPath).toBe("test");
    });
});