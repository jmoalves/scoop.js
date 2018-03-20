// Node dependencies
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const url = require('url');
//

// 3rd party dependencies
const crlf = require('crlf');
//

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    if (!task.url) {
        throw "No url";
    }

    var src = task.url.replace('${config.repoURL}', config.repoURL);
    console.log('[' + pkg.name + '] template - url: ' + src);

    // console.log('[' + pkg.name + '] template - to: "' + task.to + '" - dstDir: ' + dstDir);
    var dst = undefined;
    if (task.to && task.to.length > 0) {
        dst = path.resolve(dstDir, task.to);
    } else {
        dst = path.resolve(dstDir, path.filename(url.path(src)));
    }
    console.log('[' + pkg.name + '] template - to: ' + dst);
    mkdirHier(path.dirname(dst));

    if (src.startsWith("http://")) {
        http.get(src, getFile);
    } else if (src.startsWith("https://")) {
        https.get(src, getFile);
    } else {
        doneCallback('[' + pkg.name + '] template - Can\'t handle ' + src);
    }

    return;

    function getFile(res) {
        res.on('error', (error) => {
            console.log('[' + pkg.name + '] template - HTTP ERROR: ' + error.message);
        });

        res.pipe(fs.createWriteStream(dst)
            .on('error', (error) => {
                console.log('[' + pkg.name + '] template - SAVE ERROR - ' + error.message);
            })
            .on('finish', () => {
                if (task.vars) {
                    var data = fs.readFileSync(dst, 'utf8');
                    //console.log(filename + " data: " + data);
                    for (var str in task.vars) {
                        var txt = 
                            task.vars[str]
                            .replace(/\$\{config\.repoURL\}/g, config.repoURL)
                            .replace(/\$\{config\.envRoot\}/g, config.envRoot)
                            .replace(/\$\{dstDir\}/g, dstDir);
                        // console.log(str + ' - ' + txt);
                        data = data.replace(new RegExp(str, "g"), txt);
                    }

                    //console.log(filename + " newData: " + data);
                    fs.writeFileSync(dst, data, 'utf8');
                }
                crlf.set(dst, 'CRLF', function(err, endingType) {
                    doneCallback(null);
                });
            })
        );
    }
}

function mkdirHier(dir) {
    if (fs.existsSync(dir)) {
        return;
    }

    mkdirHier(path.dirname(dir));

    console.log("MKDIR " + dir);
    fs.mkdirSync(dir);
}