module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    // Migraciones y seeders son scripts de sequelize-cli (DDL y datos), no
    // código de aplicación: no se ejecutan desde las pruebas unitarias y su
    // peso distorsionaba la métrica global sin aportar señal de calidad.
    // Se validan ejecutándolos de verdad con `yarn db:deploy`.
    '!src/database/migrations/**',
    '!src/database/seeders/**',
    // Los propios ficheros de prueba no se miden a sí mismos.
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      lines: 30,
      functions: 30,
      branches: 20,
      statements: 30,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
