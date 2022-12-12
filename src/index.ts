import {createCommand} from "commander";
import {Docula} from "./docula.js";

export class Executable {

    async parseCLI(process: NodeJS.Process) {
        const program = createCommand();

        program.storeOptionsAsProperties(true);

        program.command('build', {isDefault: true})
          .description('Build the site')
          .option("-c, --config <config>", "Path of where the config file is located")
          .action(async (options: any) => {
              try{
                  const docula = new Docula(options);
                  await docula.build();
              } catch (error: any) {
                  console.error('Error: '+ error.message);
              }
          })

        program.command('template')
          .action(async (options: any) => {
            try {

            } catch (error: any){
                console.error('Error: '+ error.message);
            }
        })

        program.parse(process.argv);
    };
}
