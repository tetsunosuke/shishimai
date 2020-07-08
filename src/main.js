const path = require("path");
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
const kinrouUrl = "https://kinrou.sas-cloud.jp/kinrou";
const conf = store.get("kinrou");

const debug = /--debug/.test(process.argv[2])

// puppeteerを使うときはこのタイミングでinitializeする
pie.initialize(app);

let mainWindow = null;

require("update-electron-app");
const logger = require("electron-log");
// Render側に渡すためのメッセージ文字列
var text = "";
// main.htmlからsendを受け取ったらrecieveを返すイベント
ipc.on('send', function(event) {
    console.log("receive send message", text);
    event.sender.send('receive', text)
})

// メニューに関する情報
const template = [
    {
        "label":"メニュー",
        "submenu": [{
            "label": "ログイン情報", 
            "click": async () => {
                console.log("TODO: open config.html");
            }
        }, {
            "label": "パスワード変更", 
            "click": async () => {
                console.log("TODO: open config.html");
            }
        }, {
            "label": "実行", 
            "click": async () => {
                dakoku();
            },
            "accelerator":  "CmdOrCtrl+R"
        }]
    }
];

const initialize = async () => {
    console.info("initialize");
    logger.log("log");
    logger.info("info");
    makeSingleInstance();

    //async function createWindow() {
    const createWindow = async () => {
        const windowOptions = {
            width: 1080,
            height: 680,
            title: "獅子舞",
            webPreferences: {
                nodeIntegration: true
            }
        };

        mainWindow = new BrowserWindow(windowOptions);
        // 一旦デフォルトページを呼び出す作りにしてみる
        dakoku();
        // mainWindow.loadURL(path.join('file://', __dirname, '/index.html'));

        mainWindow.on("closed", () => {
            mainWindow = null;
        });
    };

    app.on('ready', () => {
        console.log("ready");
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
        createWindow();
        if (debug) {
            mainWindow.webContents.openDevTools()
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform != 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        }
    });
}

function makeSingleInstance () {
    if (process.mas) {
        return
    }

    app.requestSingleInstanceLock()

    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore()
            }
            mainWindow.focus();
        }
    })
}

const dakoku = async () => {
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
        if (!debug) {
            await page.click("[name='dakoku']");
        }
    } catch (e) {
        // ログインエラー
        // TODO: 他にも通信タイムアウトエラーが出るケースがあることがわかっている
        await Promise.all([
            page.waitForSelector("#error"),
            elm = await page.$("#error")
        ]);
        text = await page.evaluate(elm => elm.textContent, elm);
        await mainWindow.loadURL('file://' + __dirname + '/main.html');
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
    await mainWindow.loadURL('file://' + __dirname + '/main.html');
}

process.on('uncaughtException', function(err) {
  logger.error('electron:event:uncaughtException');
  logger.error(err);
  logger.error(err.stack);
  app.quit();
});

// 実行開始
initialize();

