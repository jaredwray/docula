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

  //collections
  eleventyConfig.addCollection('docsList', function(collection) {
    return collection.getFilteredByGlob("docs/*.md").reverse();
  });

  eleventyConfig.addCollection("sidebarNav", function(collection) {
    // filter out excludeFromSidebar options
    return collection.getAll()
      .filter(item => (item.data || {}));
  });

  //shortcodes
  eleventyConfig.addShortcode("formatDate", function(date, format) {
    return formatDate(date, format);
  });


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
