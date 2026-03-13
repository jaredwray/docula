---
title: Custom Scripts
order: 6
---

# Adding Custom Scripts

Docula lets you inject custom scripts — such as Google Tag Manager, analytics, or any third-party snippet — using [partial template overrides](/docs/partial-templates). No extra configuration is needed; just create the right override file and add your code.

## Scripts at End of Body

Override `includes/scripts.hbs` to add scripts that load at the end of every page. This is the recommended placement for analytics and tracking snippets.

Create the override file:

```bash
mkdir -p site/templates/modern/includes
```

Then create `site/templates/modern/includes/scripts.hbs`:

```handlebars
<!-- Google Tag Manager -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXX');
</script>

<!-- Keep the built-in scripts by copying them from the original template, -->
<!-- or include only your additions if you don't need the defaults. -->
```

> [!NOTE]
> When you override `scripts.hbs`, it **replaces** the built-in file entirely. If you still need the default scripts (theme toggle, syntax highlighting, etc.), copy the contents of the original `templates/modern/includes/scripts.hbs` from the [Docula repository](https://github.com/jaredwray/docula) and add your custom code alongside it.

## Scripts in the Head

Override `includes/header.hbs` to add scripts or meta tags inside the `<head>` element. This is useful for snippets that must load before the page renders.

Create `site/templates/modern/includes/header.hbs` with the original header content plus your additions:

```handlebars
<!-- Copy the original header.hbs content here, then add your scripts -->

<!-- Example: Google site verification -->
<meta name="google-site-verification" content="your-verification-code" />

<!-- Example: Script that must be in <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXX');
</script>
```

## Hosting Scripts Locally

If you prefer to self-host script files, place them in the `public/` folder and reference them from your template overrides:

```
site/
  public/
    js/
      analytics.js
  templates/
    modern/
      includes/
        scripts.hbs
```

Then in your `scripts.hbs` override:

```handlebars
<script src="/js/analytics.js"></script>
```

Files in `site/public/` are copied to the root of the build output, so `/js/analytics.js` will be available at that path on your site.

## Notes

- This uses the [partial template override](/docs/partial-templates) system. Overrides only apply to built-in templates (`modern`, `classic`). If you use `templatePath` for a fully custom template, add scripts directly in your template files.
- If you are using the `classic` template, replace `modern` with `classic` in the directory paths above.
