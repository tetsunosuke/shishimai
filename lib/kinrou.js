const path = require("path");
const electron = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const pie = require("puppeteer-in-electron");
const puppeteer = require("puppeteer-core");
const dateformat = require('dateformat');
const kinrouUrl = "https://kinrou.sas-cloud.jp/kinrou";
const debug = /--debug/.test(process.argv[2])
const Store = require('electron-store');
const store = new Store({});
let conf = store.get("kinrou", null);
if (debug) {
    conf.password = "xxxxxx";
}

module.exports = {
    dakoku: async function(mainWindow) {
        browser = await pie.connect(app, puppeteer);
        const page = await pie.getPage(browser, mainWindow);
        mainWindow.loadURL(kinrouUrl + "/kojin/");

        // ログイン。法人コード、社員コード、パスワードを入力し、ログインボタンを押します
        await page.waitForSelector("[name=houjinCode]");
        await page.type('[name=houjinCode]', conf.houjinCode);
        await page.type('[name=userId]',     conf.userId);
        await page.type('[name=password]',   conf.password);
        // 次のページが読み込まれるまで待つという意味です
        await Promise.all([
            page.waitForNavigation(),
            page.click("#bt")
        ]);

        // 打刻
        try {
            await page.click("[name='dakoku']");
        } catch (e) {
            // ログインエラー
            // TODO: 他にも通信タイムアウトエラーが出るケースがあることがわかっている
            await Promise.all([
                page.waitForSelector("#error"),
                elm = await page.$("#error")
            ]);
            text = await page.evaluate(elm => elm.textContent, elm);
            // エラーメッセージの表示
            await mainWindow.loadURL('file://' + __dirname + '/../src/main.html');
            return;
        }

        const d = new Date();
        const year = dateformat(d, 'yyyy');
        const month = dateformat(d, 'mm');
        const kijunDate = dateformat(d, 'yyyymmdd');

        await page.goto(`${kinrouUrl}/dakokuList/index?syainCode=${conf.userId}&year=${year}&month=${month}&kijunDate=${kijunDate}`);

        let elms = await page.$$(".dakoku-all-list tr");
        let dakokuType;
        let dakokuTime;
        text = "最後の打刻は：";
        elm = await page.$(`.dakoku-all-list tr:nth-of-type(${elms.length-1}) td:nth-of-type(3)`);
        dakokuType = await page.evaluate(elm => elm.textContent, elm);
        elm = await page.$(`.dakoku-all-list tr:nth-of-type(${elms.length-1}) td:nth-of-type(4)`);
        dakokuTime = await page.evaluate(elm => elm.textContent, elm);
        // ここで文字列を保持しておき、index.htmlに読み込ませる
        text = `最後の打刻は ${dakokuTime} (${dakokuType})`;
        await mainWindow.loadURL('file://' + __dirname + '/../src/main.html');
        return;
    },
    showConfig: async function() {
        await mainWindow.loadURL('file://' + __dirname + '/../src/config.html');
        return;
    }
};

