const electron = require('electron');
const session = require('electron').session;
const app = electron.app;
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const pie = require("puppeteer-in-electron");
const puppeteer = require("puppeteer-core");
const dateformat = require('dateformat');
const ipc = require('electron').ipcMain
const kinrouLib = require('./lib/kinrou.js');


const debug = /--debug/.test(process.argv[2])
require("update-electron-app");
const logger = require("electron-log");
const Store = require('electron-store');
let store = new Store({});
if (debug) {
    store = new Store({
        "cwd": require('path').resolve(__dirname, '..'),
    });
}
let conf = store.get("kinrou", null);
global.sharedObject = {
    store: store,
    debug: debug
};


// puppeteerを使うときはこのタイミングでinitializeする
pie.initialize(app);

var mainWindow = null;


// Render側に渡すためのメッセージ文字列
var text = "";
// main.htmlからsendを受け取ったらrecieveとともにテキストを返すイベント
ipc.on('loaded', function(event, arg) {
    console.log(`receive loaded message:${arg}, reply text:${text}`);
    event.reply("reply-text", text);
});
ipc.on('reload', function(event, arg) {
    console.log(`receive loaded message:${arg}`);
    // 設定があれば打刻処理を実施
    conf = store.get("kinrou", null);
    kinrouLib.dakoku(app, puppeteer, mainWindow, conf).then(v => {
        text = v.text;
        mainWindow.loadURL(v.url);
    });
});

// メニューに関する情報
const template = [
    {
        "label":"メニュー",
        "submenu": [{
            "label": "ログイン情報",
            "click": function(m,b,e) {
                // logger.log(m, b, e);
                kinrouLib.showConfig().then(v => {
                    mainWindow.loadURL(v.url);
                });
            },
            "accelerator":  "CmdOrCtrl+L"
        }, {
            "label": "パスワード変更",
            "click": function(m,b,e) {
                // logger.log(m, b, e);
                kinrouLib.showConfig().then(v => {
                    mainWindow.loadURL(v.url);
                });
            },
            "accelerator":  "CmdOrCtrl+P"
        }, {
            "label": "実行",
            "click": function(m,b,e) {
                // logger.log(m, b, e);
                kinrouLib.dakoku(app, puppeteer, mainWindow, conf).then(v => {
                    text = v.text;
                    mainWindow.loadURL(v.url);
                });
            },
            "accelerator":  "CmdOrCtrl+R"
        }]
    }
];

const initialize = async () => {
    logger.log("initialize");
    makeSingleInstance();

    const createWindow = async () => {
        const windowOptions = {
            width: 1080,
            height: 680,
            title: "獅子舞",
            webPreferences: {
                nodeIntegration: true,
                // TODO: ここはIslandに変えて対応する
                enableRemoteModule: true,
            }
        };

        mainWindow = new BrowserWindow(windowOptions);
        if (debug) {
            mainWindow.webContents.openDevTools()
        }
        console.log("mainWindow is initialized");

        mainWindow.on("closed", () => {
            mainWindow = null;
        });
    };

    app.on('ready', () => {
        logger.log("ready");
        /*
         * TODO セキュリティ対応
        if (!debug) {
            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        'Content-Security-Policy': [`default-src \'self\' ${kinrouLib.kinrouUrl}`]
                    }
                })
            })
        }
        */
        createWindow();
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
        if (conf === null) {
            console.info("show config with config is null");
            kinrouLib.showConfig().then(v => {
                mainWindow.loadURL(v.url);
            });
            return;
        }

        // 設定があれば打刻処理を実施
        kinrouLib.dakoku(app, puppeteer, mainWindow, conf).then(v => {
            text = v.text;
            mainWindow.loadURL(v.url);
        });
    });

    app.on("browser-window-created", (o) => {
        // こっちで処理を開始すべき？
        logger.log("browser-window-created");
    });

    app.on('window-all-closed', () => {
        console.info("platformがdarwinの場合にapp.quitが呼ばれないが良いのか？");
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


process.on('uncaughtException', function(err) {
  logger.error('electron:event:uncaughtException');
  logger.error(err);
  logger.error(err.stack);
  app.quit();
});

// 実行開始
initialize();
