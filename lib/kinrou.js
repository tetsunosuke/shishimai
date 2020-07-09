const pie = require("puppeteer-in-electron");
const dateformat = require('dateformat');
const logger = require("electron-log");
const dakokuMode = true;
if (dakokuMode) {
    logger.info("打刻するモード");
} else {
    logger.warn("打刻しないモードでデバッグ中");
}

module.exports = {
    kinrouUrl:"https://kinrou.sas-cloud.jp/kinrou",
    dakoku: async function(app, puppeteer, mainWindow, conf) {
        let text = "";
        browser = await pie.connect(app, puppeteer);
        const page = await pie.getPage(browser, mainWindow);
        mainWindow.loadURL(this.kinrouUrl + "/kojin/");

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
            if (dakokuMode) {
                await page.click("[name='dakoku']");
            } else {
                await page.$("[name='dakoku']");
            }
        } catch (e) {
            // ログインエラー
            // TODO: 他にも通信タイムアウトエラーが出るケースがあることがわかっている
            await Promise.all([
                page.waitForSelector("#error"),
                elm = await page.$("#error")
            ]);
            text = await page.evaluate(elm => elm.textContent, elm);
            // エラーメッセージの表示
            return {
                "text": text,
                "url": 'file://' + __dirname + '/../html/main.html'
            };
        }

        const dakokuListUrl = this.buildDakokuListUrl(conf);
        await page.goto(dakokuListUrl);

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

        return {
            "text": text,
            "url": 'file://' + __dirname + '/../html/main.html'
        };
    },
    showConfig: async function(app, puppeteer, mainWindow) {
        return {
            "url": 'file://' + __dirname + '/../html/config.html'
        }
    },
    buildDakokuListUrl: function(conf) {
        const d = new Date();
        const year = dateformat(d, 'yyyy');
        const month = dateformat(d, 'mm');
        const kijunDate = dateformat(d, 'yyyymmdd');
        return `${this.kinrouUrl}/dakokuList/index?syainCode=${conf.userId}&year=${year}&month=${month}&kijunDate=${kijunDate}`;
    }
};

