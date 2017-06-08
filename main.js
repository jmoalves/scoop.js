'use strict';

// Node modules
const fs = require('fs');
const path = require('path');
const os = require('os');

// 3rd party modules
const parseArgs = require('minimist');

// local modules
const taskMap = require('./taskMap.js');

var fail = false;
var force = false;

var args = parseArgs(process.argv.slice(2));
// console.log('args = ' + JSON.stringify(args, null, 3));

var config = {};
if (args.c) {
    config = loadConfig(args.c);
}
config = defaultConfig(config);

if (args.F) {
    force = true;
}

if (args.d) {
    config.envRoot = args.d;
}

var pkgs = {};

if (args._) {
    args._.forEach((val) => resolvePackage(val, pkgs));
} else {
    fail = true;
}

if (fail) {
    process.exit(1);
}

console.log('config = ' + JSON.stringify(config, null, 3));
var entries = [];
for (var x in pkgs) {
    entries.push(pkgs[x]);
}
installPackage(entries);

//----------------------------------------------------------------------------
// Funcoes
//----------------------------------------------------------------------------
function loadConfig(cfg) {
    var file = cfg;
    if (!fs.existsSync(file)) {
        console.log(file + ' nao existe');
        fail = true;
        return;
    }

    var json = JSON.parse(fs.readFileSync(file, { 'encoding': 'UTF-8' }));
    return json;
}

function defaultConfig(userConfig) {
    var newConfig = userConfig;

    if (!newConfig.envRoot) {
        switch (os.platform()) {
            case 'win32':
                config.envRoot = 'd:/bndes-java-env';
                break;

            case 'linux':
                config.envRoot = os.homedir() + '/bndes-java-env';
                break;

            default:
                console.log('envRoot sem default para ' + os.platform() + ' - Defina o destino com -d');
                fail = true;
        }
    }

    if (!newConfig.bucket) {
        newConfig.bucket = './buckets';
    }
    newConfig.bucket = path.resolve(newConfig.bucket);

    return newConfig;
}

function resolvePackage(pkg, jsons) {
    if (!pkg) {
        // Isso não deveria ser necessário...
        // FIXME: Tratar forEach corretamente. 
        return;
    }

    if (jsons[pkg]) {
        return;
    }

    var file = path.resolve(config.bucket, pkg + '.json');
    // console.log('DEBUG: ' + pkg + ' bucket - ' + config.bucket + ' file: ' + file);
    if (!fs.existsSync(file)) {
        console.log(file + ' nao existe');
        fail = true;
        return;
    }

    var json = JSON.parse(fs.readFileSync(file, { 'encoding': 'UTF-8' }));
    if (json.depends) {
        json.depends.sort(); // para a ordem dos nao dependentes ser deterministica
        for (var dep in json.depends) {
            resolvePackage(json.depends[dep], jsons);
        }
    }

    json.name = pkg;
    jsons[pkg] = json;
}

function forceRemove(file) {
    var stats = fs.statSync(file);
    if (stats.isDirectory()) {
        for (var child of fs.readdirSync(file)) {
            forceRemove(path.resolve(file, child));
        }
        fs.rmdirSync(file);
    } else {
        fs.unlinkSync(file);
    }
}

function installPackage(pkgs) {
    // console.log('installPackage() pkgs => ' + JSON.stringify(pkgs));
    var pkg = pkgs.shift();

    if (!pkg) {
        return;
    }

    console.log('');
    console.log('[' + pkg.name + ']');
    if (!pkg.dstDir) {
        installPackage(pkgs);
        return;
    }

    var chkDir = path.resolve(config.envRoot, pkg.dstDir);
    if (pkg.chkDir) {
        chkDir = path.resolve(config.envRoot, pkg.chkDir);
    }

    if (fs.existsSync(chkDir)) {
        console.log('[' + pkg.name + '] === ja instalado em ' + chkDir);
        if (!force) {
            installPackage(pkgs);
            return;
        }

        console.log('[' + pkg.name + '] === REMOVENDO ' + chkDir);
        forceRemove(chkDir);
    }

    console.log('[' + pkg.name + '] === INSTALL');
    var tasks = [];
    for (var x in pkg.tasks) {
        pkg.tasks[x].name = x;
        tasks.push(pkg.tasks[x]);
    }
    runTask(config, pkg, tasks, runTask);

    function runTask(config, pkg, tasks, next) {
        var task = tasks.shift();
        if (task) {
            // console.log('[' + pkg.name + '] - TASK -> ' + JSON.stringify(task, null, 3));
            if (taskMap[task.name]) {
                taskMap[task.name](config, pkg, task, tasks, next);
            } else {
                console.log('\t' + task.name + ' - Task nao suportada!');
            }
        } else {
            console.log('[' + pkg.name + '] === OK');
            installPackage(pkgs);
        }
    }
}