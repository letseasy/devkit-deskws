const {
    createCursor
} = require('./mouse.min.js');
const Headless = require('./headless.min.js');
const {
    PURCHASE_RETURNS,
    TASK_STATUS,
    getRandom
} = require('./utils.js');
const puppeteer = require('puppeteer');

const EtSelector = {
    'LOGIN_BUTTON': 'button.join-log-in',
    'LOGIN_EMAIL': '.emailAddress\x20>\x20input',
    'LOGIN_PASSWORD': '.password\x20>\x20input',
    'LOGIN_SUBMIT': '.loginSubmit\x20>\x20input',
    'LOGIN_CHECK': 'span[data-qa=\x27user-name\x27]',
    'LOGIN_CHECK_FAILED': '.nike-unite-error-message.errorMessage.nike-unite-component\x20>\x20ul\x20>\x20li',
    'CHECKOUT_CHECK': '.button-submit',
    'US_CHECKOUT_CHECK': '.checkout-modal',
    'REFILL_EXPAND': '.expand-collapse',
    'REFILL_EDIT': '.edit-address-link',
    'US_REFILL_EXPAND': '.open-close',
    'US_REFILL_EDIT': 'span[data-qa=\x22edit-address\x22]',
    'CHECKOUT_FILL_START': '.button-continue',
    'NATIONAL_ID': '#simpleId',
    'NATIONAL_ID_CONTINUE': '.button-continue',
    'US_CHECKOUT_SAVE': 'button[data-qa=\x22save-button\x22]',
    'US_CHECKOUT_SAVE_STEP': '.test-shipping-method-name',
    'US_NEW_CARD': 'button[name=\x22newCard\x22]',
    'NOTIFICATION_OK': 'a.ncss-btn-primary-dark.cta-btn.btn-lg',
    'SUBMIT_CONFIRM': 'button[data-qa=\x22presubmit-confirm\x22]'
};

const ItWaitingTime = {
    'LOGIN': 0xea60,
    'CHECKOUT': 0xea60,
    'NOTIFICATION': 0x1388,
    'NATIONAL_ID': 0x1388,
    'CONFIRM_DRAW': 0x1388
};

const bt50 = 50;
const kt250 = 250;

const RegionFt = ['US', 'GB', 'DE', 'BE', 'FR', 'NL', 'PL', 'CZ', 'ES', 'PT', 'JP', 'IT', 'DK'];
const Regionvt = ['GB', 'DE', 'BE', 'FR', 'NL', 'PL', 'CZ', 'ES', 'PT', 'IT', 'DK'];
const RegionLt = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH', 'GB'];

