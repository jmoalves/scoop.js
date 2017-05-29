'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const unzip = require('unzip');
const parseArgs = require('minimist');

var fail = false;
var jsons = {};
var envRoot = undefined;
var bucket = './bucket';
var force = false;

var args = parseArgs(process.argv.slice(2));

if (args.F) {
    force = true;
}

if (args.d) {
    envRoot = args.d;
} else {
    switch (os.platform()) {
        case 'win32':
            envRoot = 'd:/bndes-java-env';
            break;
        
        case 'linux':
            envRoot = os.homedir() + '/bndes-java-env';
            break;
        
        default:
            console.log('Defina o destino com -d');
            fail = true;
    }
}


args._.forEach((val, index) => resolvePackage(val));

if (fail) {
    process.exit(1);
}

for (var pkg in jsons) {
    console.log('[' + pkg + ']');
    if (!jsons[pkg].dstDir) {
        continue;
    }

    var dstDir = path.resolve(envRoot, jsons[pkg].dstDir);
    if (jsons[pkg].chkDir) {
        var dstDir = path.resolve(envRoot, jsons[pkg].chkDir);
    }

    if (fs.existsSync(dstDir)) {
        console.log('[' + pkg + '] - ja instalado em ' + dstDir);
        if (!force) {
            continue;
        }

        console.log('[' + pkg + '] - REMOVENDO ' + dstDir);
        forceRemove(dstDir);
    }

    console.log('[' + pkg + '] - INSTALL');
    for (var task in jsons[pkg].tasks) {
        switch (task) {
            case 'unzip':
                bje_unzip(jsons[pkg], jsons[pkg].tasks[task]);
                break;

            default:
                console.log('\t' + task + ' - Task nao suportada!');
                break;
        }
    }
};

// Encerra o codigo principal
process.exit(0);

//----------------------------------------------------------------------------
// Funcoes
//----------------------------------------------------------------------------
function resolvePackage(pkg) {
    if (jsons[pkg]) {
        return;
    }

    var file = path.resolve(bucket, pkg + '.json');
    if (!fs.existsSync(file)) {
        console.log(file + ' nao existe');
        fail = true;
        return;
    }

    var json = JSON.parse(fs.readFileSync(file, { 'encoding': 'UTF-8' }));
    if (json.depends) {
        json.depends.sort(); // para a ordem dos nao dependentes ser deterministica
        for (var dep in json.depends) {
            resolvePackage(json.depends[dep]);
        }
    }

    jsons[pkg] = json;
}

function bje_unzip(buf, task) {
    var url = task.url;
    if (!url && task[os.platform()]) {
        url = task[os.platform()].url;
    }

    if (!url) {
        fail = true;
        return;
    }

    console.log('\tUNZIP - url: ' + url);
    http.get(url, function(res) {
        var dstDir = path.resolve(envRoot, buf.dstDir);
        console.log('\tUNZIP - to: ' + dstDir);

        if (task.strip && task.strip == 'true') {
            res.on('end', () => {
                for (var toStrip of fs.readdirSync(dstDir)) {
                    for (var child of fs.readdirSync(path.resolve(dstDir, toStrip))) {
                        var from = path.resolve(dstDir, toStrip, child);
                        var dst = path.resolve(dstDir, child);
                        // console.log(from + ' => ' + dst);
                        fs.renameSync(from, dst);
                    }
                    fs.rmdir(path.resolve(dstDir, toStrip));
                }
            });
        }

        res.on('error', (error) => {
            console.log('ERROR: ' + error.message);
        })

        res.pipe(unzip.Extract({ path: dstDir }));
    });
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
