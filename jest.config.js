// Using ts-jest directly rather than next/jest: next/jest invokes the @next/swc native binary
// for transforms, which crashes with a Bus error in this sandbox (same crash seen from
// `next build`/`next dev` here — an environment limitation, not a code issue). ts-jest avoids
// the native binary entirely.
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/tests/e2e/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
};
