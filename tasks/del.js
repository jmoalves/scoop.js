const fs = require('fs');
const path = require('path');

var deleteFolderRecursive = function(dstDir, dir) {
    if (!dir) {
        throw "DEL - No dir";
    }

    var target = path.resolve(dstDir, dir);
    if (fs.existsSync(target)) {
        fs.readdirSync(target).forEach(function(file, index) {
            var curPath = path.resolve(target, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(dstDir, curPath);
            } else { // delete file
                console.log('DEL -    rm ' + curPath);
                fs.unlinkSync(curPath);
            }
        });

        console.log('DEL - rmdir ' + target);
        fs.rmdirSync(target);
    }
};

module.exports = function(config, dstDir, pkg, task, tasks, next) {
    var dirs = [];
    if (typeof task === "string") {
        dirs.push(task);
    } else if (Array.isArray(task)) {
        dirs = task;
    } else {
        throw 'Invalid task - ' + JSON.stringify(task);
    }

    for (dir of dirs) {
        console.log('[' + pkg.name + ']\tDEL - removing: ' + dir);
        deleteFolderRecursive(dstDir, dir);
    }

    next(config, dstDir, pkg, tasks, next);
}