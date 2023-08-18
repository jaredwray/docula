# Docula Template Readme

Welcome to Docula's templates directory. You can use your own templates by specifiying the `--template` flag when running `docula` or in docula's config file using the `templatePath:` property.

Note that if you want to use your own templates just simply pull down an example template here and put it in the `<site_folder>/template` directory. We will always use that first before looking to use one of the templates in this directory.

In your repo you need to have the following files (single page site):
* README.md - this is your template's readme file
* variable.css (optional) - this is your template's css file
* docula.json - this is your template's config file
* logo.svg (optional) - this is your template's logo file

# Docs 
To create a `/docs` route for your documentation page, you will need to specify the document that will handle this route by adding the following at the top of your chosen file:
```
---
permalink: /docs/
---
```

## Properties
The following properties can also be included to customize your documentation page:

* `title`: The title of the page, which will be used to refer to the child-parent relationship in the sidebar (string).
* `order`: The order of the page in the sidebar (number) [optional].
* `parent`: The parent of the page in the sidebar (string) [optional].
* `sidebarTitle`: The title of the page in the sidebar. If not provided, the title will be used (string) [optional].

## Tree of Pages in the Sidebar
To create a sidebar with the following structure:

```
Getting Started
Animals
- Dogs
- Cats
  Plants
```
You will need to have the following file structure:

```
docs
├── getting-started.md
├── animals
│   ├── animals.md
│   ├── dogs.md
│   └── cats.md
└── plants.md
```
Add the following to the top of each file:

__getting-started.md__
```
---
title: Getting Started
order: 0
---
```

__animals.md__
```
---
title: Animals
permalink: false
---
```
Note: For a parent page you have 2 options you can either have a page that has content or don't have a page for the parent.
if you would like not to generate a page for the parent you could add the following to the top of the file: `permalink: false`

__dogs.md__
```
---
title: Canis lupus familiaris
sidebarTitle: Dogs
parent: Animals
---
```

__cats.md__
```
---
title: Felis catus
sidebarTitle: Cats
parent: Animals
---
```

__plants.md__
```
---
title: Plants
---
```

This file structure, along with the specified properties, will create a sidebar navigation that matches the example provided above.
