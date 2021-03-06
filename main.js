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

console.log('');
console.log('config = ' + JSON.stringify(config, null, 3));
console.log('');

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

    if (!newConfig.buckets) {
        newConfig.buckets = [ 
            './bucket' 
        ];
    }

    for (var i in newConfig.buckets) {
        newConfig.buckets[i] = path.resolve(newConfig.buckets[i]);
    }

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

    var file = packageDescription(pkg);
    if (!file) {
        console.log(pkg + ' nao encontrado');
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

function packageDescription(pkg) {
    for (var i in config.buckets) {
        var file = path.resolve(config.buckets[i], pkg + '.json');

        if (fs.existsSync(file)) {
            console.log('DEBUG: ' + pkg + ' => ' + file);
            return file;
        }
    }

    return null;
}

function resolveTasks(pkg) {
    for (var x in pkg.tasks) {
        if (!taskMap.hasOwnProperty(x)) {
            var msg = '[' + pkg.name + '] ' + x + ' <-- Task nao suportada!';
            throw msg;
        }

        var taskObj = pkg.tasks[x];
        var idx = 0;
        if (Array.isArray(taskObj)) {
            for (let task of taskObj) {
                resolveTask(task, x, idx);
                idx++;
            }
        } else {
            resolveTask(taskObj, x, idx);
        }

        function resolveTask(task, name, index) {
            task.name = name;
            task.index = index;
            task.exec = taskMap[name];
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
    var lastPkg = undefined;
    for (var x in pkgs) {
        var pkg = pkgs[x];
        var taskDep = [];

        ((lastPkg, pkg, entries) => {
            // Todos os inícios de pacote dependem do final de suas dependências
            var initialTask = pkg.name + ':BEGIN';
            var pkgDeps = [];
            if (pkg.depends) {
                pkgDeps = pkg.depends;
            }
            if (lastPkg && !pkgDeps.find((x) => x == lastPkg)) {
                // Serialized install
                pkgDeps.push(lastPkg);
            }

            pkg.installed = isInstalled(pkg);

            //console.log('[' + pkg.name + '] - Tasks - ' + initialTask + ' -> ' + JSON.stringify(pkgDeps));
            orchestrator.add(initialTask, pkgDeps, () => {
                if (!pkg.installed) {
                    console.log('');
                    pkg.getElapsed = measureTime();
                    console.log('[' + pkg.name + '] == BEGIN');
                }
            })

            taskDep.push(initialTask);

            if (!pkg.installed) {
                // Todos as tasks do pacote dependem de todas as anteriores (rodam em sequência)
                for (var y in pkg.tasks) {
                    var taskObj = pkg.tasks[y];
                    if (Array.isArray(taskObj)) {
                        for (let task of taskObj) {
                            runTask(task);
                        }
                    } else {
                        runTask(taskObj);                        
                    }
                 }
            }

            // O final do pacote depende de todas as tasks (se houver)
            var finalTask = pkg.name;
            //console.log('[' + pkg.name + '] - Tasks - ' + finalTask + ' -> ' + JSON.stringify(taskDep));
            orchestrator.add(finalTask, taskDep, () => {
                if (!config.pkg) {
                    config.pkg = {};
                };

                config.pkg[pkg.name] = {};
                if (pkg.chkDir) {
                    config.pkg[pkg.name].homeDir = path.resolve(config.envRoot, pkg.chkDir);
                }

                if (pkg.getElapsed) {
                    pkg.elapsed = pkg.getElapsed();
                    pkg.getElapsed = undefined;
                    console.log('[' + pkg.name + '] == END - ' +
                        pkg.elapsed.seconds + 's ' +
                        pkg.elapsed.milliseconds + 'ms');
                }
            })
            entries.push(finalTask);

            function runTask(task) {
                var taskName = pkg.name + ':' + task.name + ':' + task.index;
                //console.log('[' + pkg.name + '] - Tasks - ' + taskName + ' -> ' + JSON.stringify(taskDep));
                orchestrator.add(taskName, taskDep, (doneCallback) => {
                    var dstDir = undefined;
                    if (pkg.dstDir && pkg.dstDir.length > 0) {
                        dstDir = path.resolve(config.envRoot, pkg.dstDir);
                    } else {
                        dstDir = path.resolve(config.envRoot);                                
                    }
                    task.exec(config, dstDir, pkg, task, doneCallback);
                });
                taskDep = [taskName];
            }
        })(lastPkg, pkg, entries);

        lastPkg = pkg.name;
    }

    console.log('');
    console.log('===============================');
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

function isInstalled(pkg) {
    if (pkg.hasOwnProperty('dstDir')) {
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