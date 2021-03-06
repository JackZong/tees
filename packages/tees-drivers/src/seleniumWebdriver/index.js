const fs = require('fs');
const {
  Builder,
  By,
  until
} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const safari = require('selenium-webdriver/safari');
const ie = require('selenium-webdriver/ie');
const edge = require('selenium-webdriver/edge');
const path =require('path');
require('geckodriver');
require('chromedriver');
const {
  Driver: BaseDriver,
  Query: BaseQuery
} = require('../base');


const Browsers = {
  chrome: 'chrome',
  edge: 'MicrosoftEdge',
  firefox: 'firefox',
  ie: 'internet explorer',
  safari: 'safari',
};

const seleniumWebdriverSetting = {
  safari: new safari.Options(),
  chromeHeadless: new chrome.Options().headless(),
  chrome: new chrome.Options(),
  firefoxHeadless: new firefox.Options().headless(),
  firefox: new firefox.Options(),
  ie: new ie.Options(),
  edge: new edge.Options(),
};
const setting = {
  headless: false,
  ignoreHTTPSErrors: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--disable-setuid-sandbox',
    '--no-sandbox',
  ]
};

class Query extends BaseQuery {
  async getText(selector, options) {
    const element = await this._getElement(selector, options);
    const innerText = element.getAttribute('innerText');
    return innerText;
  }

  async getAttribute(selector, attribute, options = {}) {
    const element = await this._getElement(selector, options);
    const attributeValue = await element.getAttribute(attribute);
    return attributeValue;
  }

  async getProperty(selector, property, options) {
    const propertyValue = await this.getAttribute(selector, property, options);
    return propertyValue;
  }

  async getValue(selector, options) {
    const value = this.getAttribute(selector, 'value', options);
    return value;
  }

  async html(selector) {
    const html = this.getAttribute(selector, 'innerHTML');
    return html;
  }

  async click(selector, options) {
    const element = await this._getElement(selector, options);
    await element.click();
  }

  async type(selector, value, options) {
    const element = await this._getElement(selector, options);
    if (options && options.delay) {
      for (const char of value) {
        await element.sendKeys(char);
        await this.waitFor(options.delay);
      }
    } else {
      await element.sendKeys(value);
    }
  }

  async waitForSelector(selector, options) {
    const element = await this._getElement(selector, options);
    return element;
  }

  async url() {
    return this._node.getCurrentUrl();
  }

  async goto(url) {
    await this._node.get(url);
  }

  async getNewOpenPage() {
    await this.waitFor(3000);
    const handles = await this._node.getAllWindowHandles();
    await this._node.switchTo().window(handles[handles.length - 1]);
    return this._node;
  }

  async clickToGetNewOpenPage(selector, browser, options = {}) {
    await this.click(selector, options);
    await this.waitFor(3000);
    const handles = await this._node.getAllWindowHandles();
    await this._node.switchTo().window(handles[handles.length - 1]);
    return this._node;
  }
    
  async backPreviousPage() {
    const handles = await this._node.getAllWindowHandles();
    if(handles.length > 1 ) {
      await this._node.switchTo().window(handles[handles.length - 2]);
    } else {
      await this._node.switchTo().window(handles[handles.length - 1]);
    }
  }

  async screenshot({
    path
  } = {}) {
    await this._node.takeScreenshot().then((data) => {
      const base64Data = data.replace(/^data:image\/png;base64,/, '');
      fs.writeFile(path, base64Data, 'base64');
    });
  }

  async waitForFrames(frames) {
    for (const frame of frames) {
      const element = await this._node.wait(until.elementLocated(By.css(frame)));
      await this._node.switchTo().frame(element);
    }
    return this._node;
  }

  async execute(...args) {
    let script = args.shift();
    if ((typeof script !== 'string' && typeof script !== 'function')) {
      throw new Error('number or type of arguments don\'t agree with execute protocol command');
    }
    if (typeof script === 'function') {
      script = `return (${script}).apply(null, arguments)`;
    }
    // TODO safari
    const handle = this._node.executeScript(script, args);
    await this.waitFor(100);
    // wait for applying to UI.
    return handle;
  }

  async clear(selector, options) {
    const element = await this._getElement(selector, options);
    element.clear();
  }

  async waitForFunction(...args) {
    const result = await this.execute(...args);
    if (result) return;
    await this.waitFor(250);
    await this.waitForFunction(...args);
  }

  async _getElement(selector, options) {
    const _selector = this.getSelector(selector, options);
    const element = await this._node.wait(until.elementLocated(By.css(_selector)));
    return element;
  }

  async $(selector, options) {
    const _selector = this.getSelector(selector, options);
    const element = this._node.findElement(By.css(_selector));
    return element;
  }

  async $$(selector, options) {
    const _selector = this.getSelector(selector, options);
    const elements = this._node.findElements(By.css(_selector));
    return elements;
  }
}


module.exports = (browser) => {
  const webdriver = browser.toLowerCase();
  const setKeyName = `set${browser}Options`;
  const setting = seleniumWebdriverSetting[webdriver];
  class Driver extends BaseDriver {
    constructor(options = {}, program = new Builder()) {
      super(options, program);
    }

    async run({configSetting, isHeadless, type, extension = '' } = {}) {
      this._isHeadless = isHeadless;
      const isExtension = type === 'extension';
      let mergeSetting;
      let ddOptions;
      if (isExtension) {
        const extPath = path.resolve(process.cwd(), extension);
        const dr = {
          firefox: firefox,
          chrome: chrome
        }[webdriver]||{};
        ddOptions = new dr.Options().addExtensions(extPath);
        mergeSetting = {
          ...this._options.driver.setting,
          ...configSetting && configSetting.args || '',
          ...ddOptions
          
        }
      }
      
      if (this._isHeadless) {
        _setting = seleniumWebdriverSetting[`${webdriver}Headless`] || _setting;
      }

      try {
        const dd = new Builder()
        .forBrowser(Browsers[webdriver])
        .setFirefoxOptions(ddOptions)
        .setChromeOptions(ddOptions)
          // .forBrowser(Browsers[webdriver])[setKeyName](
          //   _setting
          // )
          // .withCapabilities({
          //   browserName: webdriver,
          //   acceptSslCerts: true,
          //   acceptInsecureCerts: true
          // })
          .build();
          this._browser = dd;
      }
      catch(err){
        this.handleFailure(err, this._browser)
      }
    }

    async handleFailure(err, driver) {
      console.error('Something went wrong!\n', err.stack, '\n');
      driver.quit();
    } 

    async newPage() {
      this._page = this._browser;
    }

    async goto(config) {
    if (config.type === 'extension') {
      await this._browser.get('about:debugging');
      const element = await this._browser.findElement(By.css(`li[data-addon-id='${config.extname}']> dl > dd[class*='internal-uuid']>span`));
      const uuid = await  element.getAttribute('title');
      const location = `moz-extension://${uuid}/standalong.html`;
      await this._browser.get(location);
    } else {
      await this._browser.get(config.location);
    }
  }

    async closePage() {
      await this.close();
    }

    async close() {
      if (this._browser) {
        try {
          await this._browser.close();
        } catch (e) {
          // console.error(e);
        }
        try {
          await this._browser.quit();
        } catch (e) {
          // console.error(e);
        }
      }
    }
  }

  return {
    Driver,
    setting,
    Query,
  };
};
