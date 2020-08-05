const pie = require("puppeteer-in-electron");
const dateformat = require('dateformat');
const logger = require("electron-log");
// デバッグ時のみに利用します
const dakokuMode = true;
if (dakokuMode) {
    logger.info("打刻するモード");
} else {
    logger.warn("打刻しないモードでデバッグ中");
}

module.exports = {
    kinrouUrl:"https://kinrou.sas-cloud.jp/kinrou",
    isPasswordExpired: async function(page) {
        let url = await page.url();
        if (url === this.kinrouUrl + "/kojin/changePassword/") {
            return true;
        }

        return false;
    },
    generateNewPassword: function() {
        const length = 8;
        let password_base = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	    let password = '';
	    for (let i = 0; i < length; i++) {
		    password += password_base.charAt(Math.floor(Math.random() * password_base.length));
	    }
	    return password;
    },
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
            // ログインエラーorパスワード期限切れ
            if (this.isPasswordExpired(page)) {
                // パスワード変更確認ダイアログを強制OKする
                // TODO: 処理が進むがダイアログが残ってしまうケースが観測された
                page.on('dialog', async dialog => {
                    dialog.accept();
                });
                // 自動更新を試みる
                const newPassword = this.generateNewPassword();
                // 旧パスワード
                await page.type('[name=oldPassword]',   conf.password);
                // 新パスワード
                await page.type('[name=newPassword]',   newPassword);
                await page.type('[name=reNewPassword]', newPassword);
                await page.click("[name='edit']");
                text = `パスワードを ${newPassword} として更新しました。設定変更で獅子舞側のパスワードを更新してください`;
                return {
                    "text": text,
                    "url": 'file://' + __dirname + '/../html/main.html'
                };
            }
            // TODO: 他にも通信タイムアウトエラーが出るケースがあることがわかっているのでその対応
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
    showConfig: async function() {
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

