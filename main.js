'use strict';

// Node modules
const fs = require('fs');
const path = require('path');
const os = require('os');

// 3rd party modules
const measureTime = require('measure-time');
const Orchestrator = require('orchestrator');
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
createRootDir();
orchestrate(pkgs);

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
        newConfig.envRoot = os.homedir() + '/scoop-dev-env';
    }
    newConfig.envRoot = path.resolve(newConfig.envRoot);

    if (!newConfig.bucket) {
        newConfig.bucket = './bucket';
    }
    newConfig.bucket = path.resolve(newConfig.bucket);

    if (!newConfig.repoURL) {
        newConfig.repoURL = 'http://localhost:8083/sti-bndes-java-env/install-repo/raw/master';
    }

    if (!newConfig.mvnSecurity) {
        newConfig.mvnSecurity = os.homedir() + '/settings-security.xml';
    }

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
    resolveTasks(json);
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

function resolveTasks(pkg) {
    for (var x in pkg.tasks) {
        pkg.tasks[x].name = x;
        if (taskMap[x]) {
            pkg.tasks[x].exec = taskMap[x];
        } else {
            console.log('TASKS - ' + x + ' - Task nao suportada!');
        }
    }
}

function createRootDir() {
    if (!fs.existsSync(config.envRoot)) {
        fs.mkdirSync(config.envRoot);
    }
}

function orchestrate(pkgs) {
    var orchestrator = new Orchestrator();

    var entries = [];
    for (var x in pkgs) {
        var pkg = pkgs[x];
        var taskDep = [];

        ((pkg, entries) => {
            if (!checkDstDir(pkg)) {
                // Todos os inícios de pacote dependem do final de suas dependências
                var initialTask = pkg.name + ':BEGIN';
                var pkgDeps = [];
                if (pkg.depends) {
                    pkgDeps = pkg.depends;
                }

                console.log('[' + pkg.name + '] - Tasks - ' + initialTask + ' -> ' + JSON.stringify(pkgDeps));
                orchestrator.add(initialTask, pkgDeps, () => {
                    pkg.getElapsed = measureTime();
                    console.log('[' + pkg.name + '] == BEGIN');
                })

                // Todos as tasks do pacote dependem de todas as anteriores (rodam em sequência)
                taskDep.push(initialTask);
                for (var y in pkg.tasks) {
                    var task = pkg.tasks[y];
                    ((task) => {
                        var taskName = pkg.name + ':' + task.name;
                        console.log('[' + pkg.name + '] - Tasks - ' + taskName + ' -> ' + JSON.stringify(taskDep));
                        orchestrator.add(taskName, taskDep, (doneCallback) => {
                            var dstDir = undefined;
                            if (pkg.dstDir) {
                                dstDir = path.resolve(config.envRoot, pkg.dstDir);
                            }
                            task.exec(config, dstDir, pkg, task, doneCallback);
                        });
                        taskDep = [taskName];
                    })(task);
                }
            }

            // O final do pacote depende de todas as task (se houver)
            var finalTask = pkg.name;
            console.log('[' + pkg.name + '] - Tasks - ' + finalTask + ' -> ' + JSON.stringify(taskDep));
            orchestrator.add(finalTask, taskDep, () => {
                if (!config.pkg) {
                    config.pkg = {};
                };

                config.pkg[pkg.name] = {};
                if (pkg.chkDir) {
                    config.pkg[pkg.name].homeDir = path.resolve(config.envRoot, pkg.chkDir);
                }

                pkg.elapsed = pkg.getElapsed();
                pkg.getElapsed = undefined;
                console.log('[' + pkg.name + '] == END - ' +
                    pkg.elapsed.seconds + 's ' +
                    pkg.elapsed.milliseconds + 'ms');
            })
            entries.push(finalTask);
        })(pkg, entries);
    }

    console.log('=== START - ' + JSON.stringify(entries));
    var getElapsed = measureTime();

    orchestrator.start(entries, (err) => {
        var elapsed = getElapsed();
        console.log('');
        console.log('===============================');
        if (err) {
            console.log('');
            console.log('ERROR: ' + err);
            console.log('');
        } else {
            console.log('FINISH - ' +
                elapsed.seconds + 's ' +
                elapsed.milliseconds + 'ms');
        }
        console.log('===============================');
    })
}

function checkDstDir(pkg) {
    if (pkg.dstDir) {
        var dstDir = path.resolve(config.envRoot, pkg.dstDir);
        var chkDir = dstDir;
        if (pkg.chkDir) {
            chkDir = path.resolve(config.envRoot, pkg.chkDir);
        }

        if (fs.existsSync(chkDir)) {
            console.log('[' + pkg.name + '] === ja instalado em ' + chkDir);
            if (!force) {
                return true;
            }
            console.log('[' + pkg.name + '] === REMOVENDO ' + chkDir);
            forceRemove(chkDir);
        }
    }

    return false;
}