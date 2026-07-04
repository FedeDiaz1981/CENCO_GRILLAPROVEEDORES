module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/lib/", "/dist/", "/release/", "/temp/"],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  collectCoverageFrom: [
    "lib/webparts/cencoPdpGrillaProvVehiculos/**/*.js",
    "!lib/**/*.d.ts",
  ],
  moduleFileExtensions: ["js", "json"],
};
