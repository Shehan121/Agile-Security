module.exports = {
  preset: 'ts-jest',

  testEnvironment: 'node',

  globals: {
    'ts-jest': {
      tsconfig: 'test/api/tsconfig.json'
    }
  },

  testRegex: '.*Spec\\.ts$',

  collectCoverageFrom: [
    'lib/utils.ts',
    'lib/insecurity.ts'
  ]
}