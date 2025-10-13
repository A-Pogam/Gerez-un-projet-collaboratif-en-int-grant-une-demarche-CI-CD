// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  const isCI = !!process.env.CI;

  // 🔹 Si on est dans GitHub Actions (variable CI=true),
  // on va utiliser le Chrome intégré de Puppeteer (pas besoin d'installation système)
  if (isCI) {
    process.env.CHROME_BIN = require('puppeteer').executablePath();
  }

  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/bobapp'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,

    autoWatch: !isCI,
    singleRun: isCI,
    browsers: [isCI ? 'ChromeHeadlessNoSandbox' : 'Chrome'],

    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-zygote',
          '--disable-software-rasterizer'
        ]
      }
    },

    restartOnFileChange: true
  });
};
