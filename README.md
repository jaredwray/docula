# Docula
Beautiful documentation for your projects

## :warning: - this is currently under development. Please do not use.

## Features

- Zero Config - Just drop it in and it works
- Can run from `npx` or installed globally
- Uses `dotenv` to load environment variables
- Knowledge Base that is easy to setup and manage
- Beautiful and Responsive Design (Like Stripe or 11ty)
- Search Engine Optimized
- Search Engine Plugin (Algolia & Google Search) that pushes the content to the search service.
- Swagger Enabled for API documentation
- Convention over Configuration - just add your files, use a template (or build your own) and you're done.
- Step by Step Guides Built in - Just setup the files in a single folder and state which step they are and it will work.
- Will generate a sitemap.xml
- Will generate a robots.txt
- Will generate a redirects.json file for Netlify, Vercel, and Cloudflare
- Will generate a release based on Github Releases.
- Generatses an RSS feed.xml file to use and share 
- Will pull your latest tweets and display them on the site
- Easily add in a blog to your site if needed

## Research
- Is there a swagger version for api libraries?


## Supported Search Plugins
- Algolia
- Google Programmable Search - https://programmablesearchengine.google.com/
- FlexSearch (Default) - https://www.npmjs.com/package/flexsearch

This is a plugin framework so others can be added to the docula system. If you want to add one, please submit a PR.

## Example Documenation Sites to Mirror
- https://www.algolia.com/doc/
- https://stripe.com/docs
- https://11ty.dev/docs/

## Site Structure

- `docs` - contains the documentation files
- `api` - contains the API documentation files (Swagger)
- `data` - contains the data files
- `templates` - contains the templates files
- `public` - contains the static files
- `blog` - contains the blog files and images
- `.env` - contains all the environment variables

This will all be generated in the `dist` folder by default. To change that you can use the `--output=<folder_name>` flag.

## Swagger File but Apiary Look and Feel
No need to say any more. Just look at apiary and swagger side by side.

### Github Integration
- Pull all of your Sponsors and Display Them
- Pull all of your Contributors and Display Them
- Ability to pull all of the email info for a newsletter that uses your project
- Pulls your release notes and puts it into a good looking data format for your templates
- Pulls your project stats based on Github Forks, Stars, and Watchers

## Package Managers
- pulls your package manager stats based on NPM, crate, pip, and nuget

### Templates
- Multiple Templates (Need at Least 4 at launch)
- Pull them down directly from the command line `docula install-template <template-name>`
- notify if there is an update via build process

### Export Capabilities
- Export from Zendesk
- Export from Confluence
- Export from Intercom
- Export from Rust Docs

## How the CLI should work
To create a new project it should be as simple as:
```bash
docula init <project-name>
```

This will actually do all the scaffolding for the site setting up the package.json, the config file, and the templates. It will also install the default template.

To download a new template just do:
```bash
docula template add <template-name>
```

To remove a template:
```bash
docula template remove <template-name>
```

To update a template:
```bash
docula template update <template-name>
```

To build the site just do:
```bash
docula <path optional>
```

To build the site and watch for changes:
```bash
docula <path optional> --serve --watch --port=8081
```

### Exporting from Providers
To export from a provider just do:
```bash
docula export <provider_name> --<options>
```

