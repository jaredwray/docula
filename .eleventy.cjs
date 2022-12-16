const luxon = require('luxon');
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const pluginTOC = require('eleventy-plugin-toc')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')

const DateTime = luxon.DateTime;

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({'public': '.'});
  eleventyConfig.addPassthroughCopy({'site/template/images': '/images/'});

  eleventyConfig.setLibrary(
    'md',
    markdownIt().use(markdownItAnchor)
  )

  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(pluginTOC , {
    tags: ['h2'],
  });


  function formatDate(date, format) {
    if(date) {
      return DateTime.fromJSDate(date).toUTC().toFormat(format);
    }
    return DateTime.now().toUTC().toFormat(format);
  }

  //shortcodes
  eleventyConfig.addShortcode("formatDate", function(date, format) {
    return formatDate(date, format);
  });

  eleventyConfig.addShortcode("year", function () {
    return DateTime.local().toUTC().toFormat('yyyy');
  });

  //filters
  eleventyConfig.addFilter("squash", function(text) {
    const content = text.toString().toLowerCase();

    // remove duplicated words
    const words = content.split(' ');
    const deduped = [...(new Set(words))];
    const dedupedStr = deduped.join(' ')

    //remove repeated spaces
    return dedupedStr.replace(/[ ]{2,}/g, ' ');
  })


  return {
    templateFormats: [
      "md",
      "njk",
      "html",
      "liquid"
    ],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: "site",
      output: "dist",
      includes: "template",
      data: "template/data"
    },
    templateExtensionAliases: {
      "11ty.cjs": "11ty.js",
    },
    passthroughFileCopy: true
  }
};