class snkrs {
    constructor() {
        this.waiting_for_results = false; // 不关闭浏览器
        // 需要带入的值
        this.productUrl = "";
        this.headless = true;
        this.proxyUrl = null;
        this.proxyCredentials = null; //  { username:string, password:string } : Object
        this.region = 'US';
        this.email = 'xyz12345@me.com';
        this.password = 'XYz12345';
        this.prev_login_data = null; // 登陆页面后获取的 user_id 等信息 , 具体包含项目最后整理 ???
        // 回调状态用于返回给上一级
        this.cbstatus = function (status) {

        }
        // 用于保存prev_login_data
        this.saveLoginData = function(prev_login_data) {

        }
        // 要获取的值
        this.entry_id = null; // http://nikehost?launchEntryId=aaaa
        this.accountVerifiedSmsNumber = null; // output
    }
    async start(){
        const loginRes = await this.checkLogin();
        console.log(loginRes);
    }
    // 打开页面
    async gotoProductUrl(url = this.productUrl, isLogin = true) {
        if (isLogin) {
            this.cbstatus(TASK_STATUS['LOADING_PAGE']);
        }
        try {
            const response = await this.page.goto(url);
            if (response.status() == 404) {
                return PURCHASE_RETURNS['PRODUCT_NOT_FOUND'];
            }
            return PURCHASE_RETURNS['NO_ERROR'];
        } catch (err) {
            this.log(err);
            if (err.name === 'TimeoutError') {
                return PURCHASE_RETURNS['SLOW_PROXIES'];
            } else if (err.toString().includes('net::ERR_TIMED_OUT')) {
                return PURCHASE_RETURNS['SLOW_PROXIES'];
            } else if (err.toString().includes('net::ERR_PROXY_CONNECTION_FAILED')) {
                return PURCHASE_RETURNS['BAD_PROXY'];
            }
            return PURCHASE_RETURNS['NAVIGATION_ERROR'];
        }
    }
    async login(reopen) {
        if (reopen) {
            // 重新打开一个页面
            let res = await this.gotoProductUrl();
            if (this.isError(res)) {
                return this['isError']; // ???
            }
        }
        this.cbstatus(TASK_STATUS['LOGGING_IN']);
        await this.page.waitForSelector(EtSelector['LOGIN_BUTTON']);
        await this.page.waitFor(1500);
        await this.page.waitFor(this.getRandomDelay());
        this.log('Clicking login button');
        await this.cursor.click(EtSelector['LOGIN_BUTTON']);
        this.log('Waiting for email');
        await this.page.waitForSelector(EtSelector['LOGIN_EMAIL']);
        await this.page.waitFor(1500);
        await this.page.waitFor(this.getRandomDelay());
        this.log('Filling login details');
        await this.fillElement(EtSelector['LOGIN_EMAIL'], this.email);
        await this.fillElement(EtSelector['LOGIN_PASSWORD'], this.password);
        await this.page.waitFor(1500);
        this.log('Submitting login');
        await this.cursor.click(EtSelector['LOGIN_SUBMIT']);
        this.log("Checking if logged in");
        let loginCheckFound = await this.selectorFound(EtSelector['LOGIN_CHECK'], ItWaitingTime['LOGIN']);
        this.log('loggedIn = ' + (loginCheckFound ? 'true' : 'false'));
        if (loginCheckFound) {
            return PURCHASE_RETURNS['SUCCESS_LOGIN'];
        }
        let checkFailedFound = await this.selectorFound(EtSelector['LOGIN_CHECK_FAILED'], ItWaitingTime['LOGIN']);
        if (checkFailedFound) {
            return PURCHASE_RETURNS['ERROR_LOGIN_FAILED'];
        }
        return PURCHASE_RETURNS['ERROR_LOGIN'];
    }
    async checkLogin() {
        const tryToLogin = async () => {
            let loginResult = await this.login(![]); // 不重新开页面登陆
            if (loginResult == PURCHASE_RETURNS['SUCCESS_LOGIN']) {
                // 获取user_id等值放在 this.login_data中 
                await this.getLoginDataFromUniteIFrame();
            } else {
                this.login_data = null;
            }
            this.log('loginResult', loginResult, 'login_data', this.login_data);
            return {
                'loginResult': loginResult,
                'login_data': JSON.stringify(this.login_data)
            };
        };
        // 初始化浏览器
        await this.initBrowser(this.headless);
        this.log('Going to page', this.productUrl);
        // 打开页面
        let res = await this.gotoProductUrl();
        if (this.isError(res)) {
            return {
                'loginResult': res,
                'login_data': null
            };
        }
        //
        await this.acceptCookiePopup();
        // 登录验证
        let loginDataRes = {};
        // 未获取到user_id等信息，prev_login_data值可以预设
        if (this.prev_login_data == null) {
            this.log('Logging in manually...');
            loginDataRes = await tryToLogin();
        } else {
            // 代表已经登陆过
            this.log("We attempting to refresh the token first, if we fail then we login manually.");
            // 注入prev_login_data到localStorage
            await this.injectLoginDataIntoLocalStorage();
            // 打开一个新的page
            let _0x5f1fd4 = await this.gotoProductUrl();
            if (this.isError(_0x5f1fd4)) {
                return {
                    'loginResult': _0x5f1fd4,
                    'login_data': null
                };
            }
            // 需要重新获取token并写到prev_login_data里
            let _0x1ab980 = await this.rRefreshToken(![]);
            if (_0x1ab980) {
                this.log("Successfully refreshed the login token", this.prev_login_data);
                loginDataRes = {
                    'loginResult': PURCHASE_RETURNS['SUCCESS_LOGIN'],
                    'login_data': this.prev_login_data
                };
            } else {
                // 如果重新获取登陆token失败，则再重新登陆
                this.log("Was not able to refresh the login token, we will log you in manually.");
                loginDataRes = await tryToLogin();
            }
        }
        this.log('Closing browser...');
        this.stop();
        this.log('Browser closed.');
        this.log('Returning ', loginDataRes);
        return loginDataRes;
    }
    // 初始化浏览器创建page实例
    async initBrowser(headless) {
        if (this.browser != null) return;
        let args = [
            '--window-size=1920,1080',
            '--no-sandbox',
            '--no-first-run',
            '--no-zygote',
            '--disable-features=site-per-process',
            '--disable-web-security'
        ];
        if (headless) {
            args.push('--disable-gl-drawing-for-tests');
        }
        if (this.proxyUrl) {
            args.push('--proxy-server=' + this.proxyUrl);
        }
        this.browser = await puppeteer.launch({
            'args': args,
            'ignoreHTTPSErrors': !![],
            'headless': headless,
            // 'executablePath': lt() // 驱动路径
        });
        let [page] = await this.browser.pages();
        this.page = page;
        this.cursor = createCursor(this.page);
        await Headless.setPageHeadless(this.page, headless);
        if (this.proxyCredentials) {
            await this.page.authenticate(this.proxyCredentials);
        }
        await this.page.setViewport({
            'width': 1920,
            'height': 1080
        });
        await this.page.setCookie({
            'value': this.region,
            'expires': 9999999999,
            'domain': '.nike.com',
            'name': 'NIKE_COMMERCE_COUNTRY'
        });
        this.page.setDefaultNavigationTimeout(120000);
        this.page.setDefaultTimeout(120000);
        // 启用请求拦截器
        await this.page.setRequestInterception(true);
        this.page.on('request', request => {
            if (!RegionFt.includes(this.region)) {
                if (request.resourceType() == 'document' && request.url().includes(this.productUrl)) {
                    let url = new URL(request.url());
                    let launchEntryId = url.searchParams.get('launchEntryId');
                    if (launchEntryId != null) {
                        this.entry_id = launchEntryId;
                    }
                }
            }
            if (request.resourceType() === 'image') {
                request.abort();
            } else {
                request.continue();
            }
        }).on('response', async response => {
            if (response.url().includes('nike.com')) {
                this.log(response.request().method() + ' ' + response.status() + ' ' + response.url() + ' ' + response.request().resourceType());
            }
            if (response.url() == 'https://api.nike.com/launch/entries/v2' && response.request().method() == 'POST') {
                this.log('Successfully got response of /launch/entries/v2');
                try {
                    let entryJson = await response.json();
                    this.log('Entries response JSON is', entryJson);
                    this.entry_id = entryJson['id'];
                } catch (err) {
                    this.log(err);
                }
            } else if (response.url() == 'https://unite.nike.com/account/user/v1' && response.request().method() == 'POST') {
                if (this.accountVerifiedSmsNumber == null) {
                    this.log('Successfully got response of /account/user/v1');
                    try {
                        let userInfoJson = await response['json']();
                        this.log('User Info JSON is', userInfoJson);
                        if ('sms' in userInfoJson.user.contact) {
                            this.accountVerifiedSmsNumber = userInfoJson.user.contact.sms.verifiedNumber;
                            this.accountHasNoPhoneNumber = false;
                        } else {
                            this.accountHasNoPhoneNumber = true;
                        }
                    } catch (err) {
                        this.log(err);
                    }
                }
            }
        }).on('requestfailed', requestfailed => {
            if (requestfailed.failure() != null) {
                this.log('requestFailed ' + requestfailed.failure().errorText + ' ' + requestfailed.url());
                if (requestfailed.failure().errorText === 'net::ERR_TUNNEL_CONNECTION_FAILED') {
                    this.cbstatus(TASK_STATUS['PROXY_ERROR']);
                }
            }
        });
        page.on('error', err => {
            this.log('puppeteer error, ' + err);
            this.cbstatus(TASK_STATUS['BROWSER_CRASH']);
        });
        // 要在页面实例上下文中执行的方法，重新读取页面
        await page.evaluateOnNewDocument(() => {
            function reload(callback) {
                if (document.readyState != 'loading') {
                    callback();
                } else {
                    document.addEventListener('DOMContentLoaded', callback);
                }
            }
            reload(() => {
                let innerHtml = document.body.innerHTML;
                if (innerHtml.toLowerCase().includes('site down')) {
                    location.reload();
                }
            });
        });
    }
    // 判断异常
    isError(code) {
        return code != PURCHASE_RETURNS['NO_ERROR'];
    }
    //
    async acceptCookiePopup() {
        this.log('acceptCookiePopup called');
        if (this.region == 'NL') {
            let selector = 'button.ncss-btn-primary-dark[data-qa="accept-cookies"]';
            this.log('Region is NL, checking for accept_button', selector);
            let isSelectorFound = await this.selectorFound(selector, 2000, !![]);
            if (isSelectorFound) {
                this.log("Found accept_button!");
                // 随机等1050~1250ms再点击
                await this.page.waitFor(1000 + this.getRandomDelay());
                await this.cursor.click(selector);
            }
        } else if (RegionLt.includes(this.region)) {
            let selector = '.pre-modal-view[data-view="cookieModalSimple"] button[data-var="acceptBtn"]';
            this.log('Region is different than NL, checking for accept_button', selector);
            let isSelectorFound = await this.selectorFound(selector, 2000, !![]);
            if (isSelectorFound) {
                this.log('Found accept_button!');
                // 随机等1050~1250ms再点击
                await this.page.waitFor(1000 + this.getRandomDelay());
                await this.cursor.click(selector);
            }
        }
    }
    // 是否能找到选择器
    async selectorFound(selector, waitMs, visible = false) {
        try {
            this.log('Waiting for ' + selector + ' (' + waitMs + ')');
            await this.page.waitForSelector(selector, {
                'timeout': waitMs,
                'visible': visible
            });
            this.log(selector + ' found');
            return true;
        } catch {
            this.log(selector + ' not found');
            return false;
        }
    }
    // 填充表单内容
    async fillElement(selector, value) {
        let isSelectorFound = await this.selectorFound(selector, 1000);
        if (!isSelectorFound) return;
        await this.cursor.click(selector);
        await this.page.waitFor(this.getRandomDelay());
        let inputValues = await this.page.evaluate(_selector => {
            document.querySelectorAll(_selector)[0].value;
        }, selector);
        // 输入框里如有有值就全选
        if (!inputValues || inputValues['length'] !== 0) await this.markAll();
        // 输入内容
        await this.typeDelayed(value);
        await this.page.waitFor(this.getRandomDelay());
    }
    // 全选 (模拟Ctrl+A组合键)
    async markAll() {
        this.log('markAll function called');
        await this.page.keyboard.down('Control');
        await this.page.waitFor(this.getRandomDelay());
        await this.page.keyboard.press('A');
        await this.page.keyboard.up('Control');
    }
    // 输入内容
    async typeDelayed(value) {
        for (let i = 0; i < value.length; i++) {
            await this.page.keyboard.down(value[i]);
            await this.page.waitFor(this.getRandomKeyDelay());
            await this.page.keyboard.up(value[i]);
            await this.page.waitFor(this.getRandomTypeDelay());
        }
    }
    // 获取 url = unite.nike.com 的 iframe
    async getUniteIFrame() {
        let unitIframe = this.page.frames().find(_0x542882 => _0x542882.url().includes('unite.nike.com'));
        let times = 0;
        // 如果获取不到则每1秒再取一次，30次后刷新页面再从头开始获取
        while (!unitIframe) {
            this.log('Didnt find unite_nike_iframe, retrying... retry number: ' + times);
            if (times == 30) {
                await this.page.reload({
                    'waitUntil': ['networkidle0', 'domcontentloaded']
                });
                times = 0;
            }
            times++;
            await this.page.waitFor(1000);
            unitIframe = this.page.frames().find(_0xc083b3 => _0xc083b3.url().includes('unite.nike.com'));
        }
        return unitIframe;
    }
    // 从login的iframe中获取 com.nike.commerce.snkrs.web.credential 放在 this.login_data
    async getLoginDataFromUniteIFrame() {
        this.log("Retrieving login data from unite_nike_iframe");
        let uIframe = await this.getUniteIFrame();
        let uniteLocalStorage = await uIframe.evaluate(() => Object.assign({}, window['localStorage']));
        this.log('uniteLocalStorage', uniteLocalStorage);
        this.login_data = JSON.parse(uniteLocalStorage['com.nike.commerce.snkrs.web.credential']);
        if (Object.keys(this.login_data).length > 0) {
            this.log('Successfully retrieved LOGIN DATA from unite.nike.com iframe, user_id:', this.login_data['user_id']);
            this.log(this.login_data);
        }
    }
    // 把prev_login_data注入到iframe的com.nike.commerce.snkrs.web.credential中
    async injectLoginDataIntoLocalStorage() {
        let uIframe = await this.getUniteIFrame();
        this.log("injectLoginDataIntoLocalStorage prev_login_data", this.prev_login_data);
        await uIframe.evaluate(({
            login_data: login_data
        }) => {
            window.localStorage.setItem('com.nike.commerce.snkrs.web.credential', login_data);
            window.localStorage.setItem('com.nike.commerce.nikedotcom.web.credential', login_data);
        }, {
            'login_data': this.prev_login_data
        });
    }
    // 重新刷新token数据，并保存到prev_login_data中
    async rRefreshToken(isSaveLoginData = !![]) {
        const queryParams = {
            'appVersion': 839,
            'experienceVersion': 839,
            'uxid': 'com.nike.commerce.nikedotcom.web',
            'locale': this.NIKE_COMMERCE_LANG_LOCALE, // ???
            'backendEnvironment': 'identity',
            'browser': 'Google Inc.',
            'os': 'undefined',
            'mobile': ![],
            'native': ![],
            'visit': 1
        };
        let clientId = JSON.parse(this.prev_login_data).clientId;
        let refresh_token = JSON.parse(this.prev_login_data).refresh_token;
        this.log("rRefreshToken payload", JSON.stringify(queryParams), clientId, refresh_token);
        let query = Object.keys(queryParams).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(queryParams[key])).join('&');
        // 在浏览器页面中执行刷新token请求，获取数据
        const tokenRefreshRes = await this.page.evaluate(async ({
            query: query,
            token: refresh_token,
            clientId: clientId,
            productUrl: productUrl
        }) => {
            const res = await fetch('https://unite.nike.com/tokenRefresh?' + query, {
                'headers': {
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'content-type': 'application/json',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site'
                },
                'referrer': productUrl,
                'referrerPolicy': 'no-referrer-when-downgrade',
                'body': JSON['stringify']({
                    'refresh_token': refresh_token,
                    'client_id': clientId,
                    'grant_type': 'refresh_token'
                }),
                'method': 'POST',
                'mode': 'cors',
                'credentials': 'include'
            });
            let resJson = {};
            try {
                resJson = await res.json();
            } catch (err) {
                console.error("Couldnt retrieve json from responose");
            }
            return {
                'status': res['status'],
                'json': resJson
            };
        }, {
            'query': query,
            'token': refresh_token,
            'clientId': clientId,
            'productUrl': this.productUrl
        });
        this.log('rRefreshToken', JSON.stringify(tokenRefreshRes));
        if (tokenRefreshRes['status'] === 200) {
            let prevLoginData = JSON.parse(this.prev_login_data);
            prevLoginData['timestamp'] = Math.floor(Date.now() / 1000);
            prevLoginData['access_token'] = tokenRefreshRes['json']['access_token'];
            prevLoginData['refresh_token'] = tokenRefreshRes['json']['refresh_token'];
            prevLoginData['expires_in'] = tokenRefreshRes['json']['expires_in'];
            prevLoginData['user_id'] = tokenRefreshRes['json']['user_id'];
            this.prev_login_data = JSON.stringify(prevLoginData);
            this.log("Saving the newly retrieved login data to account information");
            if (isSaveLoginData) this.saveLoginData(this.prev_login_data);
            return !![];
        } else {
            console.error("tokenRefresh returned status other than 200: ", JSON.stringify(tokenRefreshRes));
            return ![];
        }
    }
    // 关闭浏览器
    stop(_0x19b4f4 = !![]) {
        // if (_0x19b4f4) {
        //     this.logObj.closeStream(); // ???
        // }
        if (this.waiting_for_results) return;
        let _0x5bb543 = setInterval(async () => {
            if (this.browser) {
                clearInterval(_0x5bb543);
                await this.browser.close();
            }
        });
    }

    // 获取从50到250的随机数
    getRandomDelay() {
        return getRandom(bt50, kt250);
    }
    // 封装log函数
    log(){
        this.log.apply(this,arguments)
    }
}

module.export = snkrs;