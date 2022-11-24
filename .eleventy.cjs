const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
const utc = require('dayjs/plugin/utc');
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");


dayjs.extend(relativeTime)
dayjs.extend(utc)

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({'public': '.'});
  eleventyConfig.addPlugin(eleventyNavigationPlugin);


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
