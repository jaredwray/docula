
module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({'public': '.'});

  return {
    dir: {
      input: "templates/algolia",
      output: "dist",
      includes: "layout",
    },
    templateExtensionAliases: {
      "11ty.cjs": "11ty.js",
    },
    passthroughFileCopy: true
  }
};
