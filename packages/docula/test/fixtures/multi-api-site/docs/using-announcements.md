---
title: Using Announcements
order: 9
---

# Home Page Announcements

You can display an announcement banner on your home page by creating an `announcement.md` file in your site directory. This is useful for highlighting important updates, new releases, or any time-sensitive information.

## Usage

Create an `announcement.md` file in your site folder:

```
site
├───announcement.md
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

Add your announcement content using markdown:

```md
**New Release:** Version 2.0 is now available! Check out the [release notes](/releases) for details.
```

The announcement will automatically appear on the home page above the "Documentation" button, styled as an alert box with a colored left border.

## Styling

The announcement uses your theme's CSS variables and displays with:
- A subtle background using `--sidebar-background`
- A prominent left border using `--color-secondary`
- Links styled with `--color-primary`

You can customize the appearance by overriding the `.announcement` class in your `variables.css`:

```css
.announcement {
  background-color: #fff3cd;
  border-left-color: #ffc107;
}
```

## Removing the Announcement

Simply delete the `announcement.md` file when you no longer need the announcement. The home page will automatically return to its normal layout.
