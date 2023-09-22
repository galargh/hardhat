const {
  slowImportsCommonIgnoredModules,
} = require("../../config/eslint/constants");

module.exports = {
  extends: [`${__dirname}/../../config/eslint/eslintrc.js`],
  parserOptions: {
    project: `${__dirname}/src/tsconfig.json`,
    sourceType: "module",
  },
<<<<<<< HEAD
  rules: {
    "@typescript-eslint/no-non-null-assertion": "error",
  },
  overrides: [
    {
      files: ["src/internal/index.ts"],
      rules: {
        "@nomicfoundation/slow-imports/no-top-level-external-import": [
          "error",
          {
            ignoreModules: [...slowImportsCommonIgnoredModules],
          },
        ],
      },
    },
  ],
||||||| 410686211
=======
  rules: {
    "@typescript-eslint/no-non-null-assertion": "error"
  }
>>>>>>> rethnet/main
};
