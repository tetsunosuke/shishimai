const electron = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const pie = require("puppeteer-in-electron");
const puppeteer = require("puppeteer-core");
const dateformat = require('dateformat');
const ipc = require('electron').ipcMain
const Store = require('electron-store');
const store = new Store({});
const kinrouUrl = "https://kinrou.sas-cloud.jp/kinrou/kojin/";
var windowOptions;
var window;
// Render側に渡すためのメッセージ文字列
var text = "";

const conf = store.get("kinrou");

// index.htmlからsendを受け取ったらrecieveを返すイベント
ipc.on('send', function(event) {
    console.log("receive send message", text);
    event.sender.send('receive', text)
})

const pwChange = async() => {
};

const main = async () => {
    let browser;
    let elm;
    await pie.initialize(app);
    browser = await pie.connect(app, puppeteer);
    const windowOptions = {
        webPreferences: {
            nodeIntegration: true
        }
    };
    const window = new BrowserWindow(windowOptions);
    if (typeof conf === "undefined") {
        await window.loadURL('file://' + __dirname + '/config.html');
    } else {
        // debug用
        // window.openDevTools();
        await window.loadURL(kinrouUrl);
        const page = await pie.getPage(browser, window);

        // ログイン。法人コード、社員コード、パスワードを入力し、ログインボタンを押します
        await page.type('[name=houjinCode]', conf.houjinCode);
        await page.type('[name=userId]',     conf.userId);
        await page.type('[name=password]',   conf.password);
        // ここは説明していませんが、次のページが読み込まれるまで待つという意味です
        await Promise.all([
            page.waitForNavigation(),
            page.click("#bt")
        ]);

        // 打刻
        try {
            await page.click("[name='dakoku']");
        } catch (e) {
            await Promise.all([
                page.waitForSelector("#error"),
                elm = await page.$("#error")
            ]);
            text = await page.evaluate(elm => elm.textContent, elm)
            await window.loadURL('file://' + __dirname + '/index.html');
            return;
        }

        const d = new Date();
        const year = dateformat(d, 'yyyy');
        const month = dateformat(d, 'mm');
        const kijunDate = dateformat(d, 'yyyymmdd');

        await page.goto(`https://kinrou.sas-cloud.jp/kinrou/dakokuList/index?syainCode=${conf.userId}&year=${year}&month=${month}&kijunDate=${kijunDate}`);

        let elms = await page.$$(".dakoku-all-list tr");
        let dakokuType;
        let dakokuTime;
        text = "最後の打刻は：";
        elm = await page.$(`.dakoku-all-list tr:nth-of-type(${elms.length-1}) td:nth-of-type(3)`);
        dakokuType = await page.evaluate(elm => elm.textContent, elm);
        elm = await page.$(`.dakoku-all-list tr:nth-of-type(${elms.length-1}) td:nth-of-type(4)`);
        dakokuTime = await page.evaluate(elm => elm.textContent, elm);
        text = `最後の打刻は ${dakokuTime} (${dakokuType})`;
        await window.loadURL('file://' + __dirname + '/index.html');
        // window.destroy();
    }
};

main().then(function() {
    console.info("main finished");
});
const template = [
    {
        "label":"メニュー",
        "submenu": [{
            "label": "ログイン情報", 
            "click": async () => {
                windowOptions = {
                    webPreferences: {
                        nodeIntegration: true
                    }
                };
                window = new BrowserWindow(windowOptions);
                await window.loadURL('file://' + __dirname + '/config.html');
            }
        }, {
            "label": "パスワード変更", 
            "click": pwChange()
        }, {
            "label": "実行", 
            "click": main()
        }]
    }
];

app.on('window-all-closed', function() {
    console.log("window-all-closed", process.platform);
    // この条件分岐なんでいるんだ？
    if (process.platform !== 'darwin') {
        app.quit();
    }

    // よくわからんので入れとく
    app.quit();
});

app.on('ready', function() {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    console.log("ready");
});
