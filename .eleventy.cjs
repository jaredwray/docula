const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
const utc = require('dayjs/plugin/utc');
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const pluginTOC = require('eleventy-plugin-toc')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')


dayjs.extend(relativeTime)
dayjs.extend(utc)

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({'public': '.'});

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
      return dayjs.utc(date).format(format);
    }
    return dayjs.utc().format(format);
  }

  //shortcodes
  eleventyConfig.addShortcode("formatDate", function(date, format) {
    return formatDate(date, format);
  });

  //filters
  eleventyConfig.addFilter("squash", function(text) {
    const content = text.toString().toLowerCase();

    // remove duplicated words
    const words = content.split(' ');
    const deduped = [...(new Set(words))];
    const dedupedStr = deduped.join(' ')

    // remove short and less meaningful words
    let result = dedupedStr.replace(/\b(\.|\,|the|a|an|and|am|you|I|to|if|of|off|me|my|on|in|it|is|at|as|we|do|be|has|but|was|so|no|not|or|up|for)\b/gi, '');
    //remove newlines, and punctuation
    result = result.replace(/\.|\,|\?|-|—|\n/g, '');
    //remove repeated spaces
    result = result.replace(/[ ]{2,}/g, ' ');

    return result;
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
      includes: "algolia",
    },
    templateExtensionAliases: {
      "11ty.cjs": "11ty.js",
    },
    passthroughFileCopy: true
  }
};
